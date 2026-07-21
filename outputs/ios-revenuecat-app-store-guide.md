# CHAIN iOS, RevenueCat, and App Store guide

The native SwiftUI shell is in `ios/ChainIOS`. It embeds the finished CHAIN web game, stores gameplay locally, and adds a native Chain Pro membership screen using RevenueCat 5.81.1.

## What is already implemented

- RevenueCat is configured once at app launch.
- The requested Test Store API key is installed in `RevenueCatConfig.swift`.
- The exact entitlement check is `customerInfo.entitlements.all["Chain Pro"]?.isActive == true`.
- Current customer information and the current offering load together.
- Purchases, cancellation, restore, connection errors, and live customer-info updates are handled.
- `PaywallView()` presents the RevenueCat paywall.
- `CustomerCenterView()` is available to active members for subscription management.
- The web game remains fully playable without Chain Pro. The membership is supporter access, not a gameplay lock.
- Phaser and all fonts are bundled locally, so the game launches without relying on a CDN.

## 1. Install Xcode and generate the project

Install the latest production Xcode from the Mac App Store, open it once, and accept its additional components. The current machine has Apple command-line tools but not the full Xcode app, so signing and archive verification must happen after that installation.

The included `project.yml` is a small, readable XcodeGen definition. It pins the Swift Package dependency to RevenueCat 5.81.1 or a compatible later 5.x release.

```bash
brew install xcodegen
cd /path/to/CHAIN/ios/ChainIOS
xcodegen generate
open ChainIOS.xcodeproj
```

If you do not want XcodeGen, create an iOS App project named `ChainIOS` in Xcode, add the files inside `ios/ChainIOS/ChainIOS`, and add the `Web` folder as a folder reference with target membership enabled.

## 2. Confirm the Swift Package in Xcode

In Xcode, open **File > Add Package Dependencies** and use:

`https://github.com/RevenueCat/purchases-ios-spm.git`

Set the dependency rule to **Up to Next Major Version** starting at **5.81.1**. Add both `RevenueCat` and `RevenueCatUI` to the CHAIN app target. The generated project already declares these products, so this step is a confirmation unless Xcode reports a package-resolution issue.

Select the CHAIN target, open **Signing & Capabilities**, and confirm **In-App Purchase** appears. The supplied XcodeGen project requests it automatically. If it is missing, click **+ Capability** and add **In-App Purchase**.

RevenueCat's official installation guide is at [Install the iOS SDK](https://www.revenuecat.com/docs/getting-started/installation/ios), and the package source is [RevenueCat purchases-ios-spm](https://github.com/RevenueCat/purchases-ios-spm).

## 3. Create the subscriptions in App Store Connect

1. Join the Apple Developer Program and accept the Paid Apps Agreement.
2. Complete tax and banking details in App Store Connect.
3. Create the bundle ID. The prepared default is `com.chainwordgame.app`, but change it in `project.yml` and Apple Developer before generating the project if that ID is unavailable.
4. Create the CHAIN app record before uploading a build. Apple documents this at [Add a new app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/).
5. Under **Monetization > Subscriptions**, create one subscription group named **Chain Pro**.
6. Add these three auto-renewable subscriptions with these exact product IDs:

   - Weekly: `weekly`
   - Monthly: `monthly`
   - Yearly: `yearly`

7. Add display names, descriptions, prices, localizations, and the review screenshot for each subscription.
8. Keep all three products in the same subscription group so one plan replaces another cleanly.

Suggested positioning: Chain Pro supports the game and can unlock optional cosmetic status. It should not make the daily board easier or give paying players a scoring advantage.

## 4. Configure RevenueCat

1. Create a CHAIN project in RevenueCat.
2. Add an Apple App Store app with the final bundle ID.
3. Connect App Store Connect credentials as prompted by RevenueCat.
4. Import `weekly`, `monthly`, and `yearly`.
5. Create an entitlement with the exact identifier `Chain Pro`. Identifiers are case-sensitive, so the space and capital letters must match the code.
6. Attach all three products to `Chain Pro`.
7. Create an offering with identifier `default` and make it current.
8. Attach the products to the standard weekly, monthly, and annual packages in that offering.
9. Build and publish a paywall for the `default` offering. The app presents it with `PaywallView()`.
10. Configure Customer Center if it is available on your RevenueCat plan. It is most useful for active or past subscribers who need to change plans, request support, or restore access. The implementation follows RevenueCat's [Customer Center for iOS](https://www.revenuecat.com/docs/tools/customer-center/customer-center-integration-ios).

