package com.chainwordgame.app

import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import org.json.JSONObject

class RewardedAdsBridge(
    private val activity: MainActivity,
    private val webView: WebView,
) {
    private val rewardedAds = mutableMapOf<String, RewardedAd>()
    private var started = false
    private val adUnitIDs = mapOf(
        "revive" to "ca-app-pub-3940256099942544/5224354917",
        "word-hint" to "ca-app-pub-3940256099942544/5224354917",
    )

    fun start() {
        if (started) return
        started = true
        loadAd("revive")
        loadAd("word-hint")
    }

    @JavascriptInterface
    fun showRewarded(messageJSON: String) {
        val requestID = runCatching { JSONObject(messageJSON).getString("id") }.getOrNull() ?: return
        val placement = runCatching { JSONObject(messageJSON).optString("placement", "word-hint") }.getOrDefault("word-hint")
        activity.runOnUiThread {
            val ad = rewardedAds[placement]
            if (ad == null) {
                complete(requestID, false)
                loadAd(placement)
                return@runOnUiThread
            }
            var earned = false
            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    if (!earned) complete(requestID, false)
                    rewardedAds.remove(placement)
                    loadAd(placement)
                }

                override fun onAdFailedToShowFullScreenContent(error: com.google.android.gms.ads.AdError) {
                    complete(requestID, false)
                    rewardedAds.remove(placement)
                    loadAd(placement)
                }
            }
            ad.show(activity) {
                earned = true
                complete(requestID, true)
            }
        }
    }

    private fun loadAd(placement: String) {
        if (!started) return
        val adUnitID = adUnitIDs[placement] ?: return
        RewardedAd.load(
            activity,
            adUnitID,
            AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) {
                    rewardedAds[placement] = ad
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    rewardedAds.remove(placement)
                }
            },
        )
    }

    private fun complete(requestID: String, earned: Boolean) {
        val id = JSONObject.quote(requestID)
        webView.evaluateJavascript("window.ChainAds.complete($id, $earned);", null)
    }
}
