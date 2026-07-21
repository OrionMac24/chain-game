# CHAIN

CHAIN is a daily word-snake game. Players move across one shared board, spell and bank words, avoid their red trail, and compete for the highest score of the day.

## What is included

- Responsive browser game with Daily and unlimited Practice modes
- Guided visual tutorial and beginner-friendly opening words
- Deterministic 8 by 8 boards using a weighted letter bag
- At least 20 distinct reachable opening words, minimum 16 vowels, and no more than one total Q, J, X, or Z per board
- One score per unique word, with 20 banked words required to unlock the next Daily
- Fatal red-trail collisions, boxed-in deaths, one rewarded revive, and rewarded word hints
- Retina-density rendering, compact-phone layouts, and an intentional portrait-phone experience
- Supabase email accounts, native iOS Apple sign-in, usernames, account deletion, and live leaderboard
- RevenueCat Paywall, Chain Pro entitlement checks, restore, and Customer Center
- Google rewarded ads with consent flows for iOS and Android
- Native SwiftUI iOS and Android WebView wrappers
- Privacy policy, terms, app icons, CI checks, and GitHub Pages deployment

## Run the browser game

Serve the repository root with any static server, then open it in a browser. The current local preview uses `http://localhost:4173`.

After changing shared web files or the existing public Supabase configuration, run:

```bash
./scripts/sync-web.sh
```

This copies the current web game into both native wrappers.

## Validate

```bash
node --check js/*.js
node work/verify-boards.js
```

The Android project includes its own Gradle wrapper:

```bash
cd android/ChainAndroid
./gradlew assembleDebug
```

The iOS project is generated from `ios/ChainIOS/project.yml` with XcodeGen.

## Backend

Run `supabase/schema.sql` once in the Supabase SQL Editor. The same SQL is also stored as a timestamped migration under `supabase/migrations` for a GitHub or Supabase CLI workflow.

## Release setup

See `outputs/chain-launch-guide.md` for the exact Supabase, RevenueCat, AdMob, App Store, Play Store, and GitHub steps.
