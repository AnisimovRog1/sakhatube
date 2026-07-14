import SwiftUI

struct PosterArtwork: View {
    let item: CatalogItem
    var showsTitle: Bool = true

    var body: some View {
        LinearGradient(
            colors: item.gradient.colors.compactMap(Color.init(hex:)),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .overlay(alignment: .topTrailing) {
            Circle()
                .fill(.white.opacity(0.13))
                .frame(width: 92, height: 92)
                .blur(radius: 1)
                .offset(x: 24, y: -22)
        }
        .overlay(alignment: .bottomLeading) {
            if showsTitle {
                VStack(alignment: .leading, spacing: 5) {
                    Text(item.eyebrow)
                        .font(.caption2.weight(.bold))
                        .tracking(1.1)
                        .foregroundStyle(.white.opacity(0.72))
                    Text(item.title)
                        .font(.title3.weight(.black))
                        .lineLimit(2)
                        .foregroundStyle(.white)
                }
                .padding(15)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    LinearGradient(colors: [.clear, .black.opacity(0.75)], startPoint: .top, endPoint: .bottom)
                )
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.cornerRadius, style: .continuous))
    }
}

struct ContentCard: View {
    let item: CatalogItem
    var width: CGFloat = 150
    @EnvironmentObject private var session: AppSession

    var body: some View {
        Button {
            session.play(item)
        } label: {
            VStack(alignment: .leading, spacing: 9) {
                PosterArtwork(item: item)
                    .frame(width: width, height: width * 1.42)
                Text(item.title)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(item.metadata)
                    .font(.caption)
                    .foregroundStyle(AppTheme.secondaryText)
                    .lineLimit(1)
            }
            .frame(width: width, alignment: .leading)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Открыть \(item.title)")
    }
}

extension Color {
    init?(hex: String) {
        let value = UInt64(hex, radix: 16) ?? 0
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
