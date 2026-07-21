import GoogleMobileAds
import SwiftUI
import UserMessagingPlatform

extension Notification.Name {
    static let chainAdsReady = Notification.Name("chainAdsReady")
}

@MainActor
final class AdsConsentManager: ObservableObject {
    static let shared = AdsConsentManager()

    @Published private(set) var privacyOptionsRequired = false
    private(set) var adsReady = false
    private var isGathering = false

    private init() {}

    func gatherConsent() async {
        guard !isGathering else { return }
        isGathering = true
        let parameters = RequestParameters()

        await withCheckedContinuation { continuation in
            ConsentInformation.shared.requestConsentInfoUpdate(with: parameters) { [weak self] _ in
                Task { @MainActor in
                    guard let self else {
                        continuation.resume()
                        return
                    }
                    self.privacyOptionsRequired = ConsentInformation.shared.privacyOptionsRequirementStatus == .required
                    do {
                        try await ConsentForm.loadAndPresentIfRequired(from: nil)
                    } catch {
                        // A cached consent choice can still permit ads after a temporary form error.
                    }
                    self.privacyOptionsRequired = ConsentInformation.shared.privacyOptionsRequirementStatus == .required
                    self.startAdsIfAllowed()
                    self.isGathering = false
                    continuation.resume()
                }
            }
        }
    }

    func presentPrivacyOptions() async {
        do {
            try await ConsentForm.presentPrivacyOptionsForm(from: nil)
        } catch {
            return
        }
        privacyOptionsRequired = ConsentInformation.shared.privacyOptionsRequirementStatus == .required
        startAdsIfAllowed()
    }

    private func startAdsIfAllowed() {
        guard ConsentInformation.shared.canRequestAds, !adsReady else { return }
        MobileAds.shared.start { [weak self] _ in
            Task { @MainActor in
                guard let self, !self.adsReady else { return }
                self.adsReady = true
                NotificationCenter.default.post(name: .chainAdsReady, object: nil)
            }
        }
    }
}
