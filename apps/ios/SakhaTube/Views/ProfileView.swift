import PhotosUI
import SwiftUI
import UIKit

struct ProfileView: View {
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var avatar: UIImage?
    @State private var isLoggedIn = false
    @State private var preferredLanguage = "Русский"

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
                            Text(isLoggedIn ? "Ваш профиль" : "Гость")
                                .font(.title3.weight(.bold))
                            Text(isLoggedIn ? "Синхронизация включена" : "Войдите, чтобы сохранить библиотеку")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.secondaryText)
                        }
                        Spacer()
                        Button(isLoggedIn ? "Выйти" : "Войти") { isLoggedIn.toggle() }
                            .buttonStyle(.borderedProminent)
                            .tint(AppTheme.primary)
                    }
                    .padding(.vertical, 6)
                }
                .listRowBackground(AppTheme.surface)

                Section("Подписка") {
                    LabeledContent("Тариф", value: "Бесплатный")
                    Button("Посмотреть варианты") { }
                        .foregroundStyle(AppTheme.primary)
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

                Section("Помощь") {
                    Button { } label: { Label("Поддержка", systemImage: "questionmark.circle") }
                    Button { } label: { Label("Условия и конфиденциальность", systemImage: "doc.text") }
                }
            }
            .scrollContentBackground(.hidden)
            .background(AppTheme.background)
            .navigationTitle("Профиль")
            .task(id: selectedPhoto) {
                guard let selectedPhoto,
                      let data = try? await selectedPhoto.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { return }
                avatar = image
            }
        }
    }
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
        ContentUnavailableView("Вход ещё не подключён", systemImage: "lock.shield", description: Text("После подключения защищённого входа здесь появятся устройства и управление сессиями."))
            .navigationTitle("Безопасность")
    }
}
