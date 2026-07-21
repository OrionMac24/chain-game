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
const guidedStart = collisionBoard.starterPath[0];
const selectedStart = collisionBoard.selectStart(guidedStart.row, guidedStart.column);
if (!selectedStart.selected || collisionBoard.chain !== collisionBoard.getCell(guidedStart.row, guidedStart.column).letter) {
  throw new Error("The marked START tile did not become the first letter.");
}
const firstMove = collisionBoard.getLegalMoves()[0];
const startingHead = { row: collisionBoard.head.row, column: collisionBoard.head.column };
const moved = collisionBoard.move(firstMove.row, firstMove.column);
const reversed = collisionBoard.move(-firstMove.row, -firstMove.column);
const oldTile = collisionBoard.getCell(startingHead.row, startingHead.column);
if (!moved.moved || reversed.moved || oldTile.state !== "BODY") {
  throw new Error("Red-trail collision rule failed.");
}
const collisionLife = collisionBoard.loseLife("red-trail");
if (!collisionLife.lifeLost || collisionLife.dead || collisionBoard.lives !== 1 || collisionBoard.freeStartEnabled) {
  throw new Error("The first red-trail collision did not spend one life and remove free starts.");
}

const duplicateBoard = new ChainBoard.BoardModel({ mode: "daily", seed: 7719 });
const duplicateStart = duplicateBoard.starterPath[0];
duplicateBoard.selectStart(duplicateStart.row, duplicateStart.column);
const duplicateSolution = ChainWords.solve(duplicateBoard.grid, duplicateBoard.head, { minLength: 3 });
duplicateBoard.wordsFound.push({ word: duplicateSolution.word, points: duplicateSolution.points, rarity: duplicateSolution.rarity });
duplicateBoard.chain = duplicateSolution.word;
const scoreBeforeDuplicate = duplicateBoard.score;
const duplicateResult = duplicateBoard.bank();
if (duplicateResult.banked || !duplicateResult.duplicate || duplicateBoard.score !== scoreBeforeDuplicate || duplicateBoard.wordsFound.length !== 1) {
  throw new Error("Duplicate-word rejection rule failed.");
}

const roundBoard = new ChainBoard.BoardModel({ mode: "daily", seed: 314159 });
const firstStarterWord = roundBoard.starterWord;
const roundStart = roundBoard.starterPath[0];
roundBoard.selectStart(roundStart.row, roundStart.column);
roundBoard.chain = firstStarterWord;
const successfulRound = roundBoard.bank();
if (!successfulRound.banked || !roundBoard.awaitingStart || roundBoard.startMode !== "free" || roundBoard.starterWord === firstStarterWord) {
  throw new Error("A correct word did not open a fresh free-start round with a different opening word.");
}
const freeStart = roundBoard.selectStart(0, 0);
roundBoard.chain = "ZZZZZZZZZ";
const firstMistake = roundBoard.bank();
if (!freeStart.selected || !firstMistake.lifeLost || firstMistake.dead || roundBoard.lives !== 1 || roundBoard.freeStartEnabled || roundBoard.awaitingStart) {
  throw new Error("The first invalid word did not remove one life and future free starts.");
}
roundBoard.chain = "ZZZZZZZZZ";
const secondMistake = roundBoard.bank();
if (!secondMistake.dead || roundBoard.lives !== 0) {
  throw new Error("The second invalid word did not end the run.");
}

console.log("PASS: 10,000 boards, minimum vowels " + minimumVowels + ", maximum Q/J/X/Z total " + maximumHighRares + ", minimum reachable words " + minimumReachableWords);
console.log("PASS: reversing into the red trail spends the first life and removes free starts");
console.log("PASS: a banked word cannot score twice");
console.log("PASS: START is the first letter, successful rounds refresh, and two invalid words consume two lives");