RevenueCat recommends using the current offering so the app can change product presentation without an app update. See [Offerings overview](https://www.revenuecat.com/docs/offerings/overview) and [Displaying paywalls](https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls).

## 5. Replace the test key before App Store release

The requested key, `test_EzrijIthPgGccXyOJEnZreoISxW`, is a RevenueCat Test Store key. It is correctly installed for early development, but it must not be the release key for Apple subscriptions.

Before archiving:

1. Open the Apple app inside the RevenueCat dashboard.
2. Copy its public Apple SDK key.
3. Replace `RevenueCatConfig.apiKey` in `RevenueCatConfig.swift`.
4. Never place a RevenueCat secret key in the app. Only the public platform SDK key belongs in client code.

RevenueCat's configuration and entitlement pattern are covered in its [iOS quickstart](https://www.revenuecat.com/docs/getting-started/quickstart).

## 6. Test every subscription path

Run these checks on a real iPhone and in TestFlight:

- New weekly, monthly, and yearly purchase.
- User cancels the purchase sheet.
- Purchase succeeds but the network briefly disconnects.
- Restore with a purchasing Apple ID.
- Restore with no active purchase.
- Upgrade and downgrade between plans.
- Expiration and billing retry using Apple's accelerated sandbox renewals.
- Relaunch while offline after Chain Pro was previously active.
- Paywall close, Customer Center close, and customer-info refresh.
- Daily and Practice remain playable without a purchase.

Use RevenueCat debug logs only in Debug builds. The prepared app uses warning-level logs in Release.

## 7. Prepare the App Store listing

You will need:

- App name, subtitle, description, keywords, support URL, and privacy-policy URL.
- 6.7-inch iPhone screenshots at minimum, plus any other device sizes App Store Connect requests.
- App icon in the Xcode asset catalog.
- App Privacy answers. CHAIN currently keeps gameplay history and Phase 7 metrics on device. Review RevenueCat's data collection before answering the subscription-related questions.
- Age rating and content-rights answers.
- Subscription review notes explaining where the Chain Pro button appears.
- A review screenshot showing the paywall.

## 8. Upload through Xcode

1. In Xcode, select the CHAIN target, choose your Apple Developer Team, and confirm automatic signing.
2. Set the Release bundle ID to the one created in App Store Connect.
3. Increment `CURRENT_PROJECT_VERSION` for every uploaded build.
4. Select **Any iOS Device (arm64)**.
5. Choose **Product > Archive**.
6. In Organizer, choose **Distribute App > App Store Connect > Upload**.
7. Wait for processing, then assign the build to an internal TestFlight group.

Apple's current upload instructions are at [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/). TestFlight supports internal testing first and broader external beta testing after beta review. See [TestFlight](https://developer.apple.com/testflight/).

## 9. Submit for review

1. Finish all app metadata and privacy answers.
2. Select the processed build.
3. Attach all three subscriptions to the app version if App Store Connect asks.
4. Add clear review notes: “Open the profile icon at the top right, then tap See Chain Pro options.”
5. Confirm the paywall shows real localized Apple prices, not hard-coded prices.
6. Submit the subscriptions and app version together for the first review.

## Operational best practices

- Treat RevenueCat customer info as the source of truth for access.
- Check the entitlement, not a product ID, because users can move between weekly, monthly, and yearly plans.
- Do not cache a permanent `isPro` flag yourself. Refresh customer info and listen for RevenueCat delegate updates.
- Make restore visible and never require sign-in merely to restore an Apple purchase.
- Keep purchase cancellation neutral. Cancellation is not an error.
- Keep the core daily scoring fair and identical for free and Pro players.
- Add account identity with RevenueCat `logIn` only when CHAIN gains a real account system. Anonymous RevenueCat IDs are the simpler correct choice today.
