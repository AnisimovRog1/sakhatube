import Foundation
import Security

/// Minimal boundary for the public viewer auth API. It makes token renewal an
/// additive server feature: the app does not invent refresh tokens or pretend
/// that an expired access token is a persistent sign-in.
protocol ViewerAuthServing: Sendable {
    func registerViewer(email: String, username: String, password: String, displayName: String?) async throws -> ViewerRegistrationResponse
    func verifyViewerEmail(accountId: String, token: String) async throws -> ViewerSessionResponse
    func loginViewer(login: String, password: String) async throws -> ViewerSessionResponse
    func viewerMe(accessToken: String) async throws -> ViewerMeResponse
}

protocol ViewerDeletionRequesting: Sendable {
    func startDeletionRequest(email: String, accountEmail: String, message: String?) async throws -> DeletionRequestResponse
}

extension APIClient: ViewerAuthServing {}
extension APIClient: ViewerSessionRenewing {}
extension APIClient: ViewerDeletionRequesting {}

/// Contract reserved for the backend session phase. Do not enable persistence
/// until all three endpoints below exist and the server rotates/revokes refresh
/// tokens. The app stores only the refresh token in Keychain; access tokens and
/// passwords always stay in process memory.
protocol ViewerSessionRenewing: Sendable {
    func refreshViewerSession(refreshToken: String) async throws -> ViewerRefreshResponse
    func logoutViewer(accessToken: String) async throws
}

typealias ViewerRefreshResponse = ViewerSessionResponse

enum ViewerSessionContract {
    static let requiredEndpoints = [
        "POST /v1/auth/refresh { refreshToken } -> { accessToken, refreshToken, expiresIn, viewer }",
        "POST /v1/auth/logout Authorization: Bearer <accessToken> -> 204",
        "GET /v1/auth/me Authorization: Bearer <accessToken> -> { viewer }"
    ]
}

enum ViewerAuthState: Equatable {
    case guest
    case signedIn(ViewerDTO)
}

@MainActor
final class ViewerSessionStore: ObservableObject {
    @Published private(set) var state: ViewerAuthState = .guest
    @Published private(set) var isWorking = false

    private let api: any ViewerAuthServing & ViewerSessionRenewing & ViewerDeletionRequesting
    private let refreshTokens: RefreshTokenStoring
    private var accessToken: String?

    init(api: any ViewerAuthServing & ViewerSessionRenewing & ViewerDeletionRequesting = APIClient(), refreshTokens: RefreshTokenStoring = RefreshTokenKeychain()) {
        self.api = api
        self.refreshTokens = refreshTokens
    }

    var viewer: ViewerDTO? {
        guard case .signedIn(let viewer) = state else { return nil }
        return viewer
    }

    func register(email: String, username: String, password: String, displayName: String?) async throws -> ViewerRegistrationResponse {
        isWorking = true
        defer { isWorking = false }
        return try await api.registerViewer(email: email, username: username, password: password, displayName: displayName)
    }

    func verifyEmail(link: String) async throws {
        let verification = try ViewerVerificationLink(link)
        isWorking = true
        defer { isWorking = false }
        let session = try await api.verifyViewerEmail(accountId: verification.accountId, token: verification.token)
        accept(session)
    }

    func login(login: String, password: String) async throws {
        isWorking = true
        defer { isWorking = false }
        let session = try await api.loginViewer(login: login, password: password)
        accept(session)
    }

    /// Rotates the stored refresh token on every restoration. If the server
    /// rejects it, the unusable credential is removed and the app stays guest.
    func restoreSession() async {
        guard let refreshToken = refreshTokens.read() else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            let session = try await api.refreshViewerSession(refreshToken: refreshToken)
            accept(session)
        } catch {
            signOut()
        }
    }

    func signOut() {
        accessToken = nil
        refreshTokens.remove()
        state = .guest
    }

    func signOutEverywhereForThisDevice() async {
        let token = accessToken
        signOut()
        guard let token else { return }
        try? await api.logoutViewer(accessToken: token)
    }

    /// This deliberately creates only a request. It never signs the viewer out
    /// and never claims that data has been erased: the e-mail confirmation and
    /// subsequent privacy workflow are authoritative.
    func startDeletionRequest(confirmingEmail: String, message: String?) async throws -> DeletionRequestResponse {
        guard let viewer else { throw ViewerDeletionError.signedOut }
        let expected = viewer.email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard confirmingEmail.trimmingCharacters(in: .whitespacesAndNewlines)
            .caseInsensitiveCompare(expected) == .orderedSame else {
            throw ViewerDeletionError.emailMismatch
        }
        isWorking = true
        defer { isWorking = false }
        return try await api.startDeletionRequest(email: expected, accountEmail: expected, message: message)
    }

    private func accept(_ session: ViewerSessionResponse) {
        accessToken = session.accessToken
        state = .signedIn(session.viewer)
        refreshTokens.save(session.refreshToken)
    }
}

struct ViewerVerificationLink {
    let accountId: String
    let token: String

    init(_ rawValue: String) throws {
        guard let components = URLComponents(string: rawValue),
              components.scheme == "https",
              components.path == "/verify-email",
              let accountId = components.queryItems?.first(where: { $0.name == "account" })?.value,
              let token = components.queryItems?.first(where: { $0.name == "token" })?.value,
              !accountId.isEmpty,
              !token.isEmpty else {
            throw ViewerAuthInputError.invalidVerificationLink
        }
        self.accountId = accountId
        self.token = token
    }
}

enum ViewerAuthInputError: LocalizedError {
    case invalidVerificationLink

    var errorDescription: String? {
        switch self {
        case .invalidVerificationLink:
            return "Вставь полную ссылку из письма подтверждения."
        }
    }
}

enum ViewerDeletionError: LocalizedError {
    case signedOut
    case emailMismatch

    var errorDescription: String? {
        switch self {
        case .signedOut: return "Сначала войди в аккаунт."
        case .emailMismatch: return "Укажи e-mail текущего аккаунта для подтверждения."
        }
    }
}

protocol RefreshTokenStoring: Sendable {
    func read() -> String?
    func save(_ token: String)
    func remove()
}

/// The only persistent credential store in the iOS client. Passwords and
/// access tokens are intentionally absent from this storage.
final class RefreshTokenKeychain: RefreshTokenStoring, @unchecked Sendable {
    private let service = "com.sakhatube.app.viewer-session"
    private let account = "refresh-token"

    func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func save(_ token: String) {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        if SecItemUpdate(query as CFDictionary, attributes as CFDictionary) == errSecItemNotFound {
            var create = query
            attributes.forEach { create[$0.key] = $0.value }
            SecItemAdd(create as CFDictionary, nil)
        }
    }

    func remove() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
