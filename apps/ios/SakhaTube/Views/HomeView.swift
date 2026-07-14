import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var session: AppSession
    @State private var selectedCategory = "Все"
    private let categories = ["Все", "Драмы", "Детективы", "Комедии", "Документальное"]

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 27) {
                    hero
                    categoriesSection
                    continueSection
                    originalSection
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
    }

    private var hero: some View {
        let item = CatalogFixtures.featured
        return ZStack(alignment: .bottomLeading) {
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
                    Label("Смотреть", systemImage: "play.fill")
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

    private var categoriesSection: some View {
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

    private var continueSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "Продолжить просмотр", actionTitle: "Все") {
                session.selectedTab = .library
            }
            .padding(.horizontal, AppTheme.pagePadding)
            ContinueCard(item: CatalogFixtures.titles[1])
                .padding(.horizontal, AppTheme.pagePadding)
        }
    }

    private var originalSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "SakhaTube Original", actionTitle: "Каталог") {
                session.selectedTab = .catalog
            }
            .padding(.horizontal, AppTheme.pagePadding)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 13) {
                    ForEach(CatalogFixtures.titles) { item in
                        ContentCard(item: item)
                    }
                }
                .padding(.horizontal, AppTheme.pagePadding)
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
                    Text("Серия 3 из \(item.episodeCount)")
                        .font(.subheadline)
                        .foregroundStyle(AppTheme.secondaryText)
                    ProgressView(value: 0.42)
                        .tint(AppTheme.primary)
                    Text("Продолжить с 18:43")
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
