import SwiftUI

/// Public comments are fetched anonymously. Posting, reporting and deletion
/// always require a verified SakhaTube viewer token; the server remains the
/// source of truth for moderation and ownership checks.
struct CommentsView: View {
    let contentId: String
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var viewerSession: ViewerSessionStore

    @State private var comments: [ViewerCommentDTO] = []
    @State private var draft = ""
    @State private var isLoading = true
    @State private var isSending = false
    @State private var message: String?
    @State private var errorMessage: String?
    @State private var reportTarget: ViewerCommentDTO?
    @State private var blockTarget: ViewerCommentDTO?
    @State private var isShowingAuth = false
    @State private var isShowingBlockedViewers = false
    @State private var isShowingCommunityRulesConsent = false
    @State private var isAcceptingCommunityRules = false
    @AppStorage("sakhatube.community-rules.accepted-version") private var acceptedCommunityRulesVersion = ""

    private let api = APIClient()
    private let communityRulesVersion = "2026-07-16"

    private var hasAcceptedCommunityRules: Bool {
        acceptedCommunityRulesVersion == communityRulesVersion
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && comments.isEmpty {
                    ProgressView("Загружаем комментарии…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if comments.isEmpty {
                    ContentUnavailableView(
                        "Комментариев пока нет",
                        systemImage: "text.bubble",
                        description: Text("Начни разговор — после проверки комментарий увидят зрители.")
                    )
                } else {
                    List {
                        if let message { Text(message).foregroundStyle(.green).font(.footnote) }
                        if let errorMessage { Text(errorMessage).foregroundStyle(.red).font(.footnote) }
                        ForEach(comments) { comment in
                            CommentRow(
                                comment: comment,
                                canDelete: canDelete(comment),
                                canBlock: canBlock(comment),
                                onReport: { reportTarget = comment },
                                onDelete: { Task { await delete(comment) } },
                                onBlock: { blockTarget = comment }
                            )
                            .listRowBackground(AppTheme.surface)
                        }
                    }
                    .scrollContentBackground(.hidden)
                    .refreshable { await load() }
                }
            }
            .background(AppTheme.background)
            .safeAreaInset(edge: .bottom) { composer }
            .navigationTitle("Комментарии")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        isShowingBlockedViewers = true
                    } label: {
                        Image(systemName: "person.crop.circle.badge.xmark")
                    }
                    .accessibilityLabel("Заблокированные пользователи")
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Готово") { dismiss() } }
            }
        }
        .task { await load() }
        .sheet(isPresented: $isShowingAuth) { ViewerAuthView().environmentObject(viewerSession) }
        .sheet(isPresented: $isShowingBlockedViewers) {
            BlockedViewersView(api: api)
                .environmentObject(viewerSession)
        }
        .sheet(isPresented: $isShowingCommunityRulesConsent) {
            CommunityRulesConsentView(isAccepting: isAcceptingCommunityRules) {
                Task { await acceptCommunityRulesAndPublish() }
            }
            .presentationDetents([.height(330)])
            .presentationDragIndicator(.visible)
        }
        .confirmationDialog("Пожаловаться", isPresented: Binding(get: { reportTarget != nil }, set: { if !$0 { reportTarget = nil } })) {
            ForEach(CommentReportReason.allCases) { reason in
                Button(reason.title, role: reason == .other ? nil : .destructive) {
                    if let reportTarget { Task { await report(reportTarget, reason: reason) } }
                }
            }
            Button("Отмена", role: .cancel) { reportTarget = nil }
        } message: {
            Text("Жалоба будет отправлена модерации.")
        }
        .confirmationDialog("Заблокировать пользователя?", isPresented: Binding(get: { blockTarget != nil }, set: { if !$0 { blockTarget = nil } })) {
            Button("Заблокировать", role: .destructive) {
                if let blockTarget { Task { await blockAuthor(of: blockTarget) } }
            }
            Button("Отмена", role: .cancel) { blockTarget = nil }
        } message: {
            Text("Его одобренные комментарии больше не будут показываться тебе. Разблокировать можно в этом же разделе.")
        }
    }

    @ViewBuilder
    private var composer: some View {
        VStack(spacing: 8) {
            if viewerSession.viewer == nil {
                Button { isShowingAuth = true } label: {
                    Label("Войти, чтобы написать комментарий", systemImage: "person.badge.key")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.primary)
            } else {
                HStack(alignment: .bottom, spacing: 10) {
                    TextField("Написать комментарий", text: $draft, axis: .vertical)
                        .lineLimit(1...4)
                        .textInputAutocapitalization(.sentences)
                        .padding(10)
                        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    Button {
                        Task { await send() }
                    } label: {
                        if isSending { ProgressView().tint(.black) }
                        else { Image(systemName: "arrow.up") }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.primary)
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
                    .accessibilityLabel("Отправить комментарий")
                }
                Text("Комментарий появится после проверки модератором.")
                    .font(.caption)
                    .foregroundStyle(AppTheme.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if !hasAcceptedCommunityRules {
                    Text("Перед первой публикацией нужно принять правила сообщества.")
                        .font(.caption2)
                        .foregroundStyle(AppTheme.secondaryText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(.horizontal, AppTheme.pagePadding)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }

    private func canDelete(_ comment: ViewerCommentDTO) -> Bool {
        guard let viewer = viewerSession.viewer else { return false }
        return comment.authorName == viewer.displayName
    }

    private func canBlock(_ comment: ViewerCommentDTO) -> Bool {
        viewerSession.viewer != nil && comment.status == "approved" && !canDelete(comment)
    }

    private func load() async {
        isLoading = comments.isEmpty
        defer { isLoading = false }
        do {
            comments = try await api.comments(contentId: contentId).items
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func send() async {
        guard let token = viewerSession.accessTokenForAuthenticatedRequest else {
            isShowingAuth = true
            return
        }
        guard hasAcceptedCommunityRules else {
            isShowingCommunityRulesConsent = true
            return
        }
        await publishComment(using: token)
    }

    private func publishComment(using existingToken: String? = nil) async {
        guard let token = existingToken ?? viewerSession.accessTokenForAuthenticatedRequest else {
            isShowingAuth = true
            return
        }
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isSending = true
        errorMessage = nil
        defer { isSending = false }
        do {
            let response = try await api.createComment(contentId: contentId, text: text, accessToken: token)
            comments.insert(response.item, at: 0)
            draft = ""
            message = response.message
        } catch {
            if let apiError = error as? APIClientError,
               case .server(let code, _, _) = apiError,
               code == "COMMUNITY_RULES_ACCEPTANCE_REQUIRED" {
                acceptedCommunityRulesVersion = ""
            }
            errorMessage = error.localizedDescription
        }
    }

    private func acceptCommunityRulesAndPublish() async {
        guard let token = viewerSession.accessTokenForAuthenticatedRequest else {
            isShowingCommunityRulesConsent = false
            isShowingAuth = true
            return
        }
        isAcceptingCommunityRules = true
        errorMessage = nil
        defer { isAcceptingCommunityRules = false }
        do {
            _ = try await api.acceptCommunityRules(version: communityRulesVersion, accessToken: token)
            // Cache only the exact version that the server accepted. The API
            // remains authoritative and will require consent again if needed.
            acceptedCommunityRulesVersion = communityRulesVersion
            isShowingCommunityRulesConsent = false
            await publishComment(using: token)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func report(_ comment: ViewerCommentDTO, reason: CommentReportReason) async {
        defer { reportTarget = nil }
        guard let token = viewerSession.accessTokenForAuthenticatedRequest else {
            isShowingAuth = true
            return
        }
        do {
            try await api.reportComment(id: comment.id, reason: reason, accessToken: token)
            message = "Жалоба отправлена модерации."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ comment: ViewerCommentDTO) async {
        guard let token = viewerSession.accessTokenForAuthenticatedRequest else {
            isShowingAuth = true
            return
        }
        do {
            try await api.deleteComment(id: comment.id, accessToken: token)
            comments.removeAll { $0.id == comment.id }
            message = "Комментарий удалён."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func blockAuthor(of comment: ViewerCommentDTO) async {
        defer { blockTarget = nil }
        guard let token = viewerSession.accessTokenForAuthenticatedRequest else {
            isShowingAuth = true
            return
        }
        do {
            let response = try await api.blockCommentAuthor(id: comment.id, accessToken: token)
            comments.removeAll { $0.authorName == comment.authorName }
            let name = response.item.viewer?.displayName ?? comment.authorName
            message = "Пользователь \(name) заблокирован."
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CommunityRulesConsentView: View {
    let isAccepting: Bool
    let onAccept: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Image(systemName: "checkmark.shield")
                .font(.title2)
                .foregroundStyle(AppTheme.primary)
            Text("Правила сообщества")
                .font(.title3.weight(.bold))
            Text("Публикуя комментарии, ты обязуешься соблюдать правила: без оскорблений, спама, угроз и нарушений чужих прав.")
                .font(.subheadline)
                .foregroundStyle(AppTheme.secondaryText)
            Link("Открыть правила сообщества", destination: AppConfiguration.apiBaseURL.appending(path: "community-rules"))
                .font(.subheadline.weight(.semibold))
            HStack {
                Button("Не сейчас") { dismiss() }
                    .buttonStyle(.bordered)
                Spacer()
                Button(action: onAccept) {
                    if isAccepting { ProgressView().tint(.black) }
                    else { Text("Принимаю") }
                }
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.primary)
                    .disabled(isAccepting)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.background)
    }
}

private struct CommentRow: View {
    let comment: ViewerCommentDTO
    let canDelete: Bool
    let canBlock: Bool
    let onReport: () -> Void
    let onDelete: () -> Void
    let onBlock: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(comment.authorName).font(.subheadline.weight(.bold))
                Spacer()
                Menu {
                    if canDelete { Button("Удалить", role: .destructive, action: onDelete) }
                    else {
                        Button("Пожаловаться", role: .destructive, action: onReport)
                        if canBlock { Button("Заблокировать пользователя", role: .destructive, action: onBlock) }
                    }
                } label: {
                    Image(systemName: "ellipsis").foregroundStyle(AppTheme.secondaryText)
                }
                .accessibilityLabel(canDelete ? "Удалить комментарий" : "Действия с комментарием")
            }
            Text(comment.text).font(.body)
            HStack(spacing: 6) {
                Text(comment.createdAt.formattedCommentDate)
                if comment.status == "pending" { Text("На модерации").foregroundStyle(.orange) }
            }
            .font(.caption)
            .foregroundStyle(AppTheme.secondaryText)
        }
        .padding(.vertical, 6)
    }
}

private struct BlockedViewersView: View {
    let api: APIClient
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var viewerSession: ViewerSessionStore

    @State private var blocks: [ViewerBlockDTO] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if viewerSession.viewer == nil {
                    ContentUnavailableView(
                        "Войди в аккаунт",
                        systemImage: "person.badge.key",
                        description: Text("Список блокировок доступен только владельцу аккаунта."))
                } else if isLoading {
                    ProgressView("Загружаем список…")
                } else if blocks.isEmpty {
                    ContentUnavailableView(
                        "Заблокированных нет",
                        systemImage: "person.crop.circle.badge.checkmark",
                        description: Text("Здесь появятся пользователи, чьи комментарии ты скрыл."))
                } else {
                    List {
                        if let errorMessage { Text(errorMessage).foregroundStyle(.red).font(.footnote) }
                        ForEach(blocks) { block in
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(block.viewer?.displayName ?? "Пользователь")
                                        .font(.body.weight(.semibold))
                                    if let username = block.viewer?.username {
                                        Text("@\(username)").font(.caption).foregroundStyle(AppTheme.secondaryText)
                                    }
                                }
                                Spacer()
                                Button("Разблокировать") { Task { await unblock(block) } }
                                    .buttonStyle(.bordered)
                            }
                            .padding(.vertical, 3)
                            .listRowBackground(AppTheme.surface)
                        }
                    }
                    .scrollContentBackground(.hidden)
                    .refreshable { await load() }
                }
            }
            .background(AppTheme.background)
            .navigationTitle("Заблокированные")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Готово") { dismiss() } } }
        }
        .task { await load() }
    }

    private func load() async {
        guard let token = viewerSession.accessTokenForAuthenticatedRequest else {
            isLoading = false
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            blocks = try await api.viewerBlocks(accessToken: token).items
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func unblock(_ block: ViewerBlockDTO) async {
        guard let token = viewerSession.accessTokenForAuthenticatedRequest else { return }
        do {
            try await api.unblockViewer(id: block.id, accessToken: token)
            blocks.removeAll { $0.id == block.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private extension String {
    var formattedCommentDate: String {
        guard let date = ISO8601DateFormatter().date(from: self) else { return "Только что" }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
