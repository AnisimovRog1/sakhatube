import Foundation

/// Базовый адрес задаётся в Build Settings через `SAKHATUBE_API_BASE_URL`.
/// Значение по умолчанию рассчитано на локальный сервер, запущенный на Mac для iOS Simulator.
enum AppConfiguration {
    private static let productionURL = URL(string: "https://sakhatube-production.up.railway.app")!

    #if DEBUG
    private static let fallbackURL = URL(string: "http://127.0.0.1:3000")!
    #else
    private static let fallbackURL = productionURL
    #endif

    static var apiBaseURL: URL {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "SakhaTubeAPIBaseURL") as? String else {
            return fallbackURL
        }

        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty,
              !value.contains("$("),
              let url = URL(string: value),
              let scheme = url.scheme?.lowercased(),
              ["http", "https"].contains(scheme) else {
            return fallbackURL
        }

        #if !DEBUG
        guard scheme == "https" else {
            return productionURL
        }
        #endif

        return url
    }
}

enum APIClientError: LocalizedError, Sendable {
    case invalidResponse
    case httpStatus(Int)
    case server(code: String?, statusCode: Int, message: String?)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Сервис вернул некорректный ответ."
        case .httpStatus(let statusCode):
            return "Сервис временно недоступен (код \(statusCode))."
        case .server(let code, let statusCode, let message):
            if let message, !message.isEmpty { return message }
            if let code, !code.isEmpty { return "Сервис отклонил запрос: \(code)." }
            return "Сервис временно недоступен (код \(statusCode))."
        }
    }
}

struct HealthStatus: Decodable, Sendable {
    let ok: Bool
    let mode: String?
}

