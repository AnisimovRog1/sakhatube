import PhotosUI
import SwiftUI
import UIKit

struct ProfileView: View {
    @EnvironmentObject private var viewerSession: ViewerSessionStore
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var avatar: UIImage?
    @State private var preferredLanguage = "Русский"
    @State private var isShowingAccount = false

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
                            Text(viewerSession.viewer?.email ?? "Аватар остаётся только в текущем сеансе и не отправляется на сервер.")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.secondaryText)
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
                    Text("Подписки и покупки появятся только после подключения безопасной оплаты через App Store.")
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
                    Link(destination: SakhaTubeLinks.deleteAccount) {
                        Label("Удалить аккаунт", systemImage: "person.crop.circle.badge.minus")
                    }
                    Text("В гостевом режиме аккаунт не создаётся. Если вы создадите аккаунт позже, на странице удаления можно будет начать удаление аккаунта и связанных данных.")
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
            .task(id: selectedPhoto) {
                guard let selectedPhoto,
                      let data = try? await selectedPhoto.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { return }
                avatar = image
            }
        }
    }
}

private enum SakhaTubeLinks {
    static let privacy = URL(string: "https://sakhatube-production.up.railway.app/privacy")!
    static let terms = URL(string: "https://sakhatube-production.up.railway.app/terms")!
    static let support = URL(string: "https://sakhatube-production.up.railway.app/support")!
    static let deleteAccount = URL(string: "https://sakhatube-production.up.railway.app/delete-account")!
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
