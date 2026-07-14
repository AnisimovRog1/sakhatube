import SwiftUI

@MainActor
final class AppSession: ObservableObject {
    @Published var selectedTab: AppTab = .home
    @Published var selectedTitle: CatalogItem?
    @Published var isShowingPlayer = false

    func play(_ item: CatalogItem) {
        selectedTitle = item
        isShowingPlayer = true
    }
}

enum AppTab: Hashable {
    case home
    case catalog
    case forYou
    case library
    case profile

    var title: String {
        switch self {
        case .home: "Главная"
        case .catalog: "Каталог"
        case .forYou: "Для вас"
        case .library: "Моё"
        case .profile: "Профиль"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house"
        case .catalog: "square.grid.2x2"
        case .forYou: "sparkles"
        case .library: "bookmark"
        case .profile: "person"
        }
    }
}