actor APIClient {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func health() async throws -> HealthStatus {
        let url = AppConfiguration.apiBaseURL.appending(path: "health")
        return try await request(url)
    }

    func catalogHome() async throws -> CatalogHomeDTO {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/catalog/home")
        return try await request(url)
    }

    func catalog() async throws -> CatalogResponseDTO {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/catalog")
        return try await request(url)
    }

    // MARK: - Viewer account API

    /// Firebase verifies the e-mail/password credential. SakhaTube verifies the
    /// resulting ID token server-side and returns its own app session and public
    /// profile, never accepting a Firebase UID as an app authorization token.
    func exchangeFirebaseIDToken(_ idToken: String, username: String?, displayName: String?) async throws -> ViewerSessionResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/auth/firebase/exchange")
        return try await request(
            url,
            method: "POST",
            body: FirebaseTokenExchangeRequest(idToken: idToken, username: username, displayName: displayName)
        )
    }

    func registerPendingFirebaseUser(idToken: String, username: String, displayName: String?) async throws {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/auth/firebase/register-pending")
        try await requestNoContent(
            url,
            method: "POST",
            body: FirebaseTokenExchangeRequest(idToken: idToken, username: username, displayName: displayName)
        )
    }

    func viewerMe(accessToken: String) async throws -> ViewerMeResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/auth/me")
        return try await request(url, bearerToken: accessToken)
    }

    func refreshViewerSession(refreshToken: String) async throws -> ViewerSessionResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/auth/refresh")
        return try await request(url, method: "POST", body: ViewerRefreshRequest(refreshToken: refreshToken))
    }

    func logoutViewer(accessToken: String) async throws {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/auth/logout")
        try await requestNoContent(url, method: "POST", bearerToken: accessToken)
    }

    // MARK: - Protected playback API

    /// Requests the only URL AVPlayer is allowed to receive: a short-lived
    /// SakhaTube gateway manifest. The API never returns a bucket key or a
    /// direct object-storage URL.
    func createPlaybackSession(contentId: String) async throws -> PlaybackSessionResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/playback/sessions")
        return try await request(url, method: "POST", body: PlaybackSessionRequest(contentId: contentId))
    }

    /// Playback analytics are deliberately best-effort. A missed event must
    /// never keep a viewer from watching a video.
    func reportPlaybackEvent(_ event: PlaybackEventRequest) async {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/events/playback")
        do {
            _ = try await request(url, method: "POST", body: event) as PlaybackEventAcceptance
        } catch {
            // Intentionally ignored: telemetry is not a playback dependency.
        }
    }

    /// Starts a deletion request only. The account is not deleted from the app;
    /// the holder must confirm the link sent to the supplied e-mail address.
    func startDeletionRequest(email: String, accountEmail: String, message: String?) async throws -> DeletionRequestResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/privacy/deletion-requests")
        return try await request(
            url,
            method: "POST",
            body: DeletionRequestPayload(
                email: email,
                accountEmail: accountEmail,
                message: message?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                confirmation: true
            )
        )
    }

    /// Deletes the authenticated account after an explicit confirmation in the
    /// profile UI. The server removes the Firebase identity before local data,
    /// then revokes every SakhaTube session.
    func deleteViewerAccount(accessToken: String) async throws {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/account/delete")
        try await requestNoContent(
            url,
            method: "POST",
            body: DirectAccountDeletionRequest(confirmation: "DELETE"),
            bearerToken: accessToken
        )
    }

    // MARK: - Viewer comments

    func comments(contentId: String, limit: Int = 50) async throws -> CommentListResponse {
        var components = URLComponents(url: AppConfiguration.apiBaseURL.appending(path: "v1/content/\(contentId)/comments"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "limit", value: String(min(max(limit, 1), 50)))]
        guard let url = components?.url else { throw APIClientError.invalidResponse }
        return try await request(url)
    }

    func createComment(contentId: String, text: String, accessToken: String) async throws -> CommentCreateResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/content/\(contentId)/comments")
        return try await request(url, method: "POST", body: CommentCreateRequest(text: text), bearerToken: accessToken)
    }

    func reportComment(id: String, reason: CommentReportReason, accessToken: String) async throws {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/comments/\(id)/report")
        try await requestNoContent(url, method: "POST", body: CommentReportRequest(reason: reason), bearerToken: accessToken)
    }

    func deleteComment(id: String, accessToken: String) async throws {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/comments/\(id)/delete")
        try await requestNoContent(url, method: "POST", bearerToken: accessToken)
    }

    /// Records a versioned, server-side acceptance before the viewer can
    /// create user-generated content. A device-side flag is only a UX cache.
    func acceptCommunityRules(version: String, accessToken: String) async throws -> ViewerMeResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/community-rules/acceptance")
        return try await request(
            url,
            method: "POST",
            body: CommunityRulesAcceptanceRequest(version: version, accepted: true),
            bearerToken: accessToken
        )
    }

    /// Blocks the approved comment author for the current viewer. The server
    /// owns the author identity, so the client never receives or stores a
    /// private account identifier merely to perform this action.
    func blockCommentAuthor(id: String, accessToken: String) async throws -> ViewerBlockResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/comments/\(id)/block")
        return try await request(url, method: "POST", body: EmptyRequest(), bearerToken: accessToken)
    }

    func viewerBlocks(accessToken: String) async throws -> ViewerBlockListResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/viewer/blocks")
        return try await request(url, bearerToken: accessToken)
    }

    func unblockViewer(id: String, accessToken: String) async throws {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/viewer/blocks/\(id)")
        try await requestNoContent(url, method: "DELETE", bearerToken: accessToken)
    }

    private func request<Response: Decodable>(_ url: URL) async throws -> Response {
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        return try await execute(request)
    }

    private func request<Request: Encodable, Response: Decodable>(
        _ url: URL,
        method: String,
        body: Request
    ) async throws -> Response {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await execute(request)
    }

    private func request<Request: Encodable, Response: Decodable>(
        _ url: URL,
        method: String,
        body: Request,
        bearerToken: String
    ) async throws -> Response {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(body)
        return try await execute(request)
    }

    private func request<Response: Decodable>(_ url: URL, bearerToken: String) async throws -> Response {
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        return try await execute(request)
    }

    private func requestNoContent(_ url: URL, method: String, bearerToken: String) async throws {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        guard (200..<300).contains(httpResponse.statusCode) else { throw APIClientError.httpStatus(httpResponse.statusCode) }
    }

    private func requestNoContent<Body: Encodable>(_ url: URL, method: String, body: Body) async throws {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        guard (200..<300).contains(httpResponse.statusCode) else { throw APIClientError.httpStatus(httpResponse.statusCode) }
    }

    private func requestNoContent<Body: Encodable>(_ url: URL, method: String, body: Body, bearerToken: String) async throws {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(body)
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        guard (200..<300).contains(httpResponse.statusCode) else { throw APIClientError.httpStatus(httpResponse.statusCode) }
    }

    private func execute<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data)
            throw APIClientError.server(
                code: apiError?.error,
                statusCode: httpResponse.statusCode,
                message: apiError?.message
            )
        }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}

