# CHAIN Release Bug Reassessment

Date: July 21, 2026

## Fixed and verified

- Removed the oversized decorative circle from the home screen.
- Rebuilt mobile spacing so buttons, streak details, tutorials, and archive controls do not overlap or clip.
- Added Retina-density canvas rendering, real-font loading before Phaser draws, and compact Safari-height spacing so iPhone text and tiles stay crisp instead of fuzzy or compressed.
- Reworked the tutorial with illustrated board examples, shorter mobile copy, and a guided first-run coach.
- Made a red trail collision fatal in Daily. Reversing into the previous red tile now ends the run instead of showing a blocked-path message.
- Kept Practice forgiving with a separate rewind action.
- Added one rewarded revive per Daily run. The revive restores the exact state before the fatal move. A second death offers only End Run.
- Added a rewarded word hint with a visible route. Early hints prefer the planted easy starter word.
- Added a clear final score state and Daily score lock.
- Added Supabase email authentication, username creation, profile editing, Apple sign-in support on iOS, account deletion, and a real-time global top-100 leaderboard.
- Added RevenueCat paywalls, Chain Pro entitlement checks, restore purchases, customer information, and Customer Center entry points for iOS and Android.
- Added Google Mobile Ads rewarded placements for revive and word hint, gated behind the consent flow.
- Replaced the old logo treatment and created a restrained geometric app icon for web, iOS, and Android.

## Automated checks

- JavaScript syntax: pass.
- Swift source parse: pass.
- Android manifest XML: pass.
- iOS asset catalog JSON: pass.
- Shell sync script syntax: pass.
- Board generation: 10,000 deterministic boards checked, minimum 16 vowels, maximum one combined Q, J, X, or Z.
- Reverse collision: checked as a fatal red-trail target.

## Browser checks

- Mobile home and button spacing: pass.
- Tutorial pages and guided first move: pass.
- Red trail death overlay: pass.
- Rewarded revive: pass.
- One-revive limit: pass.
- Rewarded friendly word route: pass.

## External release steps still required

- Create or connect a GitHub repository, then push this prepared source.
- Run the supplied SQL migration in the owner's Supabase project and add the public project URL and anon key.
- Replace RevenueCat test keys with separate production Apple and Google public SDK keys.
- Replace Google test ad identifiers with the production iOS and Android app and rewarded-unit identifiers.
- Build and archive iOS in full Xcode. Only Command Line Tools are installed on this Mac.
- Build the Android App Bundle after Android Studio installs its JDK and Android SDK. No Java runtime is currently installed.

The client-side Daily score submission is protected by authentication, row-level security, and a database function. Server-side replay validation is a sensible anti-cheat hardening step before the leaderboard grows large.
