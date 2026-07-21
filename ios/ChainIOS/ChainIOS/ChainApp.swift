import RevenueCat
import SwiftUI

@main
struct ChainApp: App {
    @StateObject private var subscriptions: SubscriptionStore

    init() {
        Purchases.logLevel = {
            #if DEBUG
            return .debug
            #else
            return .warn
            #endif
        }()
        Purchases.configure(withAPIKey: RevenueCatConfig.apiKey)
        _subscriptions = StateObject(wrappedValue: SubscriptionStore())
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(subscriptions)
                .preferredColorScheme(.dark)
        }
    }
}
