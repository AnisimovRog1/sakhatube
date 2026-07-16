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

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Сервис вернул некорректный ответ."
        case .httpStatus(let statusCode):
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

    /// Passwords are supplied only for this HTTPS request and are never persisted
    /// by the client. The server deliberately returns a generic registration
    /// response to avoid revealing whether an email already has an account.
    func registerViewer(email: String, password: String, displayName: String?) async throws -> ViewerRegistrationResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/auth/register")
        return try await request(
            url,
            method: "POST",
            body: ViewerRegistrationRequest(email: email, password: password, displayName: displayName)
        )
    }

    func verifyViewerEmail(accountId: String, token: String) async throws -> ViewerSessionResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/auth/verify-email")
        return try await request(url, method: "POST", body: ViewerEmailVerificationRequest(accountId: accountId, token: token))
    }

    func loginViewer(email: String, password: String) async throws -> ViewerSessionResponse {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/auth/login")
        return try await request(url, method: "POST", body: ViewerLoginRequest(email: email, password: password))
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

    private func execute<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIClientError.httpStatus(httpResponse.statusCode)
        }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}

// MARK: - Viewer account transport

private struct ViewerRegistrationRequest: Encodable, Sendable {
    let email: String
    let password: String
    let displayName: String?
}

private struct ViewerEmailVerificationRequest: Encodable, Sendable {
    let accountId: String
    let token: String
}

private struct ViewerLoginRequest: Encodable, Sendable {
    let email: String
    let password: String
}

private struct ViewerRefreshRequest: Encodable, Sendable {
    let refreshToken: String
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
    let displayName: String
    let emailVerifiedAt: String?
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
