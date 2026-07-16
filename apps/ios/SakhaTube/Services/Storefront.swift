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

    func purchase(_ product: Product, accessToken: String?) async {
        guard let accessToken, !accessToken.isEmpty else {
            state = .failed("Войди в SakhaTube перед оплатой: так покупка будет привязана к твоему аккаунту.")
            return
        }
        state = .purchasing(product.id)
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let transaction):
                    // Never unlock from StoreKit's device-side result. The JWS
                    // crosses an authenticated HTTPS boundary and only a future
                    // server validator may grant access. Do not finish a
                    // transaction when that server call fails.
                    do {
                        try await APIClient().submitAppleTransaction(
                            signedTransaction: verification.jwsRepresentation,
                            accessToken: accessToken
                        )
                        await transaction.finish()
                        state = .awaitingServerVerification
                    } catch {
                        state = .failed("Покупка получена App Store, но сервер её не подтвердил. Доступ не открыт. \(error.localizedDescription)")
                    }
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

    func restorePurchases(accessToken: String?) async {
        guard let accessToken, !accessToken.isEmpty else {
            state = .failed("Войди в SakhaTube, чтобы восстановить покупки для своего аккаунта.")
            return
        }
        state = .loading
        do {
            try await AppStore.sync()
            var submitted = false
            for await verification in Transaction.currentEntitlements {
                guard case .verified(let transaction) = verification else { continue }
                do {
                    try await APIClient().submitAppleTransaction(
                        signedTransaction: verification.jwsRepresentation,
                        accessToken: accessToken
                    )
                    await transaction.finish()
                    submitted = true
                } catch {
                    // Keep searching for other transactions, but do not claim
                    // that access was restored when validation is unavailable.
                    state = .failed("Не удалось проверить восстановленную покупку. Доступ не открыт. \(error.localizedDescription)")
                    return
                }
            }
            state = submitted
                ? .restoredAwaitingServerVerification
                : .unavailable("Для этого Apple ID не найдено покупок SakhaTube.")
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
