import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var catalog: CatalogStore
    @State private var selectedCategory = "Все"

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                Group {
                    switch catalog.homeState {
                    case .idle, .loading:
                        loadingState
                    case .empty:
                        emptyState
                    case .failed(let message):
                        errorState(message)
                    case .loaded(let home):
                        homeContent(home)
                    }
                }
                .padding(.bottom, 36)
            }
            .background(AppTheme.background)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Text("SakhaTube")
                        .font(.headline.weight(.black))
                        .tracking(-0.4)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { session.selectedTab = .profile } label: {
                        Image(systemName: "bell")
                            .font(.body.weight(.semibold))
                    }
                    .accessibilityLabel("Уведомления")
                }
            }
        }
        .task {
            await catalog.loadHomeIfNeeded()
        }
        .refreshable {
            await catalog.loadHome()
        }
    }

    private func homeContent(_ home: CatalogHome) -> some View {
        let categories = ["Все"] + Array(Set(home.items.map(\.genre))).sorted()
        let visibleItems = home.items.filter { selectedCategory == "Все" || $0.genre == selectedCategory }
        let continuation = visibleItems.dropFirst().first ?? visibleItems.first

        return VStack(spacing: 27) {
            if let hero = home.hero {
                heroCard(item: hero)
            }
            categoriesSection(categories: categories)
            if let continuation {
                continueSection(item: continuation)
            }
            shelfSections(home.shelves, selectedCategory: selectedCategory)
        }
    }

    private var loadingState: some View {
        VStack(spacing: 14) {
            ProgressView()
                .controlSize(.large)
                .tint(AppTheme.primary)
            Text("Загружаем витрину")
                .font(.headline.weight(.semibold))
            Text("Покажем только опубликованные материалы.")
                .font(.subheadline)
                .foregroundStyle(AppTheme.secondaryText)
        }
        .frame(maxWidth: .infinity, minHeight: 360)
        .padding(AppTheme.pagePadding)
    }

    private var emptyState: some View {
        ContentUnavailableView(
            "Витрина пока пуста",
            systemImage: "rectangle.stack",
            description: Text("Когда в Studio появятся опубликованные материалы, они будут видны здесь.")
        )
        .frame(maxWidth: .infinity, minHeight: 360)
        .padding(AppTheme.pagePadding)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 16) {
            ContentUnavailableView(
                "Не удалось открыть витрину",
                systemImage: "wifi.exclamationmark",
                description: Text(message)
            )
            Button("Повторить") {
                Task { await catalog.loadHome() }
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
        .padding(AppTheme.pagePadding)
    }

    private func heroCard(item: CatalogItem) -> some View {
        ZStack(alignment: .bottomLeading) {
            PosterArtwork(item: item, showsTitle: false)
                .frame(height: 430)
                .overlay(
                    LinearGradient(colors: [.clear, AppTheme.background.opacity(0.96)], startPoint: .center, endPoint: .bottom)
                )
            VStack(alignment: .leading, spacing: 13) {
                HStack(spacing: 10) {
                    Text(item.eyebrow)
                        .font(.caption.weight(.heavy))
                        .tracking(1.4)
                        .foregroundStyle(AppTheme.primary)
                    Text(item.ageRating)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white.opacity(0.82))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(.white.opacity(0.4)))
                }
                Text(item.title)
                    .font(.system(size: 42, weight: .black, design: .rounded))
                    .tracking(-1.5)
                Text(item.description)
                    .font(.body)
                    .foregroundStyle(AppTheme.secondaryText)
                    .lineLimit(2)
                Text(item.metadata)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.72))
                Button { session.play(item) } label: {
                    Label("Открыть", systemImage: "play.fill")
                }
                .buttonStyle(PrimaryButtonStyle())
                .frame(maxWidth: 210)
            }
            .padding(AppTheme.pagePadding)
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .padding(.horizontal, AppTheme.pagePadding)
        .padding(.top, 10)
    }

    private func categoriesSection(categories: [String]) -> some View {
        VStack(alignment: .leading, spacing: 13) {
            SectionTitle(title: "Выберите настроение")
                .padding(.horizontal, AppTheme.pagePadding)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 9) {
                    ForEach(categories, id: \.self) { category in
                        Button(category) { selectedCategory = category }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(selectedCategory == category ? Color.black : .white)
                            .padding(.horizontal, 15)
                            .padding(.vertical, 10)
                            .background(selectedCategory == category ? AppTheme.primary : AppTheme.surface)
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, AppTheme.pagePadding)
            }
        }
    }

    private func continueSection(item: CatalogItem) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "Продолжить просмотр", actionTitle: "Все") {
                session.selectedTab = .library
            }
            .padding(.horizontal, AppTheme.pagePadding)
            ContinueCard(item: item)
                .padding(.horizontal, AppTheme.pagePadding)
        }
    }

    private func shelfSections(_ shelves: [CatalogShelf], selectedCategory: String) -> some View {
        VStack(spacing: 27) {
            ForEach(shelves) { shelf in
                let visibleItems = shelf.items.filter { selectedCategory == "Все" || $0.genre == selectedCategory }
                if !visibleItems.isEmpty {
                    VStack(alignment: .leading, spacing: 14) {
                        SectionTitle(title: shelf.title, actionTitle: "Каталог") {
                            session.selectedTab = .catalog
                        }
                        .padding(.horizontal, AppTheme.pagePadding)
                        ScrollView(.horizontal, showsIndicators: false) {
                            LazyHStack(alignment: .top, spacing: 13) {
                                ForEach(visibleItems) { item in
                                    ContentCard(item: item)
                                }
                            }
                            .padding(.horizontal, AppTheme.pagePadding)
                        }
                    }
                }
            }
        }
    }
}

private struct ContinueCard: View {
    let item: CatalogItem
    @EnvironmentObject private var session: AppSession

    var body: some View {
        Button { session.play(item) } label: {
            HStack(spacing: 14) {
                PosterArtwork(item: item)
                    .frame(width: 92, height: 118)
                VStack(alignment: .leading, spacing: 10) {
                    Text(item.title)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.primary)
                    Text("Материал из опубликованной витрины")
                        .font(.subheadline)
                        .foregroundStyle(AppTheme.secondaryText)
                    ProgressView(value: 0.42)
                        .tint(AppTheme.primary)
                    Text("История просмотра появится после входа")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.primary)
                }
                Spacer(minLength: 0)
            }
            .padding(12)
            .background(AppTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.cornerRadius, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
