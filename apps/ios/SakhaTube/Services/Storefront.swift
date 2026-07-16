import Foundation
import StoreKit

/// StoreKit 2 discovery and purchase transport for SakhaTube subscriptions.
///
/// This object deliberately never grants an entitlement. A verified App Store
/// transaction must be sent to the SakhaTube backend and validated there before
/// protected playback is opened. Until that server contract exists, every
/// purchase remains in `awaitingServerVerification`.
@MainActor
final class Storefront: ObservableObject {
    enum State: Equatable {
        case idle
        case loading
        case ready
        case unavailable(String)
        case purchasing(String)
        case awaitingServerVerification
        case restoredAwaitingServerVerification
        case cancelled
        case failed(String)
    }

    @Published private(set) var products: [Product] = []
    @Published private(set) var state: State = .idle

    var productIDs: [String] { AppStoreConfiguration.subscriptionProductIDs }
    var isConfigured: Bool { !productIDs.isEmpty }

    func loadOfferings() async {
        guard !productIDs.isEmpty else {
            products = []
            state = .unavailable("Планы ещё не настроены в App Store Connect.")
            return
        }

        state = .loading
        do {
            let loaded = try await Product.products(for: productIDs)
            products = loaded.sorted { $0.displayPrice < $1.displayPrice }
            state = loaded.isEmpty
                ? .unavailable("Планы пока не доступны. Проверь идентификаторы продуктов и статус в App Store Connect.")
                : .ready
        } catch {
            products = []
            state = .unavailable("Не удалось загрузить планы. Проверь подключение и повтори позже.")
        }
    }

    func purchase(_ product: Product) async {
        state = .purchasing(product.id)
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                switch verification {
                case .verified:
                    // Do not call `finish()` and do not unlock content here.
                    // The backend must first verify transaction JWS against Apple
                    // and return an active SakhaTube entitlement.
                    state = .awaitingServerVerification
                case .unverified:
                    state = .failed("Покупка не прошла проверку App Store. Деньги за доступ не списаны.")
                }
            case .pending:
                state = .unavailable("Покупка ожидает подтверждения Apple. Вернись сюда позже.")
            case .userCancelled:
                state = .cancelled
            @unknown default:
                state = .failed("Неизвестный результат покупки. Попробуй позже.")
            }
        } catch {
            state = .failed("Покупку не удалось завершить. Средства не будут списаны без подтверждения Apple.")
        }
    }

    func restorePurchases() async {
        state = .loading
        do {
            try await AppStore.sync()
            // Sync only refreshes Apple's local transaction state. Entitlements
            // remain disabled until the backend performs server-side validation.
            state = .restoredAwaitingServerVerification
        } catch {
            state = .failed("Не удалось восстановить покупки. Попробуй позже.")
        }
    }
}

enum AppStoreConfiguration {
    static var subscriptionProductIDs: [String] {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "SakhaTubeSubscriptionProductIDs") as? String else {
            return []
        }
        return raw
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && !$0.hasPrefix("REPLACE_") }
    }
}
