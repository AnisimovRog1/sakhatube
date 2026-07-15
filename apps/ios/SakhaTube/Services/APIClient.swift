import Foundation

/// Базовый адрес задаётся в Build Settings через `SAKHATUBE_API_BASE_URL`.
/// Значение по умолчанию рассчитано на локальный сервер, запущенный на Mac для iOS Simulator.
enum AppConfiguration {
    private static let productionURL = URL(string: "https://sakhatube-production.up.railway.app")!

    #if DEBUG
    private static let fallbackURL = URL(string: "http://127.0.0.1:3000")!
    #else
    private static let fallbackURL = productionURL
    #endif

    static var apiBaseURL: URL {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "SakhaTubeAPIBaseURL") as? String else {
            return fallbackURL
        }

        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty,
              !value.contains("$("),
              let url = URL(string: value),
              let scheme = url.scheme?.lowercased(),
              ["http", "https"].contains(scheme) else {
            return fallbackURL
        }

        #if !DEBUG
        guard scheme == "https" else {
            return productionURL
        }
        #endif

        return url
    }
}

enum APIClientError: LocalizedError, Sendable {
    case invalidResponse
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Сервис вернул некорректный ответ."
        case .httpStatus(let statusCode):
            return "Сервис временно недоступен (код \(statusCode))."
        }
    }
}

struct HealthStatus: Decodable, Sendable {
    let ok: Bool
    let mode: String?
}

actor APIClient {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func health() async throws -> HealthStatus {
        let url = AppConfiguration.apiBaseURL.appending(path: "health")
        return try await request(url)
    }

    func catalogHome() async throws -> CatalogHomeDTO {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/catalog/home")
        return try await request(url)
    }

    func catalog() async throws -> CatalogResponseDTO {
        let url = AppConfiguration.apiBaseURL.appending(path: "v1/catalog")
        return try await request(url)
    }

    private func request<Response: Decodable>(_ url: URL) async throws -> Response {
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIClientError.httpStatus(httpResponse.statusCode)
        }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}

// MARK: - Public catalog transport

/// DTOs intentionally mirror only the unauthenticated catalog endpoints.
/// They do not carry playback, purchase, account or entitlement information.
struct CatalogResponseDTO: Decodable, Sendable {
    let items: [CatalogContentDTO]
}

struct CatalogHomeDTO: Decodable, Sendable {
    let hero: CatalogContentDTO?
    let shelves: [CatalogShelfDTO]
    let items: [CatalogContentDTO]
}

struct CatalogShelfDTO: Decodable, Sendable {
    let id: String
    let title: String
    let items: [CatalogContentDTO]
}

struct CatalogContentDTO: Decodable, Sendable {
    let id: String
    let title: String
    let kind: String
    let genre: String
    let synopsis: String
    let status: String
    let access: String
    let episodes: Int
    let createdAt: String?

    var isPublished: Bool {
        status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "published"
    }
}

// MARK: - Domain catalog

struct CatalogHome: Sendable {
    let hero: CatalogItem?
    let shelves: [CatalogShelf]
    let items: [CatalogItem]
}

struct CatalogShelf: Identifiable, Sendable {
    let id: String
    let title: String
    let items: [CatalogItem]
}

actor CatalogRepository {
    private let api: APIClient

    init(api: APIClient = APIClient()) {
        self.api = api
    }

    func loadHome() async throws -> CatalogHome {
        let response = try await api.catalogHome()
        let visibleItems = Self.mapPublished(response.items)
        let hero = response.hero.flatMap { $0.isPublished ? CatalogItem(api: $0) : nil }
            ?? visibleItems.first
        let shelves = response.shelves.map { shelf in
            CatalogShelf(id: shelf.id, title: shelf.title, items: Self.mapPublished(shelf.items))
        }.filter { !$0.items.isEmpty }

        return CatalogHome(hero: hero, shelves: shelves, items: visibleItems)
    }

    func loadCatalog() async throws -> [CatalogItem] {
        let response = try await api.catalog()
        return Self.mapPublished(response.items)
    }

    static func demoHome() -> CatalogHome {
        CatalogHome(
            hero: CatalogFixtures.featured,
            shelves: [CatalogShelf(id: "demo-originals", title: "SakhaTube Original", items: CatalogFixtures.titles)],
            items: CatalogFixtures.titles
        )
    }

    static func demoCatalog() -> [CatalogItem] {
        CatalogFixtures.titles
    }

    private static func mapPublished(_ items: [CatalogContentDTO]) -> [CatalogItem] {
        items.compactMap { item in
            guard item.isPublished else { return nil }
            return CatalogItem(api: item)
        }
    }
}
