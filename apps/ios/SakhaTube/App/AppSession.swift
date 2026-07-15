import SwiftUI

enum CatalogLoadState<Value> {
    case idle
    case loading
    case loaded(Value)
    case empty
    case failed(String)
}

@MainActor
final class CatalogStore: ObservableObject {
    @Published private(set) var homeState: CatalogLoadState<CatalogHome>
    @Published private(set) var catalogState: CatalogLoadState<[CatalogItem]>

    private let repository: CatalogRepository

    init(repository: CatalogRepository = CatalogRepository(), useDemoData: Bool = AppRuntime.useDemoCatalog) {
        self.repository = repository
        if useDemoData {
            homeState = .loaded(CatalogRepository.demoHome())
            catalogState = .loaded(CatalogRepository.demoCatalog())
        } else {
            homeState = .idle
            catalogState = .idle
        }
    }

    func loadHomeIfNeeded() async {
        if case .loaded = homeState { return }
        await loadHome()
    }

    func loadCatalogIfNeeded() async {
        if case .loaded = catalogState { return }
        await loadCatalog()
    }

    func loadHome() async {
        homeState = .loading
        do {
            let home = try await repository.loadHome()
            homeState = home.items.isEmpty ? .empty : .loaded(home)
        } catch {
            homeState = .failed(error.userFacingCatalogMessage)
        }
    }

    func loadCatalog() async {
        catalogState = .loading
        do {
            let items = try await repository.loadCatalog()
            catalogState = items.isEmpty ? .empty : .loaded(items)
        } catch {
            catalogState = .failed(error.userFacingCatalogMessage)
        }
    }

    func useDemoCatalog() {
        homeState = .loaded(CatalogRepository.demoHome())
        catalogState = .loaded(CatalogRepository.demoCatalog())
    }
}

enum AppRuntime {
    static var useDemoCatalog: Bool {
        ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1"
            || ProcessInfo.processInfo.arguments.contains("-useDemoCatalog")
    }
}

private extension Error {
    var userFacingCatalogMessage: String {
        if let localized = (self as? LocalizedError)?.errorDescription, !localized.isEmpty {
            return localized
        }
        if let urlError = self as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost:
                return "Нет подключения к интернету."
            case .timedOut:
                return "Сервис отвечает слишком долго."
            default:
                return "Не удалось загрузить каталог."
            }
        }
        return "Не удалось загрузить каталог."
    }
}

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
