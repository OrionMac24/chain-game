# CHAIN release handoff

## Run the web build

From the CHAIN project folder:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173/`.

## Generate the iOS project

```bash
brew install xcodegen
cd ios/ChainIOS
xcodegen generate
open ChainIOS.xcodeproj
```

Install the full Xcode app before running those iOS steps. Then choose your Apple Developer Team in Signing & Capabilities.

## Delivered product changes

- Simplified Daily and Practice home with one clear action.
- “Today’s Global Challenge” daily framing.
- Seven-day flame activity strip and total days played.
- “Your Highest Score” replaces the old rank.
- Two-screen visual introduction that begins with a guided Practice board.
- Familiar starter paths for the first three words, then normal challenge.
- Used trail is visibly red. Entering an older red body segment ends the run.
- Tap adjacent tiles, swipe to move, keyboard input, Practice rewind, and retry.
- US and UK spelling, sound, high contrast, reduced motion, and colorblind settings.
- Weighted letter bag, 16-vowel floor, and one combined Q/J/X/Z maximum.
- Local Phase 7 run metrics with no remote tracking.
- SwiftUI iOS shell with RevenueCat Paywall and Customer Center.
- Portal and advertising integration removed.

## Verification completed

- Browser home, Practice, tutorial, settings, board rendering, and tap-to-move were visually checked.
- All five game JavaScript files parsed successfully in JavaScriptCore.
- 10,000 generated boards passed the vowel and high-rare-letter constraints.
- All Swift source files passed Swift parser validation.
- Phaser, fonts, dictionary, CSS, and game scripts are bundled inside the iOS app resources.

## Remaining owner-only release gates

- Install full Xcode and generate the project.
- Add the Apple Developer Team and final bundle ID.
- Replace the RevenueCat Test Store key with the Apple public SDK key.
- Configure Apple subscriptions, RevenueCat products, entitlement, offering, and paywall.
- Add the final app icon, screenshots, privacy policy, support URL, and App Store metadata.
- Run Sandbox and TestFlight purchase tests.
- Archive, sign, upload, and submit through App Store Connect.
