# CHAIN launch guide

This is the shortest safe path from the current source package to a live leaderboard, real subscriptions, rewarded ads, TestFlight, and Google Play testing.

## 1. Values you need first

Collect these from the four dashboards. Only use public client keys in the app.

- Supabase project URL
- Supabase publishable key, sometimes labeled the anon key
- RevenueCat Apple public SDK key
- RevenueCat Google public SDK key
- AdMob iOS App ID
- AdMob iOS rewarded unit for `revive`
- AdMob Android App ID
- AdMob Android rewarded unit for `revive`
- Final Apple bundle ID and Android package name. The source currently uses `com.chainwordgame.app`

Never put a Supabase `service_role` key, Apple private key, Google service-account JSON, store password, or RevenueCat secret key in this repository.

## 2. GitHub

The connected GitHub account is `OrionMac24`. There is not yet a CHAIN repository, and this Mac does not currently have the `gh` command installed.

1. Install GitHub CLI. This adds the command used to create and publish the repository:

   ```bash
   brew install gh
   ```

2. Sign in. Choose GitHub.com, HTTPS, and browser login when prompted:

   ```bash
   gh auth login
   ```

3. In Terminal, open this project and create a private repository:

   ```bash
   cd "/Users/orion/Documents/Codex/2026-07-20/files-mentioned-by-the-user-chain"
   git init
   git add .
   git commit -m "Build CHAIN daily word game"
   gh repo create OrionMac24/chain-game --private --source=. --remote=origin --push
   ```

4. On GitHub, open the new repository, go to Settings > Pages, and set Source to GitHub Actions. The included workflow will publish the browser game and legal pages after a push to `main`.

5. GitHub Actions already checks JavaScript, 10,000 generated boards, fatal reverse collisions, and the Android debug build on pull requests.

Using the same email for GitHub and Supabase does not link their projects automatically. The repository and Supabase project still need to be selected in their dashboards.

## 3. Supabase accounts and live leaderboard

