import RevenueCat
import RevenueCatUI
import SwiftUI

struct MembershipView: View {
    @EnvironmentObject private var subscriptions: SubscriptionStore
    @Environment(\.dismiss) private var dismiss
    @State private var showsPaywall = false
    @State private var showsCustomerCenter = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Image(systemName: subscriptions.isChainPro ? "crown.fill" : "bolt.fill")
                    .font(.system(size: 42, weight: .bold))
                    .foregroundStyle(subscriptions.isChainPro ? .yellow : .cyan)

                Text(subscriptions.isChainPro ? "Chain Pro is active" : "Support CHAIN")
                    .font(.title2.bold())

                Text(subscriptions.isChainPro
                     ? "Thanks for backing the daily challenge. Your core game stays exactly the same."
                     : "Choose weekly, monthly, or yearly support. Daily and Practice gameplay stay open to everyone.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)

                if subscriptions.isLoading {
                    ProgressView("Checking your membership…")
                } else if subscriptions.isChainPro {
                    Button("Manage Chain Pro") { showsCustomerCenter = true }
                        .buttonStyle(.borderedProminent)
                } else {
                    Button("See Chain Pro options") { showsPaywall = true }
                        .buttonStyle(.borderedProminent)
                    Button("Restore purchases") {
                        Task { await subscriptions.restore() }
                    }
                }

                if let message = subscriptions.errorMessage {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(24)
            .navigationTitle("Chain Pro")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .task { await subscriptions.refresh() }
        .sheet(isPresented: $showsPaywall, onDismiss: refreshAfterSheet) {
            PaywallView()
        }
        .sheet(isPresented: $showsCustomerCenter, onDismiss: refreshAfterSheet) {
            CustomerCenterView()
        }
    }

    private func refreshAfterSheet() {
        Task { await subscriptions.refresh() }
    }
}

