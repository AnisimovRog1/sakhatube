import Foundation

struct CatalogItem: Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let eyebrow: String
    let description: String
    let genre: String
    let year: String
    let ageRating: String
    let episodeCount: Int
    let gradient: PosterGradient
    let trailerURL: URL?

    var metadata: String {
        "\(year)  ·  \(genre)  ·  \(episodeCount) сер."
    }
}

extension CatalogItem {
    /// Public catalog data intentionally has no player URL or age rating yet.
    /// Both are set to safe presentation defaults until the media and rights APIs exist.
    init?(api: CatalogContentDTO) {
        let id = api.id.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = api.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let genre = api.genre.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty, !title.isEmpty, !genre.isEmpty else { return nil }

        self.init(
            id: id,
            title: title,
            eyebrow: "\(api.kind.presentationName) · \(api.access.presentationName)",
            description: api.synopsis.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? "Описание появится после публикации карточки."
                : api.synopsis,
            genre: genre,
            year: api.createdAt?.releaseYear ?? "Новое",
            ageRating: "16+",
            episodeCount: max(1, api.episodes),
            gradient: .forIdentifier(id),
            trailerURL: nil
        )
    }
}

private extension String {
    var presentationName: String {
        return switch lowercased() {
        case "series": "СЕРИАЛ"
        case "episode": "ЭПИЗОД"
        case "trailer": "ТРЕЙЛЕР"
        case "clip": "КЛИП"
        case "free": "БЕСПЛАТНО"
        case "subscription": "ПО ПОДПИСКЕ"
        case "purchase": "ПОКУПКА"
        default: uppercased()
        }
    }

    var releaseYear: String? {
        guard count >= 4 else { return nil }
        let prefix = prefix(4)
        return prefix.allSatisfy(\.isNumber) ? String(prefix) : nil
    }
}

enum PosterGradient: CaseIterable, Hashable, Sendable {
    case twilight
    case rose
    case ocean
    case ember
    case violet

    var colors: [String] {
        switch self {
        case .twilight: ["132A45", "222142", "170D1C"]
        case .rose: ["6A174D", "F05E93", "172B64"]
        case .ocean: ["0B3042", "176D8C", "0B1325"]
        case .ember: ["5E2115", "D46139", "1A1222"]
        case .violet: ["37205F", "7953D5", "17203C"]
        }
    }

    static func forIdentifier(_ identifier: String) -> PosterGradient {
        let palette = Self.allCases
        let index = identifier.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) % palette.count }
        return palette[index]
    }
}

enum CatalogFixtures {
    static let featured = CatalogItem(
        id: "after-midnight",
        title: "После полуночи",
        eyebrow: "НОВИНКА SAKHATUBE",
        description: "Одна ночь меняет привычный порядок города. Первые две серии доступны уже сейчас.",
        genre: "Драма",
        year: "2026",
        ageRating: "16+",
        episodeCount: 12,
        gradient: .twilight,
        trailerURL: nil
    )

    static let titles: [CatalogItem] = [
        featured,
        CatalogItem(
            id: "sintel-demo",
            title: "Sintel — тестовый показ",
            eyebrow: "CC BY · HLS DEMO",
            description: "Легальный тест потока SakhaTube. В плеере доступны 540p и 720p.",
            genre: "Анимация",
            year: "2010",
            ageRating: "12+",
            episodeCount: 1,
            gradient: .ocean,
            trailerURL: nil
        ),
        CatalogItem(id: "fifth-floor", title: "Пятый этаж", eyebrow: "ПРЕМЬЕРА", description: "История, где у каждого соседа есть своя тайна.", genre: "Детектив", year: "2026", ageRating: "16+", episodeCount: 8, gradient: .rose, trailerURL: nil),
        CatalogItem(id: "north-wind", title: "Северный ветер", eyebrow: "ORIGINAL", description: "Дорога домой, которую не выбирают случайно.", genre: "Драма", year: "2025", ageRating: "12+", episodeCount: 10, gradient: .ocean, trailerURL: nil),
        CatalogItem(id: "first-light", title: "Первый свет", eyebrow: "НОВОЕ", description: "Две семьи и одно решение на всю жизнь.", genre: "Мелодрама", year: "2026", ageRating: "16+", episodeCount: 12, gradient: .ember, trailerURL: nil),
        CatalogItem(id: "parallel", title: "Параллели", eyebrow: "В ТРЕНДЕ", description: "Время не стирает поступки — оно их возвращает.", genre: "Триллер", year: "2025", ageRating: "18+", episodeCount: 6, gradient: .violet, trailerURL: nil)
    ]
}
