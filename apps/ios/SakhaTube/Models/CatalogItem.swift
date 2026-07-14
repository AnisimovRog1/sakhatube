import Foundation

struct CatalogItem: Identifiable, Hashable {
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

enum PosterGradient: CaseIterable, Hashable {
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
        CatalogItem(id: "fifth-floor", title: "Пятый этаж", eyebrow: "ПРЕМЬЕРА", description: "История, где у каждого соседа есть своя тайна.", genre: "Детектив", year: "2026", ageRating: "16+", episodeCount: 8, gradient: .rose, trailerURL: nil),
        CatalogItem(id: "north-wind", title: "Северный ветер", eyebrow: "ORIGINAL", description: "Дорога домой, которую не выбирают случайно.", genre: "Драма", year: "2025", ageRating: "12+", episodeCount: 10, gradient: .ocean, trailerURL: nil),
        CatalogItem(id: "first-light", title: "Первый свет", eyebrow: "НОВОЕ", description: "Две семьи и одно решение на всю жизнь.", genre: "Мелодрама", year: "2026", ageRating: "16+", episodeCount: 12, gradient: .ember, trailerURL: nil),
        CatalogItem(id: "parallel", title: "Параллели", eyebrow: "В ТРЕНДЕ", description: "Время не стирает поступки — оно их возвращает.", genre: "Триллер", year: "2025", ageRating: "18+", episodeCount: 6, gradient: .violet, trailerURL: nil)
    ]
}
