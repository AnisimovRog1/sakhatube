import SwiftUI

struct ForYouView: View {
    @EnvironmentObject private var session: AppSession
    @State private var activeIndex = 0

    var body: some View {
        ZStack(alignment: .topLeading) {
            TabView(selection: $activeIndex) {
                ForEach(Array(CatalogFixtures.titles.enumerated()), id: \.offset) { index, item in
                    ClipCard(item: item)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            VStack(alignment: .leading, spacing: 5) {
                Text("ДЛЯ ВАС")
                    .font(.caption.weight(.black))
                    .tracking(1.6)
                    .foregroundStyle(AppTheme.primary)
                Text("Клипы из историй, которые могут вам понравиться")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white.opacity(0.78))
            }
            .padding(.horizontal, AppTheme.pagePadding)
            .padding(.top, 16)
        }
        .background(AppTheme.background)
    }
}

private struct ClipCard: View {
    let item: CatalogItem
    @EnvironmentObject private var session: AppSession
    @State private var isLiked = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            PosterArtwork(item: item, showsTitle: false)
                .overlay(
                    LinearGradient(colors: [.clear, .black.opacity(0.88)], startPoint: .center, endPoint: .bottom)
                )
                .padding(.horizontal, 12)
                .padding(.vertical, 16)
            VStack(alignment: .leading, spacing: 11) {
                Text("СЦЕНА ИЗ «\(item.title.uppercased())»")
                    .font(.caption.weight(.heavy))
                    .tracking(1.1)
                    .foregroundStyle(AppTheme.primary)
                Text(item.title)
                    .font(.title2.weight(.black))
                Text(item.description)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.76))
                    .lineLimit(2)
                Button { session.play(item) } label: {
                    Label("Открыть сериал", systemImage: "play.fill")
                }
                .buttonStyle(PrimaryButtonStyle())
            }
            .padding(34)
            .padding(.bottom, 28)
            VStack(spacing: 20) {
                Button { isLiked.toggle() } label: {
                    Image(systemName: isLiked ? "heart.fill" : "heart")
                        .foregroundStyle(isLiked ? .pink : .white)
                }
                Button { } label: { Image(systemName: "bookmark") }
                Button { } label: { Image(systemName: "square.and.arrow.up") }
            }
            .font(.title3.weight(.semibold))
            .padding(17)
            .background(.ultraThinMaterial, in: Capsule())
            .padding(.trailing, 29)
            .padding(.bottom, 142)
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.top, 12)
    }
}
