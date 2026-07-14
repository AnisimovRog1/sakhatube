import SwiftUI

struct LibraryView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 25) {
                    LibraryShortcut(icon: "clock.arrow.circlepath", title: "Продолжить просмотр", subtitle: "Ваши незавершённые истории") {
                        session.play(CatalogFixtures.titles[1])
                    }
                    LibraryShortcut(icon: "bookmark.fill", title: "Сохранённое", subtitle: "Добавляйте сериалы, чтобы не потерять") { }
                    LibraryShortcut(icon: "arrow.down.circle", title: "Загрузки", subtitle: "Доступны после подключения загрузок") { }
                }
                .padding(AppTheme.pagePadding)
            }
            .background(AppTheme.background)
            .navigationTitle("Моё")
        }
    }
}

private struct LibraryShortcut: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 15) {
                Image(systemName: icon)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(AppTheme.primary)
                    .frame(width: 42, height: 42)
                    .background(AppTheme.primary.opacity(0.12), in: RoundedRectangle(cornerRadius: 13))
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.headline.weight(.bold)).foregroundStyle(.primary)
                    Text(subtitle).font(.subheadline).foregroundStyle(AppTheme.secondaryText)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(AppTheme.secondaryText)
            }
            .padding(15)
            .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: AppTheme.cornerRadius, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
