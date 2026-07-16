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
