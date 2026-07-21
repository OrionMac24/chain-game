# CHAIN Release Bug Reassessment

Date: July 21, 2026

## Fixed and verified

- Removed the oversized decorative circle from the home screen.
- Rebuilt mobile spacing so buttons, streak details, tutorials, and archive controls do not overlap or clip.
- Added Retina-density canvas rendering, real-font loading before Phaser draws, and compact Safari-height spacing so iPhone text and tiles stay crisp instead of fuzzy or compressed.
- Added explicit compact landscape handling, portrait orientation in both native wrappers, and verified layouts at 320 by 568, 393 by 659, 393 by 852, 768 by 1024, and 1280 by 720.
- Prevented every duplicate word from scoring twice and marked repeated words as already banked in the live feedback.
- Raised the Daily opening guarantee to at least 20 distinct reachable words and added the 20-word qualification state, progress HUD, tutorial, success toast, failure result, and tomorrow-unlocked home state.
- Reworked the tutorial with illustrated board examples, shorter mobile copy, and a guided first-run coach.
- Red-trail collisions now use the shared two-life rule. The first collision shows a one-life warning and removes free-start choices. A second mistake ends the run.
- Kept Practice forgiving with a separate rewind action.
- Added one rewarded revive per Daily run. The revive restores the exact state before the fatal move. A second death offers only End Run.
- Removed the rewarded word-hint control from gameplay.
- Added a clear final score state and Daily score lock.
- Added Supabase email authentication, username creation, profile editing, account deletion, and a real-time global top-100 leaderboard. Apple sign-in is removed.
- Added RevenueCat paywalls, Chain Pro entitlement checks, restore purchases, customer information, and Customer Center entry points for iOS and Android.
- Added Google Mobile Ads rewarded placements for revive and word hint, gated behind the consent flow.
- Replaced the old logo treatment and created a restrained geometric app icon for web, iOS, and Android.

## Automated checks

- JavaScript syntax: pass.
- Swift source parse: pass.
- Android manifest XML: pass.
- iOS asset catalog JSON: pass.
- Shell sync script syntax: pass.
- Board generation: 10,000 deterministic boards checked, minimum 20 reachable opening words, minimum 16 vowels, maximum one combined Q, J, X, or Z.
- Duplicate scoring: rejected without changing score or the banked-word list.
- Reverse collision: checked as a first-life loss and free-start penalty.

## Browser checks

- Mobile home and button spacing: pass.
- Tutorial pages and guided first move: pass.
- Red-trail life warning and second-mistake ending: pass.
- Rewarded revive: pass.
- One-revive limit: pass.

## External release steps still required

- Create or connect a GitHub repository, then push this prepared source.
- Run the supplied SQL migration in the owner's Supabase project and add the public project URL and anon key.
- Replace RevenueCat test keys with separate production Apple and Google public SDK keys.
- Replace Google test ad identifiers with the production iOS and Android app and rewarded-unit identifiers.
- Build and archive iOS in full Xcode. Only Command Line Tools are installed on this Mac.
- Build the Android App Bundle after Android Studio installs its JDK and Android SDK. No Java runtime is currently installed.

The client-side Daily score submission is protected by authentication, row-level security, and a database function. Server-side replay validation is a sensible anti-cheat hardening step before the leaderboard grows large.
