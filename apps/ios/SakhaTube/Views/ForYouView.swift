import AVFoundation
import AVKit
import SwiftUI

/// A vertical, one-clip-at-a-time experience. The player is created only from
/// a short-lived server playback session; no media URL is embedded in the app.
struct ForYouView: View {
    @EnvironmentObject private var session: AppSession
    @State private var activeIndex = 0

    private let clips = CatalogFixtures.titles

    var body: some View {
        GeometryReader { proxy in
            TabView(selection: $activeIndex) {
                ForEach(Array(clips.enumerated()), id: \.offset) { index, item in
                    VerticalClipView(item: item, isActive: activeIndex == index)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .background(.black)
        .ignoresSafeArea(edges: .bottom)
    }
}

private struct VerticalClipView: View {
    let item: CatalogItem
    let isActive: Bool
    @EnvironmentObject private var session: AppSession
    @StateObject private var playback = VerticalClipPlaybackController()
    @State private var isLiked = false
    @State private var isSaved = false
    @State private var didStart = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            videoSurface
                .overlay(LinearGradient(colors: [.clear, .black.opacity(0.14), .black.opacity(0.92)], startPoint: .center, endPoint: .bottom))

            VStack(alignment: .leading, spacing: 9) {
                Text(item.eyebrow)
                    .font(.caption.weight(.black))
                    .tracking(1.2)
                    .foregroundStyle(AppTheme.primary)
                Text(item.title)
                    .font(.title.weight(.black))
                    .lineLimit(2)
                Text(item.description)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white.opacity(0.84))
                    .lineLimit(2)
                Button { session.play(item) } label: {
                    Label("Открыть", systemImage: "play.fill")
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.primary)
            }
            .padding(.leading, AppTheme.pagePadding)
            .padding(.trailing, 92)
            .padding(.bottom, 34)

            VStack(spacing: 18) {
                actionButton(isLiked ? "heart.fill" : "heart", isSelected: isLiked, title: "Нравится") { isLiked.toggle() }
                actionButton(isSaved ? "bookmark.fill" : "bookmark", isSelected: isSaved, title: "Сохранить") { isSaved.toggle() }
                ShareLink(item: item.title) {
                    Label("Поделиться", systemImage: "square.and.arrow.up")
                        .labelStyle(.iconOnly)
                }
                .buttonStyle(ClipActionButtonStyle())
                .accessibilityLabel("Поделиться")
            }
            .padding(.trailing, 18)
            .padding(.bottom, 132)
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .task(id: isActive) {
            if isActive && !didStart {
                didStart = true
                await playback.start(item: item)
            } else if isActive {
                playback.play()
            } else {
                playback.pause()
            }
        }
        .onDisappear { playback.stop() }
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var videoSurface: some View {
        ZStack {
            PosterArtwork(item: item, showsTitle: false)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if let player = playback.player {
                VideoPlayer(player: player)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
            }
            if playback.isLoading {
                ProgressView("Подготавливаем клип")
                    .tint(.white)
                    .foregroundStyle(.white)
                    .padding(16)
                    .background(.black.opacity(0.45), in: Capsule())
            }
            if let message = playback.errorMessage {
                VStack(spacing: 8) {
                    Image(systemName: "wifi.exclamationmark")
                    Text(message).multilineTextAlignment(.center)
                    Button("Повторить") { Task { await playback.start(item: item) } }
                }
                .font(.subheadline.weight(.semibold))
                .padding(20)
                .background(.black.opacity(0.58), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
        .background(.black)
    }

    private func actionButton(_ icon: String, isSelected: Bool, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon).labelStyle(.iconOnly)
        }
        .buttonStyle(ClipActionButtonStyle(isSelected: isSelected))
        .accessibilityLabel(title)
    }
}

private struct ClipActionButtonStyle: ButtonStyle {
    var isSelected = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title3.weight(.bold))
            .foregroundStyle(isSelected ? .pink : .white)
            .frame(width: 48, height: 48)
            .background(.black.opacity(configuration.isPressed ? 0.72 : 0.42), in: Circle())
            .overlay(Circle().stroke(.white.opacity(0.2), lineWidth: 1))
            .scaleEffect(configuration.isPressed ? 0.92 : 1)
    }
}

@MainActor
private final class VerticalClipPlaybackController: ObservableObject {
    @Published private(set) var player: AVPlayer?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private let api = APIClient()

    func start(item: CatalogItem) async {
        stop()
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let session = try await api.createPlaybackSession(contentId: item.id)
            guard let url = session.resolvedManifestURL(baseURL: AppConfiguration.apiBaseURL) else {
                errorMessage = "Не удалось безопасно открыть клип."
                return
            }
            let next = AVPlayer(url: url)
            next.actionAtItemEnd = .none
            player = next
            next.play()
        } catch {
            errorMessage = "Клип пока недоступен. Проверь подключение и повтори попытку."
        }
    }

    func play() { player?.play() }
    func pause() { player?.pause() }

    func stop() {
        player?.pause()
        player = nil
        isLoading = false
    }
}
