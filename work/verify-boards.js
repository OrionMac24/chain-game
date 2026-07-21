const fs = require("node:fs");
const vm = require("node:vm");

globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync("js/words.js", "utf8"), { filename: "js/words.js" });
window.ChainWords.loadFromText(fs.readFileSync("data/words.txt", "utf8"));
vm.runInThisContext(fs.readFileSync("js/board.js", "utf8"), { filename: "js/board.js" });

let minimumVowels = 64;
let maximumHighRares = 0;
let minimumReachableWords = Infinity;
for (let seed = 1; seed <= 10000; seed += 1) {
  const board = new ChainBoard.BoardModel({ mode: "daily", seed: seed });
  const counts = board.getLetterCounts();
  const reachableWords = ChainWords.countReachableWords(board.grid, board.head);
  minimumVowels = Math.min(minimumVowels, counts.vowels);
  maximumHighRares = Math.max(maximumHighRares, counts.highRares);
  minimumReachableWords = Math.min(minimumReachableWords, reachableWords);
  if (counts.vowels < 16) {
    throw new Error("Vowel floor failed at seed " + seed);
  }
  if (counts.highRares > 1 || counts.Q > 1 || counts.J > 1 || counts.X > 1 || counts.Z > 1) {
    throw new Error("High-rare cap failed at seed " + seed);
  }
  if (reachableWords < 20) {
    throw new Error("Twenty-word opening guarantee failed at seed " + seed);
  }
}

const collisionBoard = new ChainBoard.BoardModel({ mode: "daily", seed: 20260721 });
const firstMove = collisionBoard.getLegalMoves()[0];
const startingHead = { row: collisionBoard.head.row, column: collisionBoard.head.column };
const moved = collisionBoard.move(firstMove.row, firstMove.column);
const reversed = collisionBoard.move(-firstMove.row, -firstMove.column);
const oldTile = collisionBoard.getCell(startingHead.row, startingHead.column);
if (!moved.moved || reversed.moved || oldTile.state !== "BODY") {
  throw new Error("Red-trail collision rule failed.");
}

const duplicateBoard = new ChainBoard.BoardModel({ mode: "daily", seed: 7719 });
const duplicateSolution = ChainWords.solve(duplicateBoard.grid, duplicateBoard.head, { minLength: 3 });
duplicateBoard.wordsFound.push({ word: duplicateSolution.word, points: duplicateSolution.points, rarity: duplicateSolution.rarity });
duplicateBoard.chain = duplicateSolution.word;
const scoreBeforeDuplicate = duplicateBoard.score;
const duplicateResult = duplicateBoard.bank();
if (duplicateResult.banked || !duplicateResult.duplicate || duplicateBoard.score !== scoreBeforeDuplicate || duplicateBoard.wordsFound.length !== 1) {
  throw new Error("Duplicate-word rejection rule failed.");
}

console.log("PASS: 10,000 boards, minimum vowels " + minimumVowels + ", maximum Q/J/X/Z total " + maximumHighRares + ", minimum reachable words " + minimumReachableWords);
console.log("PASS: reversing into the red trail is rejected as a fatal collision target");
console.log("PASS: a banked word cannot score twice");
