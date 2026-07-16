import Foundation
import FirebaseAuth
import FirebaseCore
import Security

/// Minimal boundary for the public viewer auth API. It makes token renewal an
/// additive server feature: the app does not invent refresh tokens or pretend
/// that an expired access token is a persistent sign-in.
protocol ViewerAuthServing: Sendable {
    func exchangeFirebaseIDToken(_ idToken: String, username: String?, displayName: String?) async throws -> ViewerSessionResponse
    func registerPendingFirebaseUser(idToken: String, username: String, displayName: String?) async throws
    func viewerMe(accessToken: String) async throws -> ViewerMeResponse
}

protocol ViewerDeletionRequesting: Sendable {
    func startDeletionRequest(email: String, accountEmail: String, message: String?) async throws -> DeletionRequestResponse
    func deleteViewerAccount(accessToken: String) async throws
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
        "POST /v1/auth/firebase/exchange { idToken } -> SakhaTube session + public viewer profile",
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

    /// Only UI components that issue a request on behalf of the signed-in
    /// viewer may read this short-lived token. It is never persisted here.
    var accessTokenForAuthenticatedRequest: String? { accessToken }

    func register(email: String, username: String, password: String, displayName: String?) async throws -> ViewerRegistrationResponse {
        isWorking = true
        defer { isWorking = false }
        try requireFirebaseConfiguration()
        let result = try await Auth.auth().createUser(withEmail: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
        let profile = result.user.createProfileChangeRequest()
        profile.displayName = displayName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? username
        try await profile.commitChanges()
        let idToken = try await result.user.getIDToken(forcingRefresh: true)
        try await api.registerPendingFirebaseUser(idToken: idToken, username: username, displayName: displayName)
        FirebaseProfileDrafts.save(uid: result.user.uid, username: username, displayName: displayName)
        try await result.user.sendEmailVerification()
        try Auth.auth().signOut()
        return ViewerRegistrationResponse(
            status: "verification_required",
            message: "Мы отправили письмо для подтверждения e-mail. Подтверди адрес и затем войди."
        )
    }

    func login(email: String, password: String) async throws {
        isWorking = true
        defer { isWorking = false }
        try requireFirebaseConfiguration()
        let result = try await Auth.auth().signIn(withEmail: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
        try await result.user.reload()
        guard let user = Auth.auth().currentUser else { throw FirebaseViewerAuthError.missingUser }
        guard user.isEmailVerified else {
            try? await user.sendEmailVerification()
            throw FirebaseViewerAuthError.emailNotVerified
        }
        let idToken = try await user.getIDToken(forcingRefresh: true)
        let draft = FirebaseProfileDrafts.load(uid: user.uid)
        let session = try await api.exchangeFirebaseIDToken(idToken, username: draft?.username, displayName: draft?.displayName)
        accept(session)
        FirebaseProfileDrafts.remove(uid: user.uid)
    }

    /// Apple supplies the system credential; Firebase turns it into a verified
    /// identity token, and SakhaTube exchanges only that short-lived token.
    func loginWithApple(identityToken: String, nonce: String, displayName: String?) async throws {
        isWorking = true
        defer { isWorking = false }
        try requireFirebaseConfiguration()
        let credential = OAuthProvider.appleCredential(withIDToken: identityToken, rawNonce: nonce, fullName: nil)
        let result = try await Auth.auth().signIn(with: credential)
        let token = try await result.user.getIDToken(forcingRefresh: true)
        let session = try await api.exchangeFirebaseIDToken(token, username: nil, displayName: displayName)
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
        try? Auth.auth().signOut()
        state = .guest
    }

    func signOutEverywhereForThisDevice() async {
        let token = accessToken
        signOut()
        guard let token else { return }
        try? await api.logoutViewer(accessToken: token)
    }

    /// The profile has already required a typed DELETE confirmation. On success
    /// the server deletes the Firebase identity first, then local data and all
    /// sessions. Only then may this device discard its local credentials.
    func deleteAccount() async throws {
        guard let accessToken, viewer != nil else { throw ViewerDeletionError.signedOut }
        isWorking = true
        defer { isWorking = false }
        try await api.deleteViewerAccount(accessToken: accessToken)
        signOut()
    }

    private func accept(_ session: ViewerSessionResponse) {
        accessToken = session.accessToken
        state = .signedIn(session.viewer)
        refreshTokens.save(session.refreshToken)
    }
}

private extension ViewerSessionStore {
    func requireFirebaseConfiguration() throws {
        guard FirebaseApp.app() != nil else { throw FirebaseViewerAuthError.notConfigured }
    }
}

private enum FirebaseViewerAuthError: LocalizedError {
    case notConfigured
    case missingUser
    case emailNotVerified

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Вход временно недоступен: Firebase ещё не настроен."
        case .missingUser: return "Не удалось получить аккаунт после входа. Попробуй ещё раз."
        case .emailNotVerified: return "Подтверди e-mail по ссылке из письма, затем войди снова."
        }
    }
}

private struct FirebaseProfileDraft: Codable {
    let username: String
    let displayName: String?
}

private enum FirebaseProfileDrafts {
    private static let keyPrefix = "firebase-profile-draft."

    static func save(uid: String, username: String, displayName: String?) {
        let draft = FirebaseProfileDraft(username: username, displayName: displayName)
        guard let data = try? JSONEncoder().encode(draft) else { return }
        UserDefaults.standard.set(data, forKey: keyPrefix + uid)
    }

    static func load(uid: String) -> FirebaseProfileDraft? {
        guard let data = UserDefaults.standard.data(forKey: keyPrefix + uid) else { return nil }
        return try? JSONDecoder().decode(FirebaseProfileDraft.self, from: data)
    }

    static func remove(uid: String) {
        UserDefaults.standard.removeObject(forKey: keyPrefix + uid)
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

enum ViewerDeletionError: LocalizedError {
    case signedOut

    var errorDescription: String? {
        switch self {
        case .signedOut: return "Сначала войди в аккаунт."
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
