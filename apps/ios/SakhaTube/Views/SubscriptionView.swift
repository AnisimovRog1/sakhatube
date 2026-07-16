import StoreKit
import SwiftUI

/// Presentation only: no premium entitlement can be granted on-device.
struct SubscriptionView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var storefront: Storefront

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("SakhaTube Plus")
                            .font(.largeTitle.weight(.black))
                        Text("Планы и преимущества появятся здесь после настройки App Store Connect.")
                            .foregroundStyle(AppTheme.secondaryText)
                    }

                    safetyNotice

                    if storefront.products.isEmpty {
                        ContentUnavailableView {
                            Label("Планы пока недоступны", systemImage: "creditcard")
                        } description: {
                            Text("Мы подключим их после настройки App Store Connect и безопасной проверки покупок на сервере.")
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 36)
                    } else {
                        VStack(spacing: 12) {
                            ForEach(storefront.products, id: \.id) { product in
                                planRow(product)
                            }
                        }
                    }

                    Button("Восстановить покупки") {
                        Task { await storefront.restorePurchases() }
                    }
                    .frame(maxWidth: .infinity)
                    .buttonStyle(.bordered)
                    .disabled(isWorking)

                    stateMessage
                }
                .padding(AppTheme.pagePadding)
            }
            .background(AppTheme.background)
            .navigationTitle("Подписка")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Готово") { dismiss() }
                }
            }
            .task { await storefront.loadOfferings() }
        }
    }

    private var safetyNotice: some View {
        Label {
            Text("Оплата проходит через App Store. Доступ открывается только после серверной проверки покупки.")
                .font(.footnote.weight(.medium))
        } icon: {
            Image(systemName: "lock.shield.fill")
        }
        .foregroundStyle(AppTheme.secondaryText)
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func planRow(_ product: Product) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(product.displayName).font(.headline.weight(.bold))
                Spacer()
                Text(product.displayPrice).font(.title3.weight(.black)).foregroundStyle(AppTheme.primary)
            }
            Text(product.description).font(.subheadline).foregroundStyle(AppTheme.secondaryText)
            if let subscription = product.subscription {
                Text(subscription.subscriptionPeriod.localizedDescription)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.secondaryText)
            }
            Button("Выбрать") { Task { await storefront.purchase(product) } }
                .frame(maxWidth: .infinity)
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.primary)
                .disabled(isWorking)
        }
        .padding(16)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    @ViewBuilder
    private var stateMessage: some View {
        switch storefront.state {
        case .idle, .ready: EmptyView()
        case .loading:
            HStack { ProgressView(); Text("Проверяем App Store…") }.foregroundStyle(AppTheme.secondaryText)
        case .purchasing:
            HStack { ProgressView(); Text("Подтверждаем покупку…") }.foregroundStyle(AppTheme.secondaryText)
        case .awaitingServerVerification, .restoredAwaitingServerVerification:
            Text("Покупка найдена, но доступ пока не открыт: серверная проверка ещё не подключена. Не оформляй повторную покупку.")
                .font(.footnote.weight(.medium))
                .foregroundStyle(.orange)
        case .cancelled:
            Text("Покупка отменена.").font(.footnote).foregroundStyle(AppTheme.secondaryText)
        case .unavailable(let message), .failed(let message):
            Text(message).font(.footnote.weight(.medium)).foregroundStyle(.orange)
        }
    }

    private var isWorking: Bool {
        switch storefront.state {
        case .loading, .purchasing: true
        default: false
        }
    }
}

private extension Product.SubscriptionPeriod {
    var localizedDescription: String {
        switch unit {
        case .day: return "Каждые \(value) дн."
        case .week: return "Каждые \(value) нед."
        case .month: return value == 1 ? "Ежемесячно" : "Каждые \(value) мес."
        case .year: return value == 1 ? "Ежегодно" : "Каждые \(value) лет"
        @unknown default: return "Автопродление"
        }
    }
}