// MARK: - Viewer account transport

private struct FirebaseTokenExchangeRequest: Encodable, Sendable {
    let idToken: String
    let username: String?
    let displayName: String?
}

private struct ViewerRefreshRequest: Encodable, Sendable {
    let refreshToken: String
}

private struct DeletionRequestPayload: Encodable, Sendable {
    let email: String
    let accountEmail: String
    let message: String?
    let confirmation: Bool
}

private struct DirectAccountDeletionRequest: Encodable, Sendable {
    let confirmation: String
}

struct DeletionRequestResponse: Decodable, Sendable {
    let requestId: String
    let status: String
    let verificationRequired: Bool
}

struct CommentListResponse: Decodable, Sendable {
    let items: [ViewerCommentDTO]
}

struct CommentCreateResponse: Decodable, Sendable {
    let item: ViewerCommentDTO
    let message: String
}

struct ViewerBlockResponse: Decodable, Sendable {
    let item: ViewerBlockDTO
}

struct ViewerBlockListResponse: Decodable, Sendable {
    let items: [ViewerBlockDTO]
}

struct ViewerBlockDTO: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let createdAt: String
    let viewer: BlockedViewerDTO?
}

struct BlockedViewerDTO: Decodable, Sendable, Equatable {
    let id: String
    let username: String
    let displayName: String
}

struct ViewerCommentDTO: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let contentId: String
    let authorName: String
    let text: String
    let status: String?
    let createdAt: String
    let updatedAt: String
}

enum CommentReportReason: String, Encodable, CaseIterable, Identifiable, Sendable {
    case spam, abuse, hate, sexual, copyright, other

    var id: String { rawValue }
    var title: String {
        switch self {
        case .spam: return "Спам"
        case .abuse: return "Оскорбление"
        case .hate: return "Язык ненависти"
        case .sexual: return "Неприемлемый контент"
        case .copyright: return "Нарушение прав"
        case .other: return "Другое"
        }
    }
}

private struct CommentCreateRequest: Encodable, Sendable { let text: String }
private struct CommentReportRequest: Encodable, Sendable { let reason: CommentReportReason }
private struct EmptyRequest: Encodable, Sendable {}
private struct CommunityRulesAcceptanceRequest: Encodable, Sendable {
    let version: String
    let accepted: Bool
}

struct ViewerRegistrationResponse: Decodable, Sendable {
    let status: String
    let message: String
}

struct ViewerSessionResponse: Decodable, Sendable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let expiresIn: Int
    let refreshExpiresIn: Int
    let viewer: ViewerDTO
}

struct ViewerMeResponse: Decodable, Sendable {
    let viewer: ViewerDTO
}

struct ViewerDTO: Decodable, Sendable, Equatable {
    let id: String
    let email: String
    let username: String
    let displayName: String
    let status: String
    let createdAt: String?
}

// MARK: - Protected playback transport

private struct PlaybackSessionRequest: Encodable, Sendable {
    let contentId: String
}

