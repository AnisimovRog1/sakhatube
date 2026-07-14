import AVKit
import SwiftUI

struct PlayerView: View {
    let item: CatalogItem
    @Environment(\.dismiss) private var dismiss
    @State private var player: AVPlayer?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Group {
                    if let player {
                        VideoPlayer(player: player)
                    } else {
                        PosterArtwork(item: item, showsTitle: false)
                            .overlay {
                                Image(systemName: "play.circle.fill")
                                    .font(.system(size: 58))
                                    .foregroundStyle(.white.opacity(0.92))
                            }
                    }
                }
                .frame(height: 260)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .padding(AppTheme.pagePadding)

                VStack(alignment: .leading, spacing: 12) {
                    Text(item.title)
                        .font(.title2.weight(.black))
                    Text(item.metadata)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(AppTheme.secondaryText)
                    if player == nil {
                        Label("Видео появится здесь после подключения защищённого HLS-потока.", systemImage: "checkmark.shield")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.secondaryText)
                            .padding(.top, 4)
                    }
                    Text(item.description)
                        .font(.body)
                        .foregroundStyle(.white.opacity(0.85))
                    Divider().overlay(AppTheme.divider)
                    Text("Эпизоды")
                        .font(.headline.weight(.bold))
                    ForEach(1...min(item.episodeCount, 3), id: \.self) { episode in
                        HStack {
                            Text("Серия \(episode)").font(.subheadline.weight(.semibold))
                            Spacer()
                            Text("42 мин").font(.caption).foregroundStyle(AppTheme.secondaryText)
                            Image(systemName: "play.circle").foregroundStyle(AppTheme.primary)
                        }
                        .padding(.vertical, 8)
                    }
                }
                .padding(.horizontal, AppTheme.pagePadding)
                Spacer()
            }
            .background(AppTheme.background)
            .navigationTitle("Просмотр")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Готово") { dismiss() }
                }
            }
        }
        .task {
            guard let trailerURL = item.trailerURL else { return }
            player = AVPlayer(url: trailerURL)
        }
        .onDisappear { player?.pause() }
    }
}
