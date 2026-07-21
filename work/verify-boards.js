const fs = require("node:fs");
const vm = require("node:vm");

globalThis.window = globalThis;
window.ChainWords = {
  solve: function solve() { return { word: "RATE", points: 4, path: [] }; },
  countReachableWords: function countReachableWords() { return 12; }
};
vm.runInThisContext(fs.readFileSync("js/board.js", "utf8"), { filename: "js/board.js" });

let minimumVowels = 64;
let maximumHighRares = 0;
for (let seed = 1; seed <= 10000; seed += 1) {
  const board = new ChainBoard.BoardModel({ mode: "daily", seed: seed });
  const counts = board.getLetterCounts();
  minimumVowels = Math.min(minimumVowels, counts.vowels);
  maximumHighRares = Math.max(maximumHighRares, counts.highRares);
  if (counts.vowels < 16) {
    throw new Error("Vowel floor failed at seed " + seed);
  }
  if (counts.highRares > 1 || counts.Q > 1 || counts.J > 1 || counts.X > 1 || counts.Z > 1) {
    throw new Error("High-rare cap failed at seed " + seed);
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

console.log("PASS: 10,000 boards, minimum vowels " + minimumVowels + ", maximum Q/J/X/Z total " + maximumHighRares);
console.log("PASS: reversing into the red trail is rejected as a fatal collision target");
