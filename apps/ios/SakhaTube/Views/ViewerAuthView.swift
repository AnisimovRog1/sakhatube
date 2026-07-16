import SwiftUI

struct ViewerAuthView: View {
    @EnvironmentObject private var viewerSession: ViewerSessionStore
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var verificationLink = ""
    @State private var message: String?
    @State private var errorMessage: String?

    private enum Mode: String, CaseIterable, Identifiable {
        case signIn = "Войти"
        case signUp = "Создать аккаунт"
        case verify = "Подтвердить"
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
                    credentialsFields(includeName: false)
                    submitButton("Войти") { await signIn() }
                case .signUp:
                    credentialsFields(includeName: true)
                    submitButton("Отправить письмо") { await signUp() }
                case .verify:
                    Section("Ссылка из письма") {
                        TextField("https://…/verify-email?account=…", text: $verificationLink, axis: .vertical)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                    }
                    Text("Открой письмо и вставь сюда полную ссылку подтверждения. Она одноразовая.")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.secondaryText)
                    submitButton("Подтвердить email") { await verify() }
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

    @ViewBuilder
    private func credentialsFields(includeName: Bool) -> some View {
        Section {
            if includeName {
                TextField("Имя", text: $displayName)
                    .textContentType(.nickname)
            }
            TextField("Email", text: $email)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
            SecureField("Пароль (от 12 символов)", text: $password)
                .textContentType(includeName ? .newPassword : .password)
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
            let response = try await viewerSession.register(email: email, password: password, displayName: displayName.nilIfBlank)
            message = response.message
            mode = .verify
        } catch { errorMessage = error.userFacingAuthMessage }
    }

    private func verify() async {
        resetFeedback()
        do {
            try await viewerSession.verifyEmail(link: verificationLink)
            dismiss()
        } catch { errorMessage = error.userFacingAuthMessage }
    }

    private func resetFeedback() {
        message = nil
        errorMessage = nil
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
