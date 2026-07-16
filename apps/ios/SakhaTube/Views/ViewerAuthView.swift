import AuthenticationServices
import CryptoKit
import SwiftUI

struct ViewerAuthView: View {
    @EnvironmentObject private var viewerSession: ViewerSessionStore
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var username = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var message: String?
    @State private var errorMessage: String?
    @State private var appleNonce: String?

    private enum Mode: String, CaseIterable, Identifiable {
        case signIn = "Войти"
        case signUp = "Создать аккаунт"
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Действие", selection: $mode) {
                        ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }

                switch mode {
                case .signIn:
                    signInFields
                    submitButton("Войти") { await signIn() }
                    appleSignInButton
                case .signUp:
                    signUpFields
                    submitButton("Отправить письмо") { await signUp() }
                }

                if let message {
                    Section { Text(message).foregroundStyle(.green) }
                }
                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }

                Section {
                    Text("Пароль не сохраняется в приложении. Для безопасного входа приложение хранит только обновляемый токен сессии в Keychain этого устройства.")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.secondaryText)
                }
            }
            .scrollContentBackground(.hidden)
            .background(AppTheme.background)
            .navigationTitle("Аккаунт")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Готово") { dismiss() } } }
        }
    }

    private var signInFields: some View {
        Section {
            TextField("E-mail", text: $email)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.emailAddress)
                .textContentType(.username)
            SecureField("Пароль", text: $password)
                .textContentType(.password)
        }
    }

    private var appleSignInButton: some View {
        Section {
            SignInWithAppleButton(.signIn, onRequest: configureAppleRequest, onCompletion: handleAppleCompletion)
                .signInWithAppleButtonStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 48)
                .disabled(viewerSession.isWorking)
                .accessibilityLabel("Продолжить с Apple")
        }
    }

    private var signUpFields: some View {
        Section {
            TextField("Имя", text: $displayName)
                .textContentType(.nickname)
            TextField("Логин", text: $username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textContentType(.username)
            TextField("Email", text: $email)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
            SecureField("Пароль (от 12 символов)", text: $password)
                .textContentType(.newPassword)
        }
    }

    private func submitButton(_ title: String, action: @escaping () async -> Void) -> some View {
        Section {
            Button {
                Task { await action() }
            } label: {
                if viewerSession.isWorking { ProgressView().frame(maxWidth: .infinity) }
                else { Text(title).frame(maxWidth: .infinity) }
            }
            .disabled(viewerSession.isWorking)
        }
    }

    private func signIn() async {
        resetFeedback()
        do {
            try await viewerSession.login(email: email, password: password)
            dismiss()
        } catch { errorMessage = error.userFacingAuthMessage }
    }

    private func signUp() async {
        resetFeedback()
        do {
            let response = try await viewerSession.register(email: email, username: username, password: password, displayName: displayName.nilIfBlank)
            message = response.message
            mode = .signIn
        } catch { errorMessage = error.userFacingAuthMessage }
    }

    private func configureAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        let nonce = AppleSignInNonce.make()
        appleNonce = nonce
        request.requestedScopes = [.fullName, .email]
        request.nonce = AppleSignInNonce.sha256(nonce)
    }

    private func handleAppleCompletion(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure(let error):
            // Cancelling the system sheet is not an application failure.
            if (error as? ASAuthorizationError)?.code != .canceled {
                errorMessage = "Не удалось войти через Apple. Попробуйте ещё раз."
            }
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let nonce = appleNonce,
                  let tokenData = credential.identityToken,
                  let identityToken = String(data: tokenData, encoding: .utf8) else {
                errorMessage = "Apple не передал данные для входа. Попробуйте ещё раз."
                return
            }
            let name = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank }
                .joined(separator: " ")
                .nilIfBlank
            Task {
                resetFeedback()
                do {
                    try await viewerSession.loginWithApple(identityToken: identityToken, nonce: nonce, displayName: name)
                    dismiss()
                } catch {
                    errorMessage = error.userFacingAuthMessage
                }
            }
        }
    }

    private func resetFeedback() {
        message = nil
        errorMessage = nil
    }
}

private enum AppleSignInNonce {
    static func make() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        precondition(SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess)
        return Data(bytes).base64EncodedString()
    }

    static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

private extension Error {
    var userFacingAuthMessage: String {
        if let message = (self as? LocalizedError)?.errorDescription, !message.isEmpty { return message }
        return "Не удалось выполнить действие. Проверь подключение и попробуй ещё раз."
    }
}