struct PlaybackSessionResponse: Decodable, Sendable {
    let sessionId: String
    let expiresIn: Int
    let manifestUrl: String

    /// The service returns a path such as `/v1/playback/<short-lived-token>/master.m3u8`.
    /// Reject anything except a same-origin gateway path before AVPlayer sees it.
    func resolvedManifestURL(baseURL: URL) -> URL? {
        guard manifestUrl.hasPrefix("/v1/playback/"),
              !manifestUrl.contains(".."),
              let components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false),
              let scheme = components.scheme,
              let host = components.host else { return nil }

        var gateway = URLComponents()
        gateway.scheme = scheme
        gateway.host = host
        gateway.port = components.port
        gateway.path = manifestUrl
        return gateway.url
    }
}

struct PlaybackEventRequest: Encodable, Sendable {
    let contentId: String
    let sessionId: String
    let event: String
    let positionMs: Int?
    let errorCode: String?

    init(contentId: String, sessionId: String, event: String, positionMs: Int? = nil, errorCode: String? = nil) {
        self.contentId = contentId
        self.sessionId = sessionId
        self.event = event
        self.positionMs = positionMs
        self.errorCode = errorCode
    }
}

private struct PlaybackEventAcceptance: Decodable, Sendable {
    let accepted: Bool
}

private struct APIErrorResponse: Decodable, Sendable {
    let error: String?
    let message: String?
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

// MARK: - Public catalog transport

/// DTOs intentionally mirror only the unauthenticated catalog endpoints.
/// They do not carry playback, purchase, account or entitlement information.
struct CatalogResponseDTO: Decodable, Sendable {
    let items: [CatalogContentDTO]
}

struct CatalogHomeDTO: Decodable, Sendable {
    let hero: CatalogContentDTO?
    let shelves: [CatalogShelfDTO]
    let items: [CatalogContentDTO]
}

struct CatalogShelfDTO: Decodable, Sendable {
    let id: String
    let title: String
    let items: [CatalogContentDTO]
}

struct CatalogContentDTO: Decodable, Sendable {
    let id: String
    let title: String
    let kind: String
    let genre: String
    let synopsis: String
    let status: String
    let access: String
    let episodes: Int
    let createdAt: String?

    var isPublished: Bool {
        status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "published"
    }
}

// MARK: - Domain catalog

struct CatalogHome: Sendable {
    let hero: CatalogItem?
    let shelves: [CatalogShelf]
    let items: [CatalogItem]
}

struct CatalogShelf: Identifiable, Sendable {
    let id: String
    let title: String
    let items: [CatalogItem]
}

actor CatalogRepository {
    private let api: APIClient

    init(api: APIClient = APIClient()) {
        self.api = api
    }

    func loadHome() async throws -> CatalogHome {
        let response = try await api.catalogHome()
        let visibleItems = Self.mapPublished(response.items)
        let hero = response.hero.flatMap { $0.isPublished ? CatalogItem(api: $0) : nil }
            ?? visibleItems.first
        let shelves = response.shelves.map { shelf in
            CatalogShelf(id: shelf.id, title: shelf.title, items: Self.mapPublished(shelf.items))
        }.filter { !$0.items.isEmpty }

        return CatalogHome(hero: hero, shelves: shelves, items: visibleItems)
    }

    func loadCatalog() async throws -> [CatalogItem] {
        let response = try await api.catalog()
        return Self.mapPublished(response.items)
    }

    static func demoHome() -> CatalogHome {
        CatalogHome(
            hero: CatalogFixtures.featured,
            shelves: [CatalogShelf(id: "demo-originals", title: "SakhaTube Original", items: CatalogFixtures.titles)],
            items: CatalogFixtures.titles
        )
    }

    static func demoCatalog() -> [CatalogItem] {
        CatalogFixtures.titles
    }

    private static func mapPublished(_ items: [CatalogContentDTO]) -> [CatalogItem] {
        items.compactMap { item in
            guard item.isPublished else { return nil }
            return CatalogItem(api: item)
        }
    }
}