1. Create or open the CHAIN project in [Supabase](https://supabase.com/dashboard).

2. For a fresh project, open SQL Editor, paste the complete contents of `supabase/schema.sql`, and run it. For the existing CHAIN project, run `supabase/migrations/202607210002_auth_realtime_fixes.sql`. This creates or repairs:

   - public profiles with unique usernames
   - one best score per player per UTC Daily
   - row-level security
   - protected score submission
   - live leaderboard updates
   - username synchronization
   - permanent account deletion with score cleanup

3. Go to Project Settings > API. Copy the Project URL and publishable key into `window.CHAIN_CONFIG` in `index.html`:

   ```html
   <script>window.CHAIN_CONFIG = {
     supabaseUrl: "https://YOUR_PROJECT.supabase.co",
     supabaseAnonKey: "YOUR_PUBLIC_PUBLISHABLE_KEY",
     authRedirectUrl: "https://OrionMac24.github.io/chain-game/"
   };</script>
   ```

4. Run the sync script so iOS and Android receive the same configuration:

   ```bash
   ./scripts/sync-web.sh
   ```

5. In Authentication > Providers, keep Email enabled. For production, keep Confirm email enabled. A new player confirms once, then signs in with email and password inside CHAIN.

6. In Authentication > URL Configuration, set the deployed CHAIN URL as the Site URL. Add both `https://OrionMac24.github.io/chain-game/` and `http://localhost:4173/` as Redirect URLs while testing.

7. No Apple authentication provider is required. CHAIN uses username, email, and password only.

8. Test with two real accounts. Bank a Daily word with account A, open the leaderboard on account B, then bank a higher score. The order should change without refreshing. Confirm that a signed-out home shows the global all-time high and a signed-in home shows that player's own best.

The database blocks anonymous and duplicate Daily submissions, but no client-only game can fully stop a modified app from inventing a score. Before a large competitive launch, add server-side replay validation or signed move logs.

Official references: [Supabase email authentication](https://supabase.com/docs/guides/auth/passwords), [Supabase Realtime](https://supabase.com/docs/guides/realtime/postgres-changes).

## 4. RevenueCat and Chain Pro

The code already contains Paywalls, customer info refresh, entitlement checks, restore, and Customer Center on both platforms. The current Test Store key is only for development.

### Store products

1. In App Store Connect, create one subscription group named `Chain Pro`.
2. Create auto-renewing subscriptions with product IDs:

   - `weekly`
   - `monthly`
   - `yearly`

3. In Google Play Console, create matching subscriptions. Give each one an active base plan for its billing period. Complete every required price, region, and policy field.

### RevenueCat dashboard

1. Create one RevenueCat project and add an Apple app plus a Google Play app.
2. Connect App Store Connect using an in-app purchase key.
3. Connect Google Play using a service account with the required Play Console financial permissions.
4. Import the weekly, monthly, and yearly products from each store.
5. Create the entitlement exactly as `Chain Pro`, including capitalization and the space.
6. Attach every store product to `Chain Pro`.
7. Create a current offering named `default` and map the products to weekly, monthly, and annual packages.
8. Create and publish a RevenueCat Paywall for the current offering.
9. Configure Customer Center with restore, manage subscription, and cancellation help.

### Replace public SDK keys

- iOS: replace the test key in `ios/ChainIOS/ChainIOS/RevenueCatConfig.swift` with the Apple public SDK key.
- Android: replace the test key in `android/ChainAndroid/app/src/main/java/com/chainwordgame/app/ChainApplication.kt` with the Google public SDK key.

Use a separate public key for each platform. Do not use RevenueCat secret keys in either app.

Official references: [RevenueCat Android install](https://www.revenuecat.com/docs/getting-started/installation/android), [display Paywalls](https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls), [Customer Center](https://www.revenuecat.com/docs/tools/customer-center/customer-center-integration).

## 5. Google AdMob rewarded videos

The app has one rewarded placement: a one-time Daily revive. Rewards are granted only after Google's earned-reward callback. Both platforms also run Google's User Messaging Platform consent flow before requesting ads.

1. In [AdMob](https://admob.google.com), add one iOS app and one Android app.
2. For each app, create one Rewarded ad unit named `chain_revive`.
3. In Privacy & messaging, publish the required European regulations and US state messages. The app shows a Privacy button when Google says a privacy-options entry point is required.
4. Replace IDs:

   - iOS App ID: `INFOPLIST_KEY_GADApplicationIdentifier` in `ios/ChainIOS/project.yml`
   - iOS rewarded IDs: the `adUnitIDs` map in `ios/ChainIOS/ChainIOS/RewardedAdBridge.swift`
   - Android App ID: `com.google.android.gms.ads.APPLICATION_ID` in `android/ChainAndroid/app/src/main/AndroidManifest.xml`
   - Android rewarded IDs: the `adUnitIDs` map in `android/ChainAndroid/app/src/main/java/com/chainwordgame/app/RewardedAdsBridge.kt`

5. Keep the supplied Google test IDs during development. Switch to production IDs only for store test builds. Never repeatedly click live ads yourself, because invalid traffic can suspend an AdMob account.

Official references: [AdMob iOS setup](https://developers.google.com/admob/ios/quick-start), [iOS rewarded ads](https://developers.google.com/admob/ios/rewarded), [iOS consent](https://developers.google.com/admob/ios/privacy), [AdMob Android setup](https://developers.google.com/admob/android/quick-start), [Android rewarded ads](https://developers.google.com/admob/android/rewarded), [Android consent](https://developers.google.com/admob/android/privacy).

## 6. Build and submit iOS

1. Install the current stable Xcode from the Mac App Store. This Mac currently has only Command Line Tools, so it cannot archive the app yet.
2. Install XcodeGen, which turns the supplied `project.yml` into an Xcode project:

   ```bash
   brew install xcodegen
   cd "/Users/orion/Documents/Codex/2026-07-20/files-mentioned-by-the-user-chain/ios/ChainIOS"
   xcodegen generate
   open ChainIOS.xcodeproj
   ```

3. In Xcode, select the CHAIN target, choose your Apple Developer team, and confirm the bundle ID.
4. Confirm the In-App Purchase capability is present. Sign in with Apple is intentionally not included.
5. Resolve Swift packages. The project already requests RevenueCat, RevenueCatUI, Google Mobile Ads, and Google User Messaging Platform.
6. Run on a real iPhone. Test email account creation, Backspace in every form field, global and personal highest scores, leaderboard movement, the one-life warning, a completed test rewarded video, revive, Paywall, purchase restore, Customer Center, and account deletion.
7. In App Store Connect, create the app record before uploading. Use the same bundle ID.
8. Add the three subscription products, screenshots, description, support URL, and privacy policy URL. After Pages is live, use `https://OrionMac24.github.io/chain-game/legal/privacy.html`.
9. Complete App Privacy accurately for Supabase authentication, RevenueCat purchases, and Google ads.
10. In Xcode, choose Any iOS Device, then Product > Archive > Distribute App > App Store Connect > Upload.
11. Test the build in TestFlight with sandbox purchase accounts and AdMob test devices.
12. Select the processed build in App Store Connect, answer export and advertising questions, add review notes explaining the rewarded revive flow, then submit for review.

Official references: [create an App Store record](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/), [upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds), [screenshot requirements](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/).

## 7. Build and submit Android

1. Install the current stable Android Studio. It supplies the JDK and Android SDK missing from this Mac.
2. Open `android/ChainAndroid` in Android Studio and allow Gradle sync to finish.
3. Install Android SDK Platform 35 and Build Tools 35 if Android Studio requests them.
4. Confirm the package name. Changing `com.chainwordgame.app` later creates a different Play Store app, so decide before the first upload.
5. Run on a physical Android device and repeat the same account, leaderboard, death, rewarded ad, RevenueCat, privacy, and deletion tests.
6. Create the Google Play app as a Game, choose Free, accept Play App Signing, and complete the store listing.
7. Complete Data safety for Supabase, RevenueCat, and Google Mobile Ads. Add the same hosted privacy policy URL.
8. Create a release signing key in Android Studio through Build > Generate Signed Bundle or APK. Back up the keystore and password outside GitHub.
9. Generate an Android App Bundle. Google Play requires AAB for new apps:

   ```bash
   cd android/ChainAndroid
   ./gradlew bundleRelease
   ```

10. Upload the `.aab` to Internal testing first. Add tester emails, including your RevenueCat and Google Play license-test accounts.
11. Verify real Google Play test purchases, restore, Customer Center, and rewarded test ads from the installed Play build.
12. Complete content rating, target audience, ads declaration, app access instructions, and every dashboard task. Move through closed testing if your developer account requires it, then create a Production release.

Official references: [create a Play app](https://support.google.com/googleplay/android-developer/answer/9859152), [Android App Bundles](https://support.google.com/googleplay/android-developer/answer/9844279), [internal app sharing](https://support.google.com/googleplay/android-developer/answer/9844679).

## 8. Final release gate

Do not submit until all of these pass on real devices:

- No tutorial, home, archive, death, or account overlay clips at small phone sizes
- Every red-trail collision ends the Daily immediately
- One completed rewarded video revives once, and closing early grants nothing
- A rewarded hint shows the familiar planted starter word during the first three words
- Daily result locks after the player ends the run
- Signed-in scores update the global leaderboard automatically
- Username changes update leaderboard rows
- Account deletion removes profile and scores
- Weekly, monthly, and yearly purchases unlock `Chain Pro`
- Restore and Customer Center work on both stores
- Privacy consent is shown when required
- Production AdMob IDs are used only in store test and release builds
- Privacy policy, support address, screenshots, icons, and store metadata are live
