import AuthenticationServices
import CryptoKit
import Foundation
import Security
import WebKit

@MainActor
final class AppleAuthBridge: NSObject, WKScriptMessageHandler, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    weak var webView: WKWebView?
    private var currentNonce: String?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "chainAuth" else { return }
        let nonce = Self.randomNonce()
        currentNonce = nonce
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.email]
        request.nonce = Self.sha256(nonce)
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8),
              let nonce = currentNonce else {
            complete(error: "Apple did not return a usable identity token.")
            return
        }
        currentNonce = nil
        let script = "window.ChainOnline.completeAppleSignIn(\(Self.javascriptString(token)), \(Self.javascriptString(nonce)), null);"
        webView?.evaluateJavaScript(script)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        currentNonce = nil
        complete(error: error.localizedDescription)
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        webView?.window ?? ASPresentationAnchor()
    }

    private func complete(error: String) {
        let script = "window.ChainOnline.completeAppleSignIn(null, null, \(Self.javascriptString(error)));"
        webView?.evaluateJavaScript(script)
    }

    private static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private static func randomNonce(length: Int = 32) -> String {
        let characters = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var random: UInt8 = 0
            guard SecRandomCopyBytes(kSecRandomDefault, 1, &random) == errSecSuccess else { continue }
            if random < characters.count {
                result.append(characters[Int(random)])
                remaining -= 1
            }
        }
        return result
    }

    private static func javascriptString(_ value: String) -> String {
        let data = try? JSONEncoder().encode(value)
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
    }
}

