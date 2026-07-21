import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var subscriptions: SubscriptionStore
    @StateObject private var adsConsent = AdsConsentManager.shared
    @State private var showsMembership = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            WebGameView()

            VStack(alignment: .trailing, spacing: 8) {
                Button {
                    showsMembership = true
                } label: {
                    Image(systemName: subscriptions.isChainPro ? "crown.fill" : "person.crop.circle")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(subscriptions.isChainPro ? Color(red: 0.66, green: 1, blue: 0.24) : .white)
                        .frame(width: 44, height: 44)
                        .background(.black.opacity(0.65), in: Circle())
                        .overlay(Circle().stroke(.white.opacity(0.14)))
                }
                .accessibilityLabel(subscriptions.isChainPro ? "Manage Chain Pro" : "Open Chain Pro")

                if adsConsent.privacyOptionsRequired {
                    Button("PRIVACY") {
                        Task { await adsConsent.presentPrivacyOptions() }
                    }
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
                    .frame(width: 76, height: 44)
                    .background(.black.opacity(0.75), in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.14)))
                }
            }
            .padding(.top, 8)
            .padding(.trailing, 12)
        }
        .sheet(isPresented: $showsMembership) {
            MembershipView()
                .environmentObject(subscriptions)
        }
        .task {
            await adsConsent.gatherConsent()
        }
    }
}
