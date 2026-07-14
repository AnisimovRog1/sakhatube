import Foundation

/// Единственная точка для сетевых запросов приложения.
/// Публичные маршруты каталога добавляются на Railway до включения загрузки данных.
enum AppConfiguration {
    static let apiBaseURL = URL(string: "https://sakhatube-production.up.railway.app")!
}

struct HealthStatus: Decodable {
    let ok: Bool
    let mode: String?
}

actor APIClient {
    func health() async throws -> HealthStatus {
        let url = AppConfiguration.apiBaseURL.appending(path: "health")
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(HealthStatus.self, from: data)
    }
}
