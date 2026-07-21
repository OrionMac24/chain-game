// This file connects rewarded game actions to native Google Mobile Ads without exposing SDK details to Phaser.
(function () {
  "use strict";

  const pendingRewards = new Map();
  let requestNumber = 0;

  // This reports whether the native app bridge or the local browser test ad can serve a reward.
  function isAvailable() {
    return Boolean(
      (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.chainAds) ||
      (window.ChainNativeAds && window.ChainNativeAds.showRewarded) ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
  }

  // This provides a clearly labeled local-only reward so revive and hint logic can be tested before AdMob IDs exist.
  function showLocalTestAd(placement) {
    return new Promise(function resolveAfterTestAd(resolve) {
      const layer = document.createElement("section");
      layer.className = "test-ad";
      layer.innerHTML = "<strong>TEST REWARDED VIDEO</strong><span>" + placement.toUpperCase() + "</span><small>Reward granted in 2 seconds</small>";
      document.body.appendChild(layer);
      window.setTimeout(function finishTestAd() {
        layer.remove();
        resolve(true);
      }, 2000);
    });
  }

  // This requests one rewarded video and resolves true only after the native SDK confirms the reward.
  function showRewarded(placement) {
    if (!isAvailable()) {
      return Promise.resolve(false);
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return showLocalTestAd(placement);
    }
    requestNumber += 1;
    const requestID = "reward-" + requestNumber + "-" + Date.now();
    return new Promise(function awaitNativeReward(resolve) {
      pendingRewards.set(requestID, resolve);
      const message = { id: requestID, placement: placement };
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.chainAds) {
        window.webkit.messageHandlers.chainAds.postMessage(message);
      } else {
        window.ChainNativeAds.showRewarded(JSON.stringify(message));
      }
    });
  }

  // Native iOS and Android call this exact method when an ad closes or grants its reward.
  function complete(requestID, earnedReward) {
    const resolve = pendingRewards.get(requestID);
    if (!resolve) {
      return;
    }
    pendingRewards.delete(requestID);
    resolve(Boolean(earnedReward));
  }

  window.ChainAds = { isAvailable: isAvailable, showRewarded: showRewarded, complete: complete };
}());

