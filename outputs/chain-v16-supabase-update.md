# CHAIN v17: Supabase and gameplay update

## What is already fixed in the app

- Apple is removed from the sign-in screen and iOS capability configuration.
- New accounts use username, email, and password.
- Returning players leave username blank and use email plus password.
- A signed-in Daily score is submitted after every correct word, not only when the run ends.
- The leaderboard listens for database changes and refreshes every 10 seconds as a fallback.
- Account and leaderboard errors now explain the next action in plain language.
- Signed-out visitors see the global highest score ever submitted. Signed-in players see their own highest score.
- Account fields keep normal keyboard behavior, including Backspace and Delete.

The existing Supabase URL and publishable key were not changed.

## One Supabase step you still need to do

The live project already has email authentication enabled, account creation enabled, and both CHAIN tables. It does not yet have the new `ensure_my_profile` database function.

1. Open your Supabase project.
2. Choose **SQL Editor** in the left menu.
3. Choose **New query**.
4. Open [202607210002_auth_realtime_fixes.sql](../supabase/migrations/202607210002_auth_realtime_fixes.sql) from this project.
5. Copy the complete file into the Supabase query editor.
6. Choose **Run**.
7. Reload CHAIN, create a test account, confirm its email, and sign in.

This migration is safe to run more than once. It adds the missing profile repair function, makes score submission repair missing profiles automatically, and confirms that `daily_scores` is enabled for Supabase Realtime.

The home screen's global record uses the existing public read policy on `daily_scores`. The original CHAIN schema already creates that policy. If the global score stays blank after running the migration, run the complete `supabase/schema.sql` file once to restore the policy.

## Supabase dashboard checks

In **Authentication > Providers > Email**, keep Email enabled. For a production release, keep email confirmation enabled. For quick private prototype testing only, you may temporarily disable email confirmation so a new account signs in immediately.

In **Authentication > URL Configuration**, use the deployed CHAIN URL as the Site URL and add these Redirect URLs while testing:

- `https://OrionMac24.github.io/chain-game/`
- `http://localhost:4173/`

No Apple provider setup is needed.

## New round rules

1. Tap the marked START tile. Its visible letter is the first letter.
2. Bank a valid word to score it. That word cannot score again in the run.
3. A completely fresh board appears after every correct word.
4. Choose any tile as the first letter of the next round.
5. The first invalid word, red-trail hit, reverse move, or boxed-in path costs one life and removes free-start choices for the rest of the run.
6. A warning pauses the game and explains that one life remains and CHAIN will choose future starting letters.
7. The second mistake ends the run.
8. Bank 20 unique words to unlock tomorrow's board, then continue for the highest score possible.
