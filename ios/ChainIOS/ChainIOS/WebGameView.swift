import SwiftUI
import WebKit

struct WebGameView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.userContentController.add(context.coordinator.rewardedAds, name: "chainAds")
        configuration.userContentController.add(context.coordinator.appleAuth, name: "chainAuth")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        context.coordinator.rewardedAds.webView = webView
        context.coordinator.appleAuth.webView = webView
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.027, green: 0.039, blue: 0.059, alpha: 1)
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        guard let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") else {
            assertionFailure("The bundled CHAIN web game is missing.")
            return webView
        }
        webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "chainAds")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "chainAuth")
    }

    final class Coordinator {
        let rewardedAds = RewardedAdBridge()
        let appleAuth = AppleAuthBridge()
    }
}

