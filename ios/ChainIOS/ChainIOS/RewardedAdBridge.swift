import GoogleMobileAds
import Foundation
import WebKit

@MainActor
final class RewardedAdBridge: NSObject, WKScriptMessageHandler, FullScreenContentDelegate {
    weak var webView: WKWebView?
    private var rewardedAds: [String: RewardedAd] = [:]
    private var requestID: String?
    private var requestPlacement: String?
    private var rewardEarned = false
    private let adUnitIDs = [
        "revive": "ca-app-pub-3940256099942544/1712485313",
        "word-hint": "ca-app-pub-3940256099942544/1712485313"
    ]

    override init() {
        super.init()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(adsBecameReady),
            name: .chainAdsReady,
            object: nil
        )
        if AdsConsentManager.shared.adsReady {
            Task { await loadAllAds() }
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func adsBecameReady() {
        Task { await loadAllAds() }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "chainAds",
              let body = message.body as? [String: Any],
              let id = body["id"] as? String else {
            return
        }
        requestID = id
        let placement = body["placement"] as? String ?? "word-hint"
        requestPlacement = placement
        rewardEarned = false
        guard let rewardedAd = rewardedAds[placement] else {
            complete(id: id, earned: false)
            requestID = nil
            requestPlacement = nil
            Task { await loadAd(for: placement) }
            return
        }
        rewardedAd.present(from: nil) { [weak self] in
            self?.rewardEarned = true
            self?.complete(id: id, earned: true)
        }
    }

    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        if let requestID, !rewardEarned {
            complete(id: requestID, earned: false)
        }
        self.requestID = nil
        if let requestPlacement {
            rewardedAds[requestPlacement] = nil
            Task { await loadAd(for: requestPlacement) }
        }
        self.requestPlacement = nil
    }

    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        if let requestID {
            complete(id: requestID, earned: false)
        }
        self.requestID = nil
        if let requestPlacement {
            rewardedAds[requestPlacement] = nil
            Task { await loadAd(for: requestPlacement) }
        }
        self.requestPlacement = nil
    }

    private func loadAllAds() async {
        await loadAd(for: "revive")
        await loadAd(for: "word-hint")
    }

    private func loadAd(for placement: String) async {
        guard AdsConsentManager.shared.adsReady else {
            rewardedAds[placement] = nil
            return
        }
        do {
            guard let adUnitID = adUnitIDs[placement] else { return }
            // Google's test unit is used for both placements until the two CHAIN production IDs replace it.
            let rewardedAd = try await RewardedAd.load(
                with: adUnitID,
                request: Request()
            )
            rewardedAd.fullScreenContentDelegate = self
            rewardedAds[placement] = rewardedAd
        } catch {
            rewardedAds[placement] = nil
        }
    }

    private func complete(id: String, earned: Bool) {
        let script = "window.ChainAds.complete(\(Self.javascriptString(id)), \(earned ? "true" : "false"));"
        webView?.evaluateJavaScript(script)
    }

    private static func javascriptString(_ value: String) -> String {
        let data = try? JSONEncoder().encode(value)
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
    }
}
