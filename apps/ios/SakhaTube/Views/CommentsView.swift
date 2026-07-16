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
    @State private var isShowingAuth = false

    private let api = APIClient()

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
                                onReport: { reportTarget = comment },
                                onDelete: { Task { await delete(comment) } }
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
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Готово") { dismiss() } } }
        }
        .task { await load() }
        .sheet(isPresented: $isShowingAuth) { ViewerAuthView().environmentObject(viewerSession) }
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
}

private struct CommentRow: View {
    let comment: ViewerCommentDTO
    let canDelete: Bool
    let onReport: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(comment.authorName).font(.subheadline.weight(.bold))
                Spacer()
                Menu {
                    if canDelete { Button("Удалить", role: .destructive, action: onDelete) }
                    else { Button("Пожаловаться", role: .destructive, action: onReport) }
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

private extension String {
    var formattedCommentDate: String {
        guard let date = ISO8601DateFormatter().date(from: self) else { return "Только что" }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
