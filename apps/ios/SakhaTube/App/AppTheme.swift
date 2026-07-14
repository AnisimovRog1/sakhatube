import SwiftUI

enum AppTheme {
    static let background = Color(red: 0.035, green: 0.043, blue: 0.063)
    static let surface = Color(red: 0.090, green: 0.106, blue: 0.145)
    static let elevatedSurface = Color(red: 0.125, green: 0.145, blue: 0.190)
    static let primary = Color(red: 0.36, green: 0.62, blue: 1.0)
    static let secondaryText = Color(red: 0.66, green: 0.70, blue: 0.80)
    static let divider = Color.white.opacity(0.10)

    static let pagePadding: CGFloat = 20
    static let cornerRadius: CGFloat = 20
}

struct SectionTitle: View {
    let title: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.title3.weight(.bold))
            Spacer()
            if let actionTitle, let action {
                Button(action: action) {
                    HStack(spacing: 5) {
                        Text(actionTitle)
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.bold))
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.secondaryText)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .foregroundStyle(Color.black.opacity(0.9))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(AppTheme.primary.opacity(configuration.isPressed ? 0.78 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.16), value: configuration.isPressed)
    }
}
