// This file owns sign-in, usernames, score submission, and the live global Daily leaderboard.
(function () {
  "use strict";

  const config = window.CHAIN_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  const client = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  let session = null;
  let leaderboardChannel = null;
  let pendingAppleUsername = null;

  // This creates the accessible account and leaderboard layer once, outside the Phaser canvas.
  function ensurePanel() {
    let panel = document.getElementById("online-panel");
    if (panel) {
      return panel;
    }
    panel = document.createElement("section");
    panel.id = "online-panel";
    panel.className = "online-panel";
    panel.hidden = true;
    panel.innerHTML = "<div class='online-card'><button class='online-close' type='button' aria-label='Close'>×</button><div id='online-content'></div></div>";
    document.body.appendChild(panel);
    panel.querySelector(".online-close").addEventListener("click", closePanel);
    panel.addEventListener("click", function closeFromShade(event) {
      if (event.target === panel) { closePanel(); }
    });
    return panel;
  }

  // This safely inserts text into generated HTML without allowing a username to become markup.
  function escapeHTML(value) {
    const element = document.createElement("span");
    element.textContent = String(value || "");
    return element.innerHTML;
  }

  // This opens the overlay and prevents the game canvas from receiving accidental gestures beneath it.
  function openPanel() {
    const panel = ensurePanel();
    panel.hidden = false;
    return panel.querySelector("#online-content");
  }

  // This closes the overlay and releases any leaderboard subscription that is no longer visible.
  function closePanel() {
    ensurePanel().hidden = true;
    if (leaderboardChannel && client) {
      client.removeChannel(leaderboardChannel);
      leaderboardChannel = null;
    }
  }

  // This shows one real connection error when the owner has not added Supabase project credentials yet.
  function showConnectionSetup(content) {
    content.innerHTML = "<p class='online-kicker'>ONLINE SETUP</p><h2>Connect global play</h2><p>Accounts and live rankings need the CHAIN Supabase URL and publishable key. The app logic is installed, but those two values must come from your private Supabase project.</p><p class='online-status'>Use the supplied Supabase setup guide, then reload CHAIN.</p><button id='privacy-info' class='secondary-online' type='button'>PRIVACY &amp; DATA</button>";
    content.querySelector("#privacy-info").addEventListener("click", showPrivacyInfo);
  }

  function showPrivacyInfo() {
    const content = openPanel();
    content.innerHTML = "<p class='online-kicker'>PRIVACY &amp; DATA</p><h2>Your data, plainly</h2><p>CHAIN stores your email and sign-in details with Supabase, plus your public username and Daily scores. RevenueCat handles subscription status. Google Mobile Ads handles rewarded videos only after its required consent flow. We do not sell your personal information.</p><p>You can change your public username or permanently delete your account from Profile. Deletion removes your profile and leaderboard scores. Subscription records remain with Apple, Google, and RevenueCat where financial law requires them.</p><p class='online-status'>Support: orion.macapella25@gmail.com</p><button id='privacy-back' class='secondary-online' type='button'>BACK</button>";
    content.querySelector("#privacy-back").addEventListener("click", openAccount);
  }

  // This reads the current user session and keeps the home account label accurate after sign-in changes.
  async function initialize() {
    ensurePanel();
    if (!client) {
      return;
    }
    const response = await client.auth.getSession();
    session = response.data.session;
    client.auth.onAuthStateChange(function rememberSession(event, nextSession) {
      session = nextSession;
      if (window.chainGame) {
        const scene = window.chainGame.scene.getScene("AppScene");
        if (scene && scene.screen === "home") { scene.showHome(scene.currentMode); }
      }
    });
    const result = window.ChainState && window.ChainState.getDailyResult();
    if (session && result) {
      submitDailyScore(result);
    }
  }

  // This reports the shortest useful home label for the current authentication state.
  function accountLabel() {
    return session ? "PROFILE" : "SIGN IN";
  }

  // This opens email and Sign in with Apple entry, or the signed-in profile controls.
  async function openAccount() {
    const content = openPanel();
    if (!client) {
      showConnectionSetup(content);
      return;
    }
    if (!session) {
      content.innerHTML = "<p class='online-kicker'>GLOBAL PROFILE</p><h2>Join the leaderboard</h2><p>New player? Choose a public username. Returning players only need email and password. Apple can provide Hide My Email.</p><form id='sign-in-form'><label>USERNAME FOR NEW ACCOUNTS<input name='username' minlength='3' maxlength='18' pattern='[A-Za-z0-9_]{3,18}' autocomplete='nickname'></label><label>EMAIL<input name='email' type='email' autocomplete='email' required></label><label>PASSWORD<input name='password' type='password' minlength='8' autocomplete='current-password' required></label><button type='submit'>CREATE ACCOUNT</button><button id='email-sign-in' class='secondary-online in-form' type='button'>SIGN IN WITH EMAIL</button></form><button id='apple-sign-in' class='secondary-online' type='button'>CONTINUE WITH APPLE</button><button id='privacy-info' class='quiet-online' type='button'>PRIVACY &amp; DATA</button><p id='account-status' class='online-status' aria-live='polite'></p>";
      content.querySelector("#sign-in-form").addEventListener("submit", createEmailAccount);
      content.querySelector("#email-sign-in").addEventListener("click", signInWithEmail);
      content.querySelector("#apple-sign-in").addEventListener("click", signInWithApple);
      content.querySelector("#privacy-info").addEventListener("click", showPrivacyInfo);
      return;
    }
    const profileResponse = await client.from("profiles").select("username").eq("id", session.user.id).maybeSingle();
    const username = profileResponse.data ? profileResponse.data.username : "Player";
    content.innerHTML = "<p class='online-kicker'>SIGNED IN</p><h2>" + escapeHTML(username) + "</h2><p>Scores from completed Daily runs post automatically to the global leaderboard.</p><form id='username-form'><label>PUBLIC USERNAME<input name='username' minlength='3' maxlength='18' pattern='[A-Za-z0-9_]{3,18}' value='" + escapeHTML(username) + "' required></label><button type='submit'>SAVE USERNAME</button></form><button id='sign-out' class='secondary-online' type='button'>SIGN OUT</button><button id='privacy-info' class='quiet-online' type='button'>PRIVACY &amp; DATA</button><button id='delete-account' class='quiet-online destructive-online' type='button'>DELETE ACCOUNT</button><p id='account-status' class='online-status' aria-live='polite'></p>";
    content.querySelector("#username-form").addEventListener("submit", saveUsername);
    content.querySelector("#sign-out").addEventListener("click", async function signOut() {
      await client.auth.signOut();
      closePanel();
    });
    content.querySelector("#privacy-info").addEventListener("click", showPrivacyInfo);
    content.querySelector("#delete-account").addEventListener("click", deleteAccount);
  }

  async function deleteAccount() {
    if (!window.confirm("Permanently delete your CHAIN account, username, and leaderboard scores? This cannot be undone.")) {
      return;
    }
    const status = document.getElementById("account-status");
    status.textContent = "Deleting your account...";
    const response = await client.rpc("delete_my_account");
    if (response.error) {
      status.textContent = response.error.message;
      return;
    }
    await client.auth.signOut();
    session = null;
    closePanel();
  }

  function emailCredentials(requireUsername) {
    const formElement = document.getElementById("sign-in-form");
    if (!formElement.reportValidity()) {
      return null;
    }
    const form = new FormData(formElement);
    const credentials = {
      username: String(form.get("username") || "").trim(),
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || "")
    };
    if (requireUsername && !/^[A-Za-z0-9_]{3,18}$/.test(credentials.username)) {
      document.getElementById("account-status").textContent = "Choose a 3 to 18 character username using letters, numbers, or underscores.";
      return null;
    }
    return credentials;
  }

  // This creates an account that works inside the native app without a fragile email redirect.
  async function createEmailAccount(event) {
    event.preventDefault();
    const credentials = emailCredentials(true);
    if (!credentials) { return; }
    const status = document.getElementById("account-status");
    status.textContent = "Creating your account...";
    const usernameCheck = await client.from("profiles").select("id").eq("username", credentials.username).limit(1);
    if (usernameCheck.error) {
      status.textContent = usernameCheck.error.message;
      return;
    }
    if (usernameCheck.data.length) {
      status.textContent = "That username is taken. Try another one.";
      return;
    }
    const response = await client.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: { data: { username: credentials.username } }
    });
    if (response.error) {
      status.textContent = response.error.message;
      return;
    }
    session = response.data.session;
    status.textContent = session ? "Account created. You are signed in." : "Account created. Confirm the email Supabase sent you, then sign in here.";
    if (session) { await openAccount(); }
  }

  // This signs an existing player in with the same email and password on web, iOS, and Android.
  async function signInWithEmail() {
    const credentials = emailCredentials(false);
    if (!credentials) { return; }
    const status = document.getElementById("account-status");
    status.textContent = "Signing you in...";
    const response = await client.auth.signInWithPassword({ email: credentials.email, password: credentials.password });
    if (response.error) {
      status.textContent = response.error.message;
      return;
    }
    session = response.data.session;
    await openAccount();
  }

  // This starts Apple's OAuth flow, which includes Apple's Hide My Email choice.
  async function signInWithApple() {
    const status = document.getElementById("account-status");
    const usernameInput = document.querySelector("#sign-in-form input[name='username']");
    if (!usernameInput || !/^[A-Za-z0-9_]{3,18}$/.test(usernameInput.value.trim())) {
      status.textContent = "Choose a username before continuing with Apple.";
      return;
    }
    status.textContent = "Opening Apple sign-in...";
    pendingAppleUsername = usernameInput.value.trim();
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.chainAuth) {
      window.webkit.messageHandlers.chainAuth.postMessage({ action: "apple" });
      return;
    }
    if (window.location.protocol === "file:" && !config.authRedirectUrl) {
      status.textContent = "Apple sign-in needs the public app URL in CHAIN_CONFIG. Email sign-in works now.";
      return;
    }
    const response = await client.auth.signInWithOAuth({ provider: "apple", options: { redirectTo: config.authRedirectUrl || window.location.origin } });
    if (response.error) { status.textContent = response.error.message; }
  }

  // The native iOS Apple sheet returns its identity token here for secure Supabase authentication.
  async function completeAppleSignIn(token, nonce, errorMessage) {
    const status = document.getElementById("account-status");
    if (errorMessage || !token || !nonce) {
      if (status) { status.textContent = errorMessage || "Apple sign-in did not complete."; }
      return;
    }
    const response = await client.auth.signInWithIdToken({ provider: "apple", token: token, nonce: nonce });
    if (response.error) {
      if (status) { status.textContent = response.error.message; }
      return;
    }
    session = response.data.session;
    if (pendingAppleUsername && session) {
      const usernameResponse = await client.from("profiles").update({ username: pendingAppleUsername }).eq("id", session.user.id);
      if (usernameResponse.error && status) {
        status.textContent = usernameResponse.error.message;
        return;
      }
    }
    pendingAppleUsername = null;
    await openAccount();
  }

  // This updates the public profile while the database uniqueness rule protects existing names.
  async function saveUsername(event) {
    event.preventDefault();
    const username = new FormData(event.currentTarget).get("username");
    const status = document.getElementById("account-status");
    const response = await client.from("profiles").update({ username: username }).eq("id", session.user.id);
    status.textContent = response.error ? response.error.message : "Username saved.";
  }

  // This fetches today's top 100 and renders the player's placement in a compact ranked list.
  async function refreshLeaderboard() {
    const content = document.getElementById("online-content");
    if (!content || ensurePanel().hidden) {
      return;
    }
    const date = window.ChainState.dateKey();
    const response = await client.from("daily_scores").select("user_id,username,score,words").eq("challenge_date", date).order("score", { ascending: false }).limit(100);
    if (response.error) {
      content.querySelector("#leaderboard-list").innerHTML = "<p class='online-status'>" + escapeHTML(response.error.message) + "</p>";
      return;
    }
    const rows = response.data || [];
    content.querySelector("#leaderboard-list").innerHTML = rows.length ? rows.map(function renderRow(row, index) {
      const isYou = session && row.user_id === session.user.id;
      return "<li class='" + (isYou ? "is-you" : "") + "'><span>" + (index + 1) + "</span><strong>" + escapeHTML(row.username) + "</strong><small>" + row.words + " words</small><b>" + Number(row.score).toLocaleString("en-US") + "</b></li>";
    }).join("") : "<p class='online-status'>No scores yet. Be the first to finish today's CHAIN.</p>";
  }

  // This opens today's ranking and subscribes to inserts and updates so positions move without refreshes.
  async function openLeaderboard() {
    const content = openPanel();
    if (!client) {
      showConnectionSetup(content);
      return;
    }
    content.innerHTML = "<p class='online-kicker'>TODAY'S GLOBAL CHALLENGE</p><h2>Global leaderboard</h2><p>Rankings update automatically whenever a signed-in player finishes.</p><ol id='leaderboard-list' class='leaderboard-list'><p class='online-status'>Loading scores…</p></ol>";
    await refreshLeaderboard();
    leaderboardChannel = client.channel("daily-leaderboard-" + window.ChainState.dateKey())
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_scores", filter: "challenge_date=eq." + window.ChainState.dateKey() }, refreshLeaderboard)
      .subscribe();
  }

  // This asks a protected database function to keep only the player's best score for today's challenge.
  async function submitDailyScore(result) {
    if (!client || !session || !result) {
      return { submitted: false };
    }
    const response = await client.rpc("submit_daily_score", {
      p_score: result.score,
      p_words: result.words,
      p_board_hash: result.hash
    });
    return { submitted: !response.error, error: response.error || null };
  }

  window.ChainOnline = {
    initialize: initialize,
    accountLabel: accountLabel,
    openAccount: openAccount,
    openLeaderboard: openLeaderboard,
    submitDailyScore: submitDailyScore,
    completeAppleSignIn: completeAppleSignIn
  };
  window.addEventListener("DOMContentLoaded", initialize);
}());
