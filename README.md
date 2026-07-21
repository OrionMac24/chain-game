# CHAIN

CHAIN is a daily word-snake game. Players move across one shared board, spell and bank words, avoid their red trail, and compete for the highest score of the day.

## What is included

- Responsive browser game with Daily and unlimited Practice modes
- Guided visual tutorial, a marked first letter, and beginner-friendly opening words
- Deterministic 8 by 8 boards using a weighted letter bag
- At least 20 distinct reachable opening words, minimum 16 vowels, and no more than one total Q, J, X, or Z per board
- A fresh board after every correct word, plus one free start choice at the beginning of each new round
- One score per unique word, with 20 banked words required to unlock the next Daily
- Two lives across invalid words, red-trail hits, and boxed-in paths, plus loss of free starts after the first mistake
- Retina-density rendering, compact-phone layouts, and an intentional portrait-phone experience
- Supabase email accounts, usernames, account deletion, and live leaderboard
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

For a fresh project, run `supabase/schema.sql` once in the Supabase SQL Editor. For the existing CHAIN project, run `supabase/migrations/202607210002_auth_realtime_fixes.sql` to add profile repair and reliable live score submission without changing the existing keys.

## Release setup

See `outputs/chain-launch-guide.md` for the exact Supabase, RevenueCat, AdMob, App Store, Play Store, and GitHub steps.
