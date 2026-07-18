import AVKit
import SwiftUI

/// AVPlayer receives a manifest only after the backend grants a short-lived
/// playback session. It never guesses a media URL and has no fallback asset.
struct PlayerView: View {
    let item: CatalogItem
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var viewerSession: ViewerSessionStore
    @StateObject private var playback = ProtectedPlaybackController()
    @State private var isShowingComments = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    playerSurface
                        .frame(height: 260)
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

                    VStack(alignment: .leading, spacing: 10) {
                        Text(item.title).font(.title2.weight(.black))
                        Text(item.metadata).font(.subheadline.weight(.medium)).foregroundStyle(AppTheme.secondaryText)
                        Text(item.description).font(.body).foregroundStyle(.white.opacity(0.85))

                        if playback.canRetry {
                            Button("Повторить") { Task { await playback.start(item: item, accessToken: viewerSession.validAccessToken()) } }
                                .buttonStyle(.borderedProminent)
                                .tint(AppTheme.primary)
                        }

                        Button {
                            isShowingComments = true
                        } label: {
                            Label("Комментарии", systemImage: "text.bubble")
                                .font(.headline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .tint(AppTheme.primary)

                        Divider().overlay(AppTheme.divider)
                        Text("Эпизоды").font(.headline.weight(.bold))
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
                }
                .padding(AppTheme.pagePadding)
            }
            .background(AppTheme.background)
            .navigationTitle("Просмотр")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Готово") { dismiss() } } }
        }
        .task { await playback.start(item: item, accessToken: viewerSession.validAccessToken()) }
        .onDisappear { playback.stop() }
        .sheet(isPresented: $isShowingComments) {
            CommentsView(contentId: item.id)
                .environmentObject(viewerSession)
        }
    }

    @ViewBuilder
    private var playerSurface: some View {
        ZStack {
            if let player = playback.player {
                VideoPlayer(player: player)
            } else {
                PosterArtwork(item: item, showsTitle: false)
            }

            switch playback.state {
            case .preparing:
                statusOverlay(icon: "play.circle", title: "Подготавливаем просмотр", message: "Проверяем доступ к защищённому потоку.", progress: true)
            case .processing:
                statusOverlay(icon: "clock.arrow.circlepath", title: "Видео обрабатывается", message: "Версия для просмотра ещё не готова. Попробуй позже.")
            case .paywall:
                statusOverlay(icon: "lock.fill", title: "Нужна подписка", message: "Доступ откроется после подтверждённой покупки в приложении.")
            case .unavailable(let message):
                statusOverlay(icon: "exclamationmark.triangle", title: "Сейчас недоступно", message: message)
            case .failed(let message):
                statusOverlay(icon: "wifi.exclamationmark", title: "Не удалось начать просмотр", message: message)
            case .playing, .idle:
                EmptyView()
            }
        }
        .background(.black)
    }

    private func statusOverlay(icon: String, title: String, message: String, progress: Bool = false) -> some View {
        VStack(spacing: 10) {
            if progress { ProgressView().tint(.white) }
            Image(systemName: icon).font(.title2.weight(.bold))
            Text(title).font(.headline.weight(.bold))
            Text(message).font(.subheadline).multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.76))
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black.opacity(0.62))
        .accessibilityElement(children: .combine)
    }
}

@MainActor
private final class ProtectedPlaybackController: ObservableObject {
    enum State: Equatable {
        case idle, preparing, playing, processing, paywall, unavailable(String), failed(String)
    }

    @Published private(set) var player: AVPlayer?
    @Published private(set) var state: State = .idle

    private let api = APIClient()
    private var sessionId: String?
    private var contentId: String?
    private var accessToken: String?
    private var statusObservation: NSKeyValueObservation?
    private var timeControlObservation: NSKeyValueObservation?
    private var completionObserver: NSObjectProtocol?
    private var firstFrameReported = false
    private var bufferOpen = false

    var canRetry: Bool {
        switch state {
        case .processing, .unavailable, .failed: true
        default: false
        }
    }

    func start(item: CatalogItem, accessToken: String?) async {
        stop()
        state = .preparing
        contentId = item.id
        self.accessToken = accessToken

        do {
            let session = try await api.createPlaybackSession(contentId: item.id)
            guard let manifestURL = session.resolvedManifestURL(baseURL: AppConfiguration.apiBaseURL) else {
                state = .failed("Сервис вернул небезопасный адрес просмотра.")
                return
            }
            sessionId = session.sessionId
            await sendEvent("intent", positionMs: 0)

            let newPlayer = AVPlayer(url: manifestURL)
            player = newPlayer
            observe(newPlayer)
            state = .playing
            newPlayer.play()
        } catch {
            state = Self.presentationState(for: error)
        }
    }

    func stop() {
        if player != nil { Task { await sendEvent("pause", positionMs: currentPositionMs) } }
        player?.pause()
        player = nil
        statusObservation = nil
        timeControlObservation = nil
        if let completionObserver { NotificationCenter.default.removeObserver(completionObserver) }
        completionObserver = nil
        sessionId = nil
        contentId = nil
        firstFrameReported = false
        bufferOpen = false
    }

    private func observe(_ player: AVPlayer) {
        statusObservation = player.currentItem?.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            guard let self else { return }
            Task { @MainActor in
                if item.status == .failed {
                    self.state = .failed("Поток недоступен. Проверь подключение и повтори попытку.")
                    await self.sendEvent("error", positionMs: self.currentPositionMs, errorCode: "PLAYER_ITEM_FAILED")
                }
            }
        }
        timeControlObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] player, _ in
            guard let self else { return }
            Task { @MainActor in
                switch player.timeControlStatus {
                case .playing:
                    if !self.firstFrameReported {
                        self.firstFrameReported = true
                        await self.sendEvent("first_frame", positionMs: self.currentPositionMs)
                    }
                    if self.bufferOpen {
                        self.bufferOpen = false
                        await self.sendEvent("buffer_end", positionMs: self.currentPositionMs)
                    }
                case .waitingToPlayAtSpecifiedRate:
                    if !self.bufferOpen {
                        self.bufferOpen = true
                        await self.sendEvent("buffer_start", positionMs: self.currentPositionMs)
                    }
                case .paused: break
                @unknown default: break
                }
            }
        }
        completionObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: player.currentItem,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in await self.sendEvent("complete", positionMs: self.currentPositionMs) }
        }
    }

    private var currentPositionMs: Int {
        guard let seconds = player?.currentTime().seconds, seconds.isFinite, seconds >= 0 else { return 0 }
        return Int((seconds * 1_000).rounded())
    }

    private func sendEvent(_ event: String, positionMs: Int? = nil, errorCode: String? = nil) async {
        guard let contentId, let sessionId else { return }
        await api.reportPlaybackEvent(PlaybackEventRequest(
            contentId: contentId,
            sessionId: sessionId,
            event: event,
            positionMs: positionMs,
            errorCode: errorCode
        ), accessToken: accessToken)
    }

    private static func presentationState(for error: Error) -> State {
        guard case let APIClientError.server(code, _, message) = error else {
            return .failed((error as? LocalizedError)?.errorDescription ?? "Проверь интернет и повтори попытку.")
        }
        switch code {
        case "PLAYBACK_NOT_READY": return .processing
        case "ENTITLEMENT_REQUIRED": return .paywall
        case "NOT_FOUND", "PLAYBACK_ACCESS_REVOKED": return .unavailable(message ?? "Контент снят с показа или недоступен в твоём регионе.")
        default: return .failed(message ?? "Сервис временно недоступен.")
        }
    }
}
