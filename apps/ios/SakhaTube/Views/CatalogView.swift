import SwiftUI

struct CatalogView: View {
    @EnvironmentObject private var catalog: CatalogStore
    @State private var query = ""
    @State private var selectedGenre = "Все"

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                Group {
                    switch catalog.catalogState {
                    case .idle, .loading:
                        loadingState
                    case .empty:
                        ContentUnavailableView(
                            "Каталог пока пуст",
                            systemImage: "film.stack",
                            description: Text("В приложении появятся только опубликованные карточки из Studio.")
                        )
                        .frame(maxWidth: .infinity, minHeight: 360)
                    case .failed(let message):
                        errorState(message)
                    case .loaded(let items):
                        catalogContent(items)
                    }
                }
                .padding(AppTheme.pagePadding)
                .padding(.bottom, 28)
            }
            .background(AppTheme.background)
            .navigationTitle("Каталог")
            .searchable(text: $query, prompt: "Название или жанр")
        }
        .task {
            await catalog.loadCatalogIfNeeded()
        }
        .refreshable {
            await catalog.loadCatalog()
        }
    }

    private var loadingState: some View {
        VStack(spacing: 14) {
            ProgressView()
                .controlSize(.large)
                .tint(AppTheme.primary)
            Text("Загружаем каталог")
                .font(.headline.weight(.semibold))
        }
        .frame(maxWidth: .infinity, minHeight: 360)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 16) {
            ContentUnavailableView(
                "Каталог недоступен",
                systemImage: "wifi.exclamationmark",
                description: Text(message)
            )
            Button("Повторить") {
                Task { await catalog.loadCatalog() }
            }
            .buttonStyle(PrimaryButtonStyle())
            .frame(maxWidth: 220)

            Button("Открыть демо-каталог") {
                catalog.useDemoCatalog()
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(AppTheme.primary)
        }
        .frame(maxWidth: .infinity, minHeight: 390)
    }

    private func catalogContent(_ items: [CatalogItem]) -> some View {
        let genres = ["Все"] + Array(Set(items.map(\.genre))).sorted()
        let visibleItems = items.filter { item in
            (selectedGenre == "Все" || item.genre == selectedGenre)
                && (query.isEmpty
                    || item.title.localizedCaseInsensitiveContains(query)
                    || item.genre.localizedCaseInsensitiveContains(query))
        }

        return VStack(alignment: .leading, spacing: 18) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 9) {
                    ForEach(genres, id: \.self) { genre in
                        Button(genre) { selectedGenre = genre }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(selectedGenre == genre ? Color.black : .white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(selectedGenre == genre ? AppTheme.primary : AppTheme.surface)
                            .clipShape(Capsule())
                    }
                }
            }
            if visibleItems.isEmpty {
                ContentUnavailableView(
                    "Ничего не нашли",
                    systemImage: "magnifyingglass",
                    description: Text("Попробуйте другой запрос или жанр.")
                )
                .frame(maxWidth: .infinity)
                .padding(.top, 52)
            } else {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)],
                    spacing: 22
                ) {
                    ForEach(visibleItems) { item in
                        ContentCard(item: item, width: 150)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
    }
}
