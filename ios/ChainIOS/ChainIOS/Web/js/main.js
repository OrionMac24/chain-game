// This file starts the game and provides the small local-save layer shared by every screen.
(function () {
  "use strict";

  const SAVE_KEY = "chain-save-v2";
  const LAUNCH_DATE = new Date(2025, 5, 5);
  const DAILY_TARGET = 20;
  const BOARD_VERSION = 3;
  const DEFAULT_SAVE = {
    bestScore: 0,
    lifetimeWords: 0,
    lifetimeBestWord: null,
    rankTitle: "Novice",
    dailyStreak: 0,
    longestStreak: 0,
    lastDailyPlayed: null,
    dailyResults: [],
    inProgressDaily: null,
    tutorialSeen: false,
    gameplayGuideSeen: false,
    settings: { sound: true, colorblind: false, highContrast: false, reducedMotion: false, spelling: "US" },
    analytics: { runs: [] }
  };

  let saveData = loadSave();

  // This copies simple save data so defaults cannot be accidentally changed in memory.
  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // This merges an older or partial local save into the complete v2 shape.
  function normalizeSave(candidate) {
    const normalized = copy(DEFAULT_SAVE);
    if (!candidate || typeof candidate !== "object") {
      return normalized;
    }
    // This copies each known top-level value while leaving new defaults intact.
    Object.keys(normalized).forEach(function copySavedValue(key) {
      if (candidate[key] !== undefined && key !== "settings") {
        normalized[key] = candidate[key];
      }
    });
    normalized.settings = Object.assign({}, normalized.settings, candidate.settings || {});
    return normalized;
  }

  // This reads local progress safely and falls back to a clean save when storage is unavailable.
  function loadSave() {
    try {
      return normalizeSave(JSON.parse(localStorage.getItem(SAVE_KEY) || "null"));
    } catch (error) {
      console.warn("CHAIN could not read its local save.", error);
      return copy(DEFAULT_SAVE);
    }
  }

  // This writes the latest progress locally without interrupting play if storage is unavailable.
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch (error) {
      console.warn("CHAIN could not update its local save.", error);
    }
  }

  // This formats the UTC calendar date so every country receives the same global Daily at once.
  function dateKey(date) {
    const value = date || new Date();
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return String(year) + month + day;
  }

  // This converts a date seed back into a local Date for archive labels and streak checks.
  function dateFromKey(key) {
    const text = String(key);
    return new Date(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8)));
  }

  // This calculates the public Daily number from the fixed launch date.
  function dailyNumber(date) {
    const value = date || new Date();
    const start = Date.UTC(LAUNCH_DATE.getFullYear(), LAUNCH_DATE.getMonth(), LAUNCH_DATE.getDate());
    const current = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
    return Math.max(1, Math.floor((current - start) / 86400000) + 1);
  }

  // This returns the title earned by the player's best completed run.
  function rankForScore(score) {
    if (score >= 60000) { return "Oracle"; }
    if (score >= 30000) { return "Etymologist"; }
    if (score >= 15000) { return "Lexicographer"; }
    if (score >= 7000) { return "Cruciverbalist"; }
    if (score >= 3000) { return "Wordsmith"; }
    if (score >= 1000) { return "Speller"; }
    return "Novice";
  }

  // This updates lasting score and word totals after a completed Daily or Practice run.
  function recordProgress(board) {
    saveData.bestScore = Math.max(saveData.bestScore, board.score);
    saveData.lifetimeWords += board.wordsFound.length;
    for (let index = 0; index < board.wordsFound.length; index += 1) {
      const found = board.wordsFound[index];
      if (!saveData.lifetimeBestWord || found.points > saveData.lifetimeBestWord.points) {
        saveData.lifetimeBestWord = copy(found);
      }
    }
    saveData.rankTitle = rankForScore(saveData.bestScore);
    persist();
  }

  // This stores small, private, on-device run metrics for Phase 7 balancing checks.
  function recordRunMetrics(board, mode, durationMs, ending) {
    saveData.analytics = saveData.analytics || { runs: [] };
    saveData.analytics.runs.push({
      at: new Date().toISOString(),
      mode: mode,
      durationSeconds: Math.max(0, Math.round((durationMs || 0) / 1000)),
      score: board.score,
      words: board.wordsFound.length,
      moves: board.history ? board.history.length : 0,
      ending: ending || "complete"
    });
    saveData.analytics.runs = saveData.analytics.runs.slice(-100);
    persist();
  }

  // This saves a Daily after every move so a refresh can resume the same attempt and random sequence.
  function saveDailyProgress(board) {
    saveData.inProgressDaily = {
      date: dateKey(),
      number: dailyNumber(),
      boardVersion: BOARD_VERSION,
      board: board.exportState(),
      hash: board.getHash()
    };
    persist();
  }

  // This returns today's unfinished Daily only when it still belongs to the current local date.
  function getDailyProgress() {
    if (saveData.inProgressDaily && saveData.inProgressDaily.date === dateKey() && saveData.inProgressDaily.boardVersion === BOARD_VERSION) {
      return copy(saveData.inProgressDaily);
    }
    return null;
  }

  // This finds a saved result for one date without relying on array order.
  function getDailyResult(key) {
    const target = key || dateKey();
    for (let index = 0; index < saveData.dailyResults.length; index += 1) {
      if (saveData.dailyResults[index].date === target) {
        return copy(saveData.dailyResults[index]);
      }
    }
    return null;
  }

  // This completes today's attempt, updates its streak once, and clears crash-recovery state.
  function completeDaily(board) {
    const today = dateKey();
    const existing = getDailyResult(today);
    if (existing) {
      return existing;
    }
    const qualified = board.wordsFound.length >= DAILY_TARGET;
    const yesterday = new Date(Date.now() - 86400000);
    if (qualified && saveData.lastDailyPlayed === dateKey(yesterday)) {
      saveData.dailyStreak += 1;
    } else if (qualified) {
      saveData.dailyStreak = 1;
    } else {
      saveData.dailyStreak = 0;
    }
    if (qualified) {
      saveData.lastDailyPlayed = today;
    }
    saveData.longestStreak = Math.max(saveData.longestStreak, saveData.dailyStreak);
    // This puts the highest-scoring word first for the Daily result and share card.
    const sortedWords = board.wordsFound.slice().sort(function sortByPoints(first, second) {
      return second.points - first.points;
    });
    const result = {
      date: today,
      number: dailyNumber(),
      score: board.score,
      words: board.wordsFound.length,
      qualified: qualified,
      target: DAILY_TARGET,
      bestWord: sortedWords[0] || null,
      streak: saveData.dailyStreak,
      hash: board.getHash()
    };
    saveData.dailyResults.push(result);
    saveData.dailyResults = saveData.dailyResults.slice(-120);
    saveData.inProgressDaily = null;
    recordProgress(board);
    persist();
    return copy(result);
  }

  // This removes an unfinished Daily only after the player confirms they want to abandon it.
  function abandonDaily() {
    saveData.inProgressDaily = null;
    persist();
  }

  // This changes one real setting and immediately rebuilds spelling lookup when necessary.
  function updateSetting(key, value) {
    saveData.settings[key] = value;
    if (key === "spelling") {
      window.ChainWords.setSpelling(value);
    }
    persist();
  }

  // This records that the guided introduction has been completed or deliberately skipped.
  function completeTutorial() {
    saveData.tutorialSeen = true;
    persist();
  }

  // This records that the player completed the contextual guide shown over their first live board.
  function completeGameplayGuide() {
    saveData.gameplayGuideSeen = true;
    persist();
  }

  // This exposes a copy so screens can read progress without mutating the save accidentally.
  function getSave() {
    return copy(saveData);
  }

  window.ChainState = {
    get: getSave,
    persist: persist,
    dateKey: dateKey,
    dateFromKey: dateFromKey,
    dailyNumber: dailyNumber,
    dailyTarget: DAILY_TARGET,
    rankForScore: rankForScore,
    recordProgress: recordProgress,
    saveDailyProgress: saveDailyProgress,
    getDailyProgress: getDailyProgress,
    getDailyResult: getDailyResult,
    completeDaily: completeDaily,
    abandonDaily: abandonDaily,
    updateSetting: updateSetting,
    recordRunMetrics: recordRunMetrics,
    completeTutorial: completeTutorial,
    completeGameplayGuide: completeGameplayGuide
  };

  // This changes the visible loading status while the large trie is prepared.
  function updateLoading(progress, message) {
    document.getElementById("loading-bar").style.width = progress + "%";
    document.getElementById("loading-status").textContent = message;
  }

  // This fades the loading layer only after Phaser has placed the home screen underneath it.
  function hideLoading() {
    updateLoading(100, "Grid ready");
    // This leaves the completed bar visible briefly before handing control to the player.
    window.setTimeout(function finishLoading() {
      document.getElementById("loading").classList.add("hidden");
    }, 140);
  }

  // This loads the dictionary, applies spelling preference, and starts the single Phaser scene.
  async function startGame() {
    try {
      updateLoading(18, "Building the word grid…");
      const count = await window.ChainWords.load();
      window.ChainWords.setSpelling(saveData.settings.spelling);
      document.documentElement.dataset.highContrast = saveData.settings.highContrast ? "true" : "false";
      updateLoading(82, count.toLocaleString("en-US") + " words online");
      // Phaser rasterizes its text, so waiting here prevents Safari from drawing a blurry fallback font.
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      // Render at the screen's real pixel density so Retina phones stay crisp without changing game coordinates.
      const pixelRatio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      const config = {
        type: Phaser.AUTO,
        parent: "game",
        backgroundColor: "#1A1A1D",
        resolution: pixelRatio,
        scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
        scene: [window.ChainScenes.AppScene],
        render: { antialias: true, pixelArt: false, roundPixels: true }
      };
      window.chainGame = new Phaser.Game(config);
      window.chainGame.canvas.setAttribute("tabindex", "0");
      window.chainGame.canvas.setAttribute("aria-label", "CHAIN word puzzle. Use arrow keys or WASD to move and SPACE to bank.");
      hideLoading();
    } catch (error) {
      updateLoading(0, "CHAIN could not start. Serve this folder locally, then refresh.");
      console.error(error);
    }
  }

  // This waits for the page and scripts before beginning dictionary loading.
  window.addEventListener("DOMContentLoaded", startGame);
}());
