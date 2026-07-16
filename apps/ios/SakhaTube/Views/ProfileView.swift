import PhotosUI
import SwiftUI
import UIKit

struct ProfileView: View {
    @EnvironmentObject private var viewerSession: ViewerSessionStore
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var avatar: UIImage?
    @State private var preferredLanguage = "Русский"
    @State private var isShowingAccount = false
    @State private var isShowingDeletion = false
    @State private var isShowingSubscription = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 15) {
                        PhotosPicker(selection: $selectedPhoto, matching: .images) {
                            ZStack(alignment: .bottomTrailing) {
                                Group {
                                    if let avatar {
                                        Image(uiImage: avatar)
                                            .resizable()
                                            .scaledToFill()
                                    } else {
                                        Image(systemName: "person.fill")
                                            .font(.title2)
                                            .foregroundStyle(AppTheme.primary)
                                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                                            .background(AppTheme.primary.opacity(0.13))
                                    }
                                }
                                .frame(width: 68, height: 68)
                                .clipShape(Circle())
                                Image(systemName: "camera.fill")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(.black)
                                    .padding(6)
                                    .background(AppTheme.primary, in: Circle())
                            }
                        }
                        VStack(alignment: .leading, spacing: 5) {
                            Text(viewerSession.viewer?.displayName ?? "Гостевой режим")
                                .font(.title3.weight(.bold))
                            if let viewer = viewerSession.viewer {
                                Text("@\(viewer.username) · ID \(viewer.id)")
                                    .font(.subheadline)
                                    .foregroundStyle(AppTheme.secondaryText)
                                Text(viewer.email)
                                    .font(.subheadline)
                                    .foregroundStyle(AppTheme.secondaryText)
                            } else {
                                Text("Аватар остаётся только в текущем сеансе и не отправляется на сервер.")
                                    .font(.subheadline)
                                    .foregroundStyle(AppTheme.secondaryText)
                            }
                        }
                        Spacer()
                    }
                    .padding(.vertical, 6)
                }
                .listRowBackground(AppTheme.surface)

                Section("Доступ") {
                    if viewerSession.viewer == nil {
                        LabeledContent("Режим", value: "Гость")
                        Button("Войти или создать аккаунт") { isShowingAccount = true }
                    } else {
                        LabeledContent("Статус", value: "Email подтверждён")
                        Button("Выйти", role: .destructive) {
                            Task { await viewerSession.signOutEverywhereForThisDevice() }
                        }
                    }
                    Button("SakhaTube Plus") { isShowingSubscription = true }
                    Text("Покупки открывают доступ только после проверки на сервере.")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.secondaryText)
                }

                Section("Настройки") {
                    Picker("Язык", selection: $preferredLanguage) {
                        Text("Русский").tag("Русский")
                        Text("English").tag("English")
                        Text("Саха тыла").tag("Саха тыла")
                    }
                    NavigationLink { NotificationsView() } label: {
                        Label("Уведомления", systemImage: "bell")
                    }
                    NavigationLink { SecurityView() } label: {
                        Label("Безопасность и устройства", systemImage: "lock.shield")
                    }
                }

                Section("Конфиденциальность и данные") {
                    Link(destination: SakhaTubeLinks.privacy) {
                        Label("Политика конфиденциальности", systemImage: "hand.raised")
                    }
                    if viewerSession.viewer == nil {
                        Label("Удаление доступно после входа", systemImage: "person.crop.circle.badge.minus")
                            .foregroundStyle(AppTheme.secondaryText)
                    } else {
                        Button(role: .destructive) {
                            isShowingDeletion = true
                        } label: {
                            Label("Удалить аккаунт", systemImage: "person.crop.circle.badge.minus")
                        }
                    }
                    Text("Удаление доступно прямо в приложении после явного подтверждения. Оно необратимо: сессии, профиль и комментарии будут удалены или обезличены.")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.secondaryText)
                }

                Section("Помощь") {
                    Link(destination: SakhaTubeLinks.support) {
                        Label("Поддержка", systemImage: "questionmark.circle")
                    }
                    Link(destination: SakhaTubeLinks.terms) {
                        Label("Условия использования", systemImage: "doc.text")
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(AppTheme.background)
            .navigationTitle("Профиль")
            .sheet(isPresented: $isShowingAccount) { ViewerAuthView() }
            .sheet(isPresented: $isShowingDeletion) {
                if let viewer = viewerSession.viewer {
                    DeletionRequestView(viewer: viewer)
                }
            }
            .sheet(isPresented: $isShowingSubscription) { SubscriptionView() }
            .task(id: selectedPhoto) {
                guard let selectedPhoto,
                      let data = try? await selectedPhoto.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { return }
                avatar = image
            }
        }
    }
}

private struct DeletionRequestView: View {
    @EnvironmentObject private var viewerSession: ViewerSessionStore
    @Environment(\.dismiss) private var dismiss
    let viewer: ViewerDTO

    @State private var confirmation = ""
    @State private var successMessage: String?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Перед отправкой") {
                    Text("Это действие необратимо. Аккаунт, активные сессии и связанные комментарии будут удалены или обезличены сразу после подтверждения.")
                    TextField("Напиши DELETE для подтверждения", text: $confirmation)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    Text("Удаляется аккаунт: \(viewer.email)")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.secondaryText)
                }

                Section {
                    Button("Удалить аккаунт навсегда", role: .destructive) {
                        Task { await submit() }
                    }
                    .disabled(!canSubmit || viewerSession.isWorking)

                    if viewerSession.isWorking {
                        HStack { ProgressView(); Text("Удаляем аккаунт…") }
                    }
                    if let successMessage {
                        Text(successMessage).foregroundStyle(.green)
                    }
                    if let errorMessage {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Удаление аккаунта")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Закрыть") { dismiss() } } }
        }
    }

    private var canSubmit: Bool {
        confirmation.trimmingCharacters(in: .whitespacesAndNewlines) == "DELETE"
    }

    private func submit() async {
        errorMessage = nil
        successMessage = nil
        do {
            try await viewerSession.deleteAccount()
            successMessage = "Аккаунт удалён."
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private enum SakhaTubeLinks {
    static let privacy = URL(string: "https://sakhatube-production.up.railway.app/privacy")!
    static let terms = URL(string: "https://sakhatube-production.up.railway.app/terms")!
    static let support = URL(string: "https://sakhatube-production.up.railway.app/support")!
}

private struct NotificationsView: View {
    @State private var newEpisodes = true
    @State private var downloads = true
    @State private var service = false

    var body: some View {
        Form {
            Toggle("Новые эпизоды", isOn: $newEpisodes)
            Toggle("Загрузки", isOn: $downloads)
            Toggle("Сервисные сообщения", isOn: $service)
        }
        .navigationTitle("Уведомления")
    }
}

private struct SecurityView: View {
    var body: some View {
        ContentUnavailableView(
            "Вы в гостевом режиме",
            systemImage: "lock.shield",
            description: Text("Безопасный вход и управление устройствами появятся после подключения аккаунта. Сейчас никакие учётные данные не хранятся в приложении.")
        )
        .navigationTitle("Безопасность")
    }
}
