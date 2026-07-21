// This keeps every board rule deterministic, testable, and separate from how the game is drawn.
(function () {
  "use strict";

  const SIZE = 8;
  const VOWELS = new Set(["A", "E", "I", "O", "U"]);
  const HIGH_RARES = new Set(["Q", "J", "X", "Z"]);
  const ALL_RARES = new Set(["Q", "J", "X", "Z", "K", "V", "W", "Y"]);
  const FRIENDLY_WORDS = ["PLAY", "WORD", "RATE", "STAR", "TONE", "READ", "EARN", "NOTE"];
  const LETTER_WEIGHTS = {
    E: 12, A: 9, I: 9, O: 8, N: 7, R: 7, T: 7, L: 5, S: 5, U: 4,
    D: 4, G: 3, B: 2, C: 2, M: 2, P: 2, F: 2, H: 2, V: 1, W: 2,
    Y: 2, K: 1, J: 1, X: 1, Q: 1, Z: 1
  };

  // This creates the small seeded generator that makes Daily and board retries fully repeatable.
  function createMulberry32(seed) {
    let state = seed >>> 0;
    return {
      // This advances the seed once and returns a repeatable number from zero up to one.
      next: function next() {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      },
      // This exposes the current point in the sequence so an interrupted Daily can resume exactly.
      getState: function getState() {
        return state >>> 0;
      },
      // This restores the exact point in the sequence recorded in a saved run.
      setState: function setState(savedState) {
        state = savedState >>> 0;
      }
    };
  }

  // This produces a practical unsigned seed for a fresh Practice board.
  function randomSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
  }

  // This copies plain board data so rewind and persistence never share mutable cell objects.
  function copyData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // This owns one run's grid, random sequence, score, word history, undo, and rewind state.
  class BoardModel {
    // This restores a saved run or creates a verified fresh board from the requested seed.
    constructor(options) {
      const settings = options || {};
      this.mode = settings.mode === "daily" ? "daily" : "practice";
      this.seed = Number.isFinite(settings.seed) ? settings.seed >>> 0 : randomSeed();
      this.rng = createMulberry32(this.seed);
      this.history = [];
      if (settings.state) {
        this.restore(settings.state);
        this.history = copyData(settings.state.history || []);
      } else {
        this.score = 0;
        this.chain = "";
        this.head = { row: 3, column: 3 };
        this.bodyOrder = [];
        this.wordsFound = [];
        this.bankStreak = 0;
        this.rejectedBanks = 0;
        this.reviveUsed = false;
        this.lives = 2;
        this.freeStartEnabled = true;
        this.awaitingStart = false;
        this.startMode = "guided";
        this.roundsCompleted = 0;
        this.starterPath = [];
        this.starterWord = "";
        this.lastStarterWord = "";
        this.generateVerifiedBoard();
        this.prepareStart("guided");
      }
    }

    // This keeps one shared set of board rules for Daily and Practice so every player faces the same balance.
    getBoardRules() {
      return { vowelFloor: 16, rareMultiplier: 1 };
    }

    // This draws one letter from the required weighted distribution and shared board rules.
    drawLetter(restrictions) {
      const restrictionsToApply = restrictions || {};
      const entries = Object.keys(LETTER_WEIGHTS);
      const boardRules = this.getBoardRules();
      let total = 0;
      const weights = [];
      for (let index = 0; index < entries.length; index += 1) {
        const letter = entries[index];
        let weight = LETTER_WEIGHTS[letter];
        if (HIGH_RARES.has(letter)) {
          weight *= boardRules.rareMultiplier;
        }
        if ((restrictionsToApply.vowelsOnly && !VOWELS.has(letter)) || (restrictionsToApply.noHighRare && HIGH_RARES.has(letter)) || (restrictionsToApply.noRare && ALL_RARES.has(letter))) {
          weight = 0;
        }
        weights.push(weight);
        total += weight;
      }
      let target = this.rng.next() * total;
      for (let index = 0; index < entries.length; index += 1) {
        target -= weights[index];
        if (target < 0) {
          return entries[index];
        }
      }
      return restrictionsToApply.vowelsOnly ? "E" : "N";
    }

    // This fills all 64 cells from the weighted bag and puts the head in the centre.
    fillFreshGrid() {
      this.grid = [];
      this.head = { row: 3, column: 3 };
      this.bodyOrder = [];
      this.chain = "";
      this.starterPath = [];
      this.starterWord = "";
      for (let row = 0; row < SIZE; row += 1) {
        const cells = [];
        for (let column = 0; column < SIZE; column += 1) {
          cells.push({ letter: this.drawLetter(), state: "LETTER" });
        }
        this.grid.push(cells);
      }
      this.grid[this.head.row][this.head.column].state = "HEAD";
      this.enforceLetterConstraints();
    }

    // This regenerates until the board offers one strong route and at least 20 distinct opening words.
    generateVerifiedBoard() {
      for (let attempt = 0; attempt < 1000; attempt += 1) {
        this.fillFreshGrid();
        this.installFriendlyWord();
        this.enforceLetterConstraints();
        const best = window.ChainWords.solve(this.grid, this.head, { includeBody: false, minLength: 4 });
        const reachableWords = window.ChainWords.countReachableWords(this.grid, this.head);
        if (best && best.word.length >= 4 && reachableWords >= 20) {
          return best;
        }
      }
      throw new Error("CHAIN could not create a Daily board with 20 distinct opening words.");
    }

    // This pauses a fresh round before its first letter and exposes either one guided start or every tile.
    prepareStart(mode) {
      const currentHead = this.getCell(this.head.row, this.head.column);
      if (currentHead && currentHead.state === "HEAD") {
        currentHead.state = "LETTER";
      }
      this.bodyOrder = [];
      this.chain = "";
      this.awaitingStart = true;
      this.startMode = mode === "free" ? "free" : "guided";
    }

    // This makes the chosen tile the visible first letter, then locks the start for the rest of the round.
    selectStart(row, column, rememberSelection) {
      if (!this.awaitingStart) {
        return { selected: false };
      }
      const cell = this.getCell(row, column);
      const required = this.starterPath && this.starterPath[0];
      if (!cell || cell.state !== "LETTER" || (this.startMode === "guided" && (!required || required.row !== row || required.column !== column))) {
        return { selected: false };
      }
      if (rememberSelection !== false) {
        this.remember("start");
      }
      this.head = { row: row, column: column };
      cell.state = "HEAD";
      this.chain = cell.letter;
      this.bodyOrder = [];
      this.awaitingStart = false;
      const usedFriendlyStart = required && required.row === row && required.column === column;
      if (!usedFriendlyStart) {
        this.starterPath = [];
        this.starterWord = "";
      }
      return { selected: true, letter: cell.letter, point: copyData(this.head), guided: this.startMode === "guided" };
    }

    // This chooses the planted beginner route automatically after the free-start privilege has been lost.
    selectGuidedStart() {
      const required = this.starterPath && this.starterPath[0];
      return required ? this.selectStart(required.row, required.column, false) : { selected: false };
    }

    // This installs a reachable four-letter word only after random generation cannot provide one.
    forceSolvablePath() {
      this.enforceLetterConstraints(20);
      this.installWord("RATE");
      this.enforceLetterConstraints();
    }

    // This plants one familiar opening word selected by the same seeded sequence as the board.
    installFriendlyWord() {
      const startIndex = Math.floor(this.rng.next() * FRIENDLY_WORDS.length);
      let word = FRIENDLY_WORDS[startIndex];
      for (let offset = 0; offset < FRIENDLY_WORDS.length; offset += 1) {
        const candidate = FRIENDLY_WORDS[(startIndex + offset) % FRIENDLY_WORDS.length];
        if (!this.hasBankedWord(candidate) && candidate !== this.lastStarterWord) {
          word = candidate;
          break;
        }
      }
      const path = this.installWord(word);
      this.starterPath = path;
      this.starterWord = word;
      this.lastStarterWord = word;
      return path;
    }

    // This writes one word along an unused route from the current head without revealing it in the UI.
    installWord(word) {
      const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      const path = [];
      const used = new Set([this.head.row + ":" + this.head.column]);

      // This finds an unused route of the requested length from the current head.
      function findRoute(row, column) {
        if (path.length === word.length) {
          return true;
        }
        for (let index = 0; index < directions.length; index += 1) {
          const nextRow = row + directions[index][0];
          const nextColumn = column + directions[index][1];
          const key = nextRow + ":" + nextColumn;
          if (nextRow < 0 || nextRow >= SIZE || nextColumn < 0 || nextColumn >= SIZE || used.has(key)) {
            continue;
          }
          const cell = this.grid[nextRow][nextColumn];
          if (cell.state !== "LETTER") {
            continue;
          }
          used.add(key);
          path.push({ row: nextRow, column: nextColumn });
          if (findRoute.call(this, nextRow, nextColumn)) {
            return true;
          }
          path.pop();
          used.delete(key);
        }
        return false;
      }
      findRoute.call(this, this.head.row, this.head.column);
      for (let index = 0; index < path.length; index += 1) {
        this.grid[path[index].row][path[index].column].letter = word[index];
      }
      return path;
    }

    // This returns every cell except the head so constraint repairs never change the occupied head.
    getReplaceableCells() {
      const cells = [];
      // This marks every beginner-route position that must survive a fairness repair unchanged.
      const protectedCells = new Set((this.starterPath || []).map(function protectStarterCell(point) {
        return point.row + ":" + point.column;
      }));
      for (let row = 0; row < SIZE; row += 1) {
        for (let column = 0; column < SIZE; column += 1) {
          if ((row !== this.head.row || column !== this.head.column) && !protectedCells.has(row + ":" + column)) {
            cells.push(this.grid[row][column]);
          }
        }
      }
      return cells;
    }

    // This repairs rare-letter, Q-with-U, and vowel-floor rules after every generation or refill.
    enforceLetterConstraints(overrideVowelFloor) {
      const replaceable = this.getReplaceableCells();
      // This protects the hidden beginner route while fairness repairs adjust surrounding tiles.
      const protectedKeys = new Set((this.starterPath || []).map(function protectStarterRoute(point) {
        return point.row + ":" + point.column;
      }));
      const highRareCells = [];
      for (let row = 0; row < SIZE; row += 1) {
        for (let column = 0; column < SIZE; column += 1) {
          const cell = this.grid[row][column];
          if (HIGH_RARES.has(cell.letter)) {
            highRareCells.push(cell);
          }
        }
      }

      // This keeps a rare head letter and makes non-head duplicates the first repair targets.
      highRareCells.sort(function keepHeadRareFirst(first, second) {
        return first.state === "HEAD" ? -1 : (second.state === "HEAD" ? 1 : 0);
      });
      while (highRareCells.length > 1) {
        const cell = highRareCells.pop();
        cell.letter = this.drawLetter({ noRare: true });
      }

      const remainingRareCells = [];
      for (let row = 0; row < SIZE; row += 1) {
        for (let column = 0; column < SIZE; column += 1) {
          if (ALL_RARES.has(this.grid[row][column].letter)) {
            remainingRareCells.push(this.grid[row][column]);
          }
        }
      }
      // This keeps references to every beginner tile so rare-letter repairs cannot rewrite the route.
      const protectedRareCells = new Set((this.starterPath || []).map(function collectProtectedRareCell(point) {
        return this.grid[point.row][point.column];
      }.bind(this)));
      // This preserves the head and beginner route when trimming the broader rare-letter group.
      remainingRareCells.sort(function keepProtectedRaresFirst(first, second) {
        const firstProtected = first.state === "HEAD" || protectedRareCells.has(first);
        const secondProtected = second.state === "HEAD" || protectedRareCells.has(second);
        return firstProtected === secondProtected ? 0 : (firstProtected ? -1 : 1);
      });
      while (remainingRareCells.length > 4) {
        const cell = remainingRareCells.pop();
        cell.letter = this.drawLetter({ noRare: true });
      }

      let hasQ = false;
      let hasU = false;
      for (let row = 0; row < SIZE; row += 1) {
        for (let column = 0; column < SIZE; column += 1) {
          hasQ = hasQ || this.grid[row][column].letter === "Q";
          hasU = hasU || this.grid[row][column].letter === "U";
        }
      }
      if (hasQ && !hasU) {
        const index = Math.floor(this.rng.next() * replaceable.length);
        replaceable[index].letter = "U";
      }

      const vowelFloor = Number.isFinite(overrideVowelFloor) ? overrideVowelFloor : this.getBoardRules().vowelFloor;
      const consonants = [];
      let vowels = 0;
      for (let row = 0; row < SIZE; row += 1) {
        for (let column = 0; column < SIZE; column += 1) {
          const cell = this.grid[row][column];
          if (VOWELS.has(cell.letter)) {
            vowels += 1;
          } else if (cell.state !== "HEAD" && !protectedKeys.has(row + ":" + column)) {
            consonants.push(cell);
          }
        }
      }
      while (vowels < vowelFloor && consonants.length > 0) {
        const index = Math.floor(this.rng.next() * consonants.length);
        consonants.splice(index, 1)[0].letter = this.drawLetter({ vowelsOnly: true });
        vowels += 1;
      }
    }

    // This returns the tile at a position, or nothing when the requested position is off the board.
    getCell(row, column) {
      if (row < 0 || row >= SIZE || column < 0 || column >= SIZE) {
        return null;
      }
      return this.grid[row][column];
    }

    // This returns true when the requested direction is the player's immediately previous step.
    isStepBack(rowChange, columnChange) {
      if (this.history.length === 0) {
        return false;
      }
      const last = this.history[this.history.length - 1];
      if (last.kind !== "move") {
        return false;
      }
      return last.state.head.row === this.head.row + rowChange && last.state.head.column === this.head.column + columnChange;
    }

    // This checks whether a forward move enters an adjacent unused letter before the chain reaches nine.
    canMove(rowChange, columnChange) {
      if (this.awaitingStart || this.chain.length >= 9) {
        return false;
      }
      const destination = this.getCell(this.head.row + rowChange, this.head.column + columnChange);
      return Boolean(destination && destination.state === "LETTER");
    }

    // This stores one compact pre-action state and retains only the five actions Practice can rewind.
    remember(kind) {
      this.history.push({ kind: kind, state: this.snapshot() });
      if (this.history.length > 5) {
        this.history.shift();
      }
    }

    // This moves only onto a fresh letter. Every red body tile is fatal and Practice uses its separate rewind action.
    move(rowChange, columnChange) {
      const from = { row: this.head.row, column: this.head.column };
      if (!this.canMove(rowChange, columnChange)) {
        return {
          moved: false,
          blocked: true,
          target: { row: this.head.row + rowChange, column: this.head.column + columnChange }
        };
      }
      this.remember("move");
      const oldHead = this.getCell(this.head.row, this.head.column);
      oldHead.state = "BODY";
      this.bodyOrder.push(copyData(this.head));
      this.head = { row: this.head.row + rowChange, column: this.head.column + columnChange };
      const newHead = this.getCell(this.head.row, this.head.column);
      newHead.state = "HEAD";
      this.chain += newHead.letter;
      return { moved: true, undone: false, letter: newHead.letter, from: from, to: copyData(this.head) };
    }

    // This lists every unused letter tile the head may enter, excluding the separate step-back action.
    getLegalMoves() {
      const directions = [
        { row: -1, column: 0 }, { row: 1, column: 0 },
        { row: 0, column: -1 }, { row: 0, column: 1 }
      ];
      const legal = [];
      for (let index = 0; index < directions.length; index += 1) {
        if (this.canMove(directions[index].row, directions[index].column)) {
          legal.push(directions[index]);
        }
      }
      return legal;
    }

    // This reports whether a word has already scored in this run.
    hasBankedWord(word) {
      const normalized = String(word || "").toUpperCase();
      return this.wordsFound.some(function matchesBankedWord(entry) {
        return entry.word === normalized;
      });
    }

    // This declares death only when no fresh tile and no new valid bank can save the current run.
    isDead() {
      return !this.awaitingStart && this.getLegalMoves().length === 0 && (!window.ChainWords.isWord(this.chain) || this.hasBankedWord(this.chain));
    }

    // This applies the shared two-life rule to invalid words and red-trail collisions.
    loseLife(reason) {
      this.bankStreak = 0;
      this.rejectedBanks += 1;
      this.lives = Math.max(0, this.lives - 1);
      this.freeStartEnabled = false;
      if (this.lives === 0) {
        return { lifeLost: true, lives: 0, dead: true, reason: reason || "mistake" };
      }
      this.generateVerifiedBoard();
      this.prepareStart("guided");
      this.selectGuidedStart();
      return {
        lifeLost: true,
        lives: this.lives,
        dead: false,
        boardReset: true,
        reason: reason || "mistake"
      };
    }

    // This spends a life on an invalid guess or scores a valid word and opens a completely fresh round.
    bank() {
      if (this.awaitingStart) {
        return { banked: false, awaitingStart: true };
      }
      if (this.hasBankedWord(this.chain)) {
        this.rejectedBanks += 1;
        return { banked: false, duplicate: true, word: this.chain };
      }
      if (!window.ChainWords.isWord(this.chain)) {
        return Object.assign({ banked: false }, this.loseLife("invalid-word"));
      }
      this.remember("bank");
      const word = this.chain;
      const nextStreak = this.bankStreak + 1;
      const multiplier = window.ChainWords.getChainMultiplier(nextStreak);
      const points = Math.round(window.ChainWords.scoreWord(word) * multiplier);
      const rarity = window.ChainWords.getRarity(word);
      this.score += points;
      this.bankStreak = nextStreak;
      this.wordsFound.push({ word: word, points: points, rarity: rarity });
      this.roundsCompleted += 1;
      const refilled = [];
      for (let row = 0; row < SIZE; row += 1) {
        for (let column = 0; column < SIZE; column += 1) {
          refilled.push({ row: row, column: column });
        }
      }
      this.generateVerifiedBoard();
      if (this.freeStartEnabled) {
        this.prepareStart("free");
      } else {
        this.prepareStart("guided");
        this.selectGuidedStart();
      }
      return {
        banked: true,
        word: word,
        points: points,
        rarity: rarity,
        refilled: refilled,
        multiplier: multiplier,
        chooseStart: this.awaitingStart
      };
    }

    // This restores one of the five retained actions, including a bank and its score when needed.
    rewind() {
      if (this.mode !== "practice" || this.history.length === 0) {
        return { rewound: false };
      }
      const previous = this.history.pop();
      this.restore(previous.state);
      return { rewound: true, kind: previous.kind };
    }

    // This captures all mutable run details except rewind history itself.
    snapshot() {
      return {
        mode: this.mode,
        seed: this.seed,
        rngState: this.rng.getState(),
        grid: copyData(this.grid),
        head: copyData(this.head),
        bodyOrder: copyData(this.bodyOrder),
        chain: this.chain,
        score: this.score,
        wordsFound: copyData(this.wordsFound),
        bankStreak: this.bankStreak,
        rejectedBanks: this.rejectedBanks,
        reviveUsed: Boolean(this.reviveUsed),
        lives: this.lives,
        freeStartEnabled: Boolean(this.freeStartEnabled),
        awaitingStart: Boolean(this.awaitingStart),
        startMode: this.startMode,
        roundsCompleted: this.roundsCompleted,
        starterPath: copyData(this.starterPath || []),
        starterWord: this.starterWord || "",
        lastStarterWord: this.lastStarterWord || ""
      };
    }

    // This exports the complete run, including the five rewind states needed after a Daily refresh.
    exportState() {
      const state = this.snapshot();
      state.history = copyData(this.history);
      return state;
    }

    // This restores a previously captured board without changing the retained rewind list.
    restore(state) {
      this.mode = state.mode === "daily" ? "daily" : "practice";
      this.seed = state.seed >>> 0;
      if (!this.rng) {
        this.rng = createMulberry32(this.seed);
      }
      this.rng.setState(state.rngState >>> 0);
      this.grid = copyData(state.grid);
      this.head = copyData(state.head);
      this.bodyOrder = copyData(state.bodyOrder || []);
      this.chain = state.chain || "";
      this.score = state.score || 0;
      this.wordsFound = copyData(state.wordsFound || []);
      this.bankStreak = state.bankStreak || 0;
      this.rejectedBanks = state.rejectedBanks || 0;
      this.reviveUsed = Boolean(state.reviveUsed);
      this.lives = Number.isFinite(state.lives) ? state.lives : 2;
      this.freeStartEnabled = state.freeStartEnabled === undefined ? true : Boolean(state.freeStartEnabled);
      this.awaitingStart = state.awaitingStart === undefined
        ? this.chain.length === 0 && this.bodyOrder.length === 0
        : Boolean(state.awaitingStart);
      this.startMode = state.startMode === "free" ? "free" : "guided";
      this.roundsCompleted = state.roundsCompleted || this.wordsFound.length;
      this.starterPath = copyData(state.starterPath || []);
      this.starterWord = state.starterWord || "";
      this.lastStarterWord = state.lastStarterWord || this.starterWord || "";
      if (this.awaitingStart) {
        const restoredHead = this.getCell(this.head.row, this.head.column);
        if (restoredHead && restoredHead.state === "HEAD") {
          restoredHead.state = "LETTER";
        }
      }
    }

    // This produces a short stable fingerprint for comparing deterministic Daily runs.
    getHash() {
      // This turns each row into one stable letter-and-state string.
      const source = this.grid.map(function joinRow(row) {
        // This represents one tile using its letter and first state character.
        return row.map(function joinCell(cell) {
          return cell.letter + cell.state[0];
        }).join("");
      }).join("|") + "|" + this.head.row + "," + this.head.column + "|" + this.chain + "|" + this.score + "|" + this.rng.getState();
      let hash = 2166136261;
      for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, "0");
    }

    // This returns current board counts used by automated fairness checks and diagnostics.
    getLetterCounts() {
      const counts = { vowels: 0, highRares: 0, allRares: 0, Q: 0, J: 0, X: 0, Z: 0, U: 0 };
      for (let row = 0; row < SIZE; row += 1) {
        for (let column = 0; column < SIZE; column += 1) {
          const letter = this.grid[row][column].letter;
          if (VOWELS.has(letter)) {
            counts.vowels += 1;
          }
          if (HIGH_RARES.has(letter)) {
            counts.highRares += 1;
            counts[letter] += 1;
          }
          if (ALL_RARES.has(letter)) {
            counts.allRares += 1;
          }
          if (letter === "U") {
            counts.U += 1;
          }
        }
      }
      return counts;
    }
  }

  window.ChainBoard = {
    SIZE: SIZE,
    createMulberry32: createMulberry32,
    BoardModel: BoardModel
  };
}());
