package com.chainwordgame.app

import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.ads.MobileAds
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import com.revenuecat.purchases.ui.revenuecatui.ExperimentalPreviewRevenueCatUIPurchasesAPI
import com.revenuecat.purchases.ui.revenuecatui.activity.PaywallActivityLauncher
import com.revenuecat.purchases.ui.revenuecatui.activity.PaywallResult
import com.revenuecat.purchases.ui.revenuecatui.activity.PaywallResultHandler
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.getCustomerInfoWith
import com.revenuecat.purchases.ui.revenuecatui.customercenter.ShowCustomerCenter

@OptIn(ExperimentalPreviewRevenueCatUIPurchasesAPI::class)
class MainActivity : AppCompatActivity(), PaywallResultHandler {
    private lateinit var webView: WebView
    private lateinit var paywallLauncher: PaywallActivityLauncher
    private lateinit var rewardedAds: RewardedAdsBridge
    private lateinit var privacyButton: Button
    private lateinit var consentInformation: ConsentInformation
    private var mobileAdsStarted = false
    private val customerCenter = registerForActivityResult(ShowCustomerCenter()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        paywallLauncher = PaywallActivityLauncher(this, this)

        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(5, 8, 13))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            webViewClient = WebViewClient()
            loadUrl("file:///android_asset/web/index.html")
        }
        rewardedAds = RewardedAdsBridge(this, webView)
        webView.addJavascriptInterface(rewardedAds, "ChainNativeAds")

        val proButton = Button(this).apply {
            text = "PRO"
            textSize = 11f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(210, 10, 15, 23))
            setOnClickListener { openChainPro() }
        }
        val root = FrameLayout(this)
        root.addView(webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(proButton, FrameLayout.LayoutParams(dp(64), dp(48), Gravity.TOP or Gravity.END).apply {
            topMargin = dp(8)
            marginEnd = dp(12)
        })
        privacyButton = Button(this).apply {
            text = "PRIVACY"
            textSize = 9f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(220, 10, 15, 23))
            visibility = View.GONE
            setOnClickListener {
                UserMessagingPlatform.showPrivacyOptionsForm(this@MainActivity) {
                    updatePrivacyButton()
                    startAdsIfAllowed()
                }
            }
        }
        root.addView(privacyButton, FrameLayout.LayoutParams(dp(88), dp(48), Gravity.TOP or Gravity.START).apply {
            topMargin = dp(8)
            marginStart = dp(12)
        })
        setContentView(root)
        gatherConsent()
    }

    override fun onActivityResult(result: PaywallResult) {
        // RevenueCat refreshes CustomerInfo automatically after purchase or restore.
    }

    private fun openChainPro() {
        Purchases.sharedInstance.getCustomerInfoWith(
            onError = { paywallLauncher.launchIfNeeded(requiredEntitlementIdentifier = "Chain Pro") },
            onSuccess = { customerInfo ->
                if (customerInfo.entitlements["Chain Pro"]?.isActive == true) {
                    customerCenter.launch()
                } else {
                    paywallLauncher.launchIfNeeded(requiredEntitlementIdentifier = "Chain Pro")
                }
            },
        )
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private fun gatherConsent() {
        consentInformation = UserMessagingPlatform.getConsentInformation(this)
        val parameters = ConsentRequestParameters.Builder().build()
        consentInformation.requestConsentInfoUpdate(
            this,
            parameters,
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(this) {
                    updatePrivacyButton()
                    startAdsIfAllowed()
                }
                startAdsIfAllowed()
            },
            {
                updatePrivacyButton()
                startAdsIfAllowed()
            },
        )
    }

    private fun updatePrivacyButton() {
        privacyButton.visibility = if (
            consentInformation.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
        ) View.VISIBLE else View.GONE
    }

    private fun startAdsIfAllowed() {
        if (!consentInformation.canRequestAds() || mobileAdsStarted) return
        mobileAdsStarted = true
        MobileAds.initialize(this) { rewardedAds.start() }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
