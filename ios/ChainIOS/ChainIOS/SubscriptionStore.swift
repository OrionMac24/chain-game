import Foundation
import RevenueCat

@MainActor
final class SubscriptionStore: NSObject, ObservableObject {
    @Published private(set) var customerInfo: CustomerInfo?
    @Published private(set) var offering: Offering?
    @Published private(set) var isChainPro = false
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    override init() {
        super.init()
        Purchases.shared.delegate = self
        Task { await refresh() }
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let info = Purchases.shared.customerInfo()
            async let offerings = Purchases.shared.offerings()
            let (latestInfo, latestOfferings) = try await (info, offerings)
            apply(latestInfo)
            offering = latestOfferings.current
            errorMessage = nil
        } catch {
            errorMessage = Self.friendlyMessage(for: error)
        }
    }

    func purchase(_ package: Package) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let result = try await Purchases.shared.purchase(package: package)
            if !result.userCancelled {
                apply(result.customerInfo)
                errorMessage = nil
            }
        } catch {
            errorMessage = Self.friendlyMessage(for: error)
        }
    }

    func restore() async {
        isLoading = true
        defer { isLoading = false }
        do {
            apply(try await Purchases.shared.restorePurchases())
            errorMessage = isChainPro ? nil : "No active Chain Pro purchase was found for this Apple ID."
        } catch {
            errorMessage = Self.friendlyMessage(for: error)
        }
    }

    private func apply(_ info: CustomerInfo) {
        customerInfo = info
        isChainPro = info.entitlements.all[RevenueCatConfig.entitlementID]?.isActive == true
    }

    private static func friendlyMessage(for error: Error) -> String {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain {
            return "CHAIN could not reach the App Store. Check your connection and try again."
        }
        return error.localizedDescription
    }
}

extension SubscriptionStore: PurchasesDelegate {
    nonisolated func purchases(_ purchases: Purchases, receivedUpdated customerInfo: CustomerInfo) {
        Task { @MainActor in
            apply(customerInfo)
        }
    }
}

