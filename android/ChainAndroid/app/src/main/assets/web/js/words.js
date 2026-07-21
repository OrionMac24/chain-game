// This keeps dictionary work together so the rest of the game can ask simple word questions.
(function () {
  "use strict";

  const LETTER_VALUES = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
    J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
    S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
  };
  const LENGTH_MULTIPLIERS = { 3: 1, 4: 1.4, 5: 2, 6: 3, 7: 4.5, 8: 7, 9: 12 };
  const RARITY_MULTIPLIERS = { COMMON: 1, UNCOMMON: 1.25, RARE: 1.6, ELITE: 2.2 };
  const RARE_LETTERS = new Set(["J", "Q", "X", "Z", "K", "V", "W", "Y"]);
  const UK_ONLY = new Set([
    "COLOUR", "COLOURS", "COLOURED", "COLOURING", "FAVOUR", "FAVOURS", "FAVOURED", "FAVOURING",
    "HONOUR", "HONOURS", "HONOURED", "HONOURING", "CENTRE", "CENTRES", "THEATRE", "THEATRES",
    "METRE", "METRES", "LITRE", "LITRES", "DEFENCE", "OFFENCE", "LICENCE", "TRAVELLED", "TRAVELLER"
  ]);
  const US_ONLY = new Set([
    "COLOR", "COLORS", "COLORED", "COLORING", "FAVOR", "FAVORS", "FAVORED", "FAVORING",
    "HONOR", "HONORS", "HONORED", "HONORING", "CENTER", "CENTERS", "THEATER", "THEATERS",
    "METER", "METERS", "LITER", "LITERS", "DEFENSE", "OFFENSE", "LICENSE", "TRAVELED", "TRAVELER"
  ]);

  let allWords = [];
  let spelling = "US";
  let trieRoot = createNode();

  // This creates one small trie branch used to follow words letter by letter.
  function createNode() {
    return { children: Object.create(null), word: false, completions: 0 };
  }

  // This decides whether a word belongs in the currently selected spelling variant.
  function isAllowedSpelling(word) {
    if (spelling === "US" && UK_ONLY.has(word)) {
      return false;
    }
    if (spelling === "UK" && US_ONLY.has(word)) {
      return false;
    }
    return true;
  }

  // This adds one word to the trie and records capped completion counts along its path.
  function addToTrie(word) {
    let node = trieRoot;
    node.completions = Math.min(100, node.completions + 1);
    for (let index = 0; index < word.length; index += 1) {
      const letter = word[index];
      if (!node.children[letter]) {
        node.children[letter] = createNode();
      }
      node = node.children[letter];
      node.completions = Math.min(100, node.completions + 1);
    }
    node.word = true;
  }

  // This rebuilds the fast lookup structure after loading or changing spelling preference.
  function rebuildTrie() {
    trieRoot = createNode();
    for (let index = 0; index < allWords.length; index += 1) {
      if (isAllowedSpelling(allWords[index])) {
        addToTrie(allWords[index]);
      }
    }
  }

  // This accepts dictionary text directly so the same loading logic can be tested without a browser.
  function loadFromText(text) {
    const uniqueWords = new Set();
    const entries = text.split(/\r?\n/);
    for (let index = 0; index < entries.length; index += 1) {
      const word = entries[index].trim().toUpperCase();
      if (/^[A-Z]{3,9}$/.test(word)) {
        uniqueWords.add(word);
      }
    }
    allWords = Array.from(uniqueWords);
    rebuildTrie();
    return allWords.length;
  }

  // This loads the single local dictionary file and builds its trie in memory.
  async function load() {
    const response = await fetch("data/words.txt");
    if (!response.ok) {
      throw new Error("The dictionary could not be loaded.");
    }
    return loadFromText(await response.text());
  }

  // This switches between common US and UK variants and immediately refreshes word lookup.
  function setSpelling(variant) {
    spelling = variant === "UK" ? "UK" : "US";
    if (allWords.length > 0) {
      rebuildTrie();
    }
    return spelling;
  }

  // This follows a chain through the trie and returns its final branch when it exists.
  function findNode(chain) {
    const normalized = String(chain || "").toUpperCase();
    let node = trieRoot;
    for (let index = 0; index < normalized.length; index += 1) {
      node = node.children[normalized[index]];
      if (!node) {
        return null;
      }
    }
    return node;
  }

  // This reports whether the chain is a complete word in the selected spelling variant.
  function isWord(chain) {
    const node = findNode(chain);
    return Boolean(node && node.word && String(chain).length >= 3);
  }

  // This reports whether at least one allowed word begins with the supplied chain.
  function isPrefix(chain) {
    return Boolean(findNode(chain));
  }

  // This returns the number of possible words, capped at 100 so the interface can show 99+.
  function countCompletions(chain) {
    const node = findNode(chain);
    return node ? node.completions : 0;
  }

  // This approximates rarity until corpus-frequency tuning is completed in Phase 7.
  function getRarity(word) {
    const normalized = String(word).toUpperCase();
    let rareCount = 0;
    for (let index = 0; index < normalized.length; index += 1) {
      if (RARE_LETTERS.has(normalized[index])) {
        rareCount += 1;
      }
    }
    const rarityScore = normalized.length + rareCount * 1.35;
    if (rarityScore <= 4.25) {
      return "COMMON";
    }
    if (rarityScore <= 6.25) {
      return "UNCOMMON";
    }
    if (rarityScore <= 8.25) {
      return "RARE";
    }
    return "ELITE";
  }

  // This calculates a word's required score before the separate chain streak is applied.
  function scoreWord(word) {
    const normalized = String(word).toUpperCase();
    let letterTotal = 0;
    for (let index = 0; index < normalized.length; index += 1) {
      letterTotal += LETTER_VALUES[normalized[index]] || 0;
    }
    const rarity = getRarity(normalized);
    return Math.round(letterTotal * (LENGTH_MULTIPLIERS[normalized.length] || 0) * RARITY_MULTIPLIERS[rarity]);
  }

  // This translates a streak count into the whole-run multiplier shown during play.
  function getChainMultiplier(streak) {
    if (streak >= 10) {
      return 2;
    }
    if (streak >= 6) {
      return 1.5;
    }
    if (streak >= 3) {
      return 1.2;
    }
    return 1;
  }

  // This returns the exact live feedback state and copy for the chain under the board.
  function evaluateChain(chain, streak) {
    const normalized = String(chain || "").toUpperCase();
    const node = findNode(normalized);
    if (!normalized) {
      return { state: "BUILDING", icon: "◇", text: "Choose a letter to begin", completions: 100 };
    }
    if (!node) {
      return { state: "DEAD", icon: "×", text: "No word starts with this", completions: 0 };
    }
    const multiplier = getChainMultiplier((streak || 0) + 1);
    const points = Math.round(scoreWord(normalized) * multiplier);
    const hasLonger = Object.keys(node.children).length > 0;
    if (node.word && hasLonger) {
      return { state: "BANKABLE_PLUS", icon: "→", text: normalized + " · " + points + " pts · or keep going", points: points };
    }
    if (node.word) {
      return { state: "BANKABLE", icon: "◆", text: normalized + " · " + points + " pts", points: points };
    }
    const completions = node.completions;
    return {
      state: "BUILDING",
      icon: "◇",
      text: (completions >= 100 ? "99+" : completions) + " dictionary words begin this way",
      completions: completions
    };
  }

  // This finds the highest-scoring word reachable from the head without reusing a tile.
  function solve(board, head, options) {
    const settings = options || {};
    const includeBody = Boolean(settings.includeBody);
    const minimumLength = Number.isFinite(settings.minLength) ? settings.minLength : 3;
    const size = board.length;
    const visited = new Set([head.row + ":" + head.column]);
    let best = null;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // This explores one legal snake path and stops as soon as its letters leave the trie.
    function visit(row, column, node, word, path) {
      if (word.length >= minimumLength && node.word) {
        const points = scoreWord(word);
        if (!best || points > best.points || (points === best.points && word.length > best.word.length)) {
          best = { word: word, points: points, path: path.slice(), rarity: getRarity(word) };
        }
      }
      if (word.length >= 9) {
        return;
      }
      for (let index = 0; index < directions.length; index += 1) {
        const nextRow = row + directions[index][0];
        const nextColumn = column + directions[index][1];
        const key = nextRow + ":" + nextColumn;
        if (nextRow < 0 || nextRow >= size || nextColumn < 0 || nextColumn >= size || visited.has(key)) {
          continue;
        }
        const cell = board[nextRow][nextColumn];
        if (cell.state !== "LETTER" && !(includeBody && cell.state === "BODY")) {
          continue;
        }
        const nextNode = node.children[cell.letter];
        if (!nextNode) {
          continue;
        }
        visited.add(key);
        path.push({ row: nextRow, column: nextColumn });
        visit(nextRow, nextColumn, nextNode, word + cell.letter, path);
        path.pop();
        visited.delete(key);
      }
    }

    for (let index = 0; index < directions.length; index += 1) {
      const row = head.row + directions[index][0];
      const column = head.column + directions[index][1];
      if (row < 0 || row >= size || column < 0 || column >= size) {
        continue;
      }
      const cell = board[row][column];
      if (cell.state !== "LETTER" && !(includeBody && cell.state === "BODY")) {
        continue;
      }
      const node = trieRoot.children[cell.letter];
      if (!node) {
        continue;
      }
      const key = row + ":" + column;
      visited.add(key);
      visit(row, column, node, cell.letter, [{ row: row, column: column }]);
      visited.delete(key);
    }
    return best;
  }

  // This counts distinct words that can genuinely be reached from the current head without reusing a tile.
  function countReachableWords(board, head, options) {
    const settings = options || {};
    const includeBody = Boolean(settings.includeBody);
    const size = board.length;
    const visited = new Set([head.row + ":" + head.column]);
    const found = new Set();
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // This follows one legal route and records each complete dictionary word only once.
    function visit(row, column, node, word) {
      if (word.length >= 3 && node.word) {
        found.add(word);
      }
      if (word.length >= 9) {
        return;
      }
      for (let index = 0; index < directions.length; index += 1) {
        const nextRow = row + directions[index][0];
        const nextColumn = column + directions[index][1];
        const key = nextRow + ":" + nextColumn;
        if (nextRow < 0 || nextRow >= size || nextColumn < 0 || nextColumn >= size || visited.has(key)) {
          continue;
        }
        const cell = board[nextRow][nextColumn];
        if (cell.state !== "LETTER" && !(includeBody && cell.state === "BODY")) {
          continue;
        }
        const nextNode = node.children[cell.letter];
        if (!nextNode) {
          continue;
        }
        visited.add(key);
        visit(nextRow, nextColumn, nextNode, word + cell.letter);
        visited.delete(key);
      }
    }

    for (let index = 0; index < directions.length; index += 1) {
      const row = head.row + directions[index][0];
      const column = head.column + directions[index][1];
      if (row < 0 || row >= size || column < 0 || column >= size) {
        continue;
      }
      const cell = board[row][column];
      if (cell.state !== "LETTER" && !(includeBody && cell.state === "BODY")) {
        continue;
      }
      const node = trieRoot.children[cell.letter];
      if (!node) {
        continue;
      }
      const key = row + ":" + column;
      visited.add(key);
      visit(row, column, node, cell.letter);
      visited.delete(key);
    }
    return found.size;
  }

  // This verifies that a reported solver path is adjacent, non-repeating, and spells its word.
  function verifySolution(board, head, solution) {
    if (!solution || !solution.word || solution.path.length !== solution.word.length) {
      return false;
    }
    const used = new Set([head.row + ":" + head.column]);
    let previous = head;
    let letters = "";
    for (let index = 0; index < solution.path.length; index += 1) {
      const point = solution.path[index];
      const key = point.row + ":" + point.column;
      if (used.has(key) || Math.abs(point.row - previous.row) + Math.abs(point.column - previous.column) !== 1) {
        return false;
      }
      used.add(key);
      letters += board[point.row][point.column].letter;
      previous = point;
    }
    return letters === solution.word && isWord(letters);
  }

  window.ChainWords = {
    load: load,
    loadFromText: loadFromText,
    setSpelling: setSpelling,
    isWord: isWord,
    isPrefix: isPrefix,
    countCompletions: countCompletions,
    evaluateChain: evaluateChain,
    scoreWord: scoreWord,
    getRarity: getRarity,
    getChainMultiplier: getChainMultiplier,
    solve: solve,
    countReachableWords: countReachableWords,
    verifySolution: verifySolution
  };
}());
