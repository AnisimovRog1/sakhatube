import SwiftUI

struct CatalogView: View {
    @EnvironmentObject private var session: AppSession
    @State private var query = ""
    @State private var selectedGenre = "Все"
    private let genres = ["Все", "Драма", "Детектив", "Мелодрама", "Триллер"]

    private var titles: [CatalogItem] {
        CatalogFixtures.titles.filter { item in
            (selectedGenre == "Все" || item.genre == selectedGenre) &&
            (query.isEmpty || item.title.localizedCaseInsensitiveContains(query))
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
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
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 22) {
                        ForEach(titles) { item in
                            ContentCard(item: item, width: 150)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    if titles.isEmpty {
                        ContentUnavailableView("Ничего не нашли", systemImage: "magnifyingglass", description: Text("Попробуйте другой запрос или жанр."))
                            .frame(maxWidth: .infinity)
                            .padding(.top, 52)
                    }
                }
                .padding(AppTheme.pagePadding)
                .padding(.bottom, 28)
            }
            .background(AppTheme.background)
            .navigationTitle("Каталог")
            .searchable(text: $query, prompt: "Название, жанр, актёр")
        }
    }
}
