// This file draws the snake as one readable rope and owns every movement-related visual cue.
(function () {
  "use strict";

  const DARK_BODY = Phaser.Display.Color.ValueToColor(0x842F38);
  const BRIGHT_BODY = Phaser.Display.Color.ValueToColor(0xD64B4B);

  // This converts a Phaser color object into the numeric format used by drawing commands.
  function colorNumber(color) {
    return Phaser.Display.Color.GetColor(color.r, color.g, color.b);
  }

  // This owns the rope, legal outlines, head, blocked feedback, and functional animations.
  class SnakeRenderer {
    // This remembers the scene and whether decorative motion should be reduced for accessibility.
    constructor(scene) {
      this.scene = scene;
      const savedMotion = window.ChainState && window.ChainState.get().settings.reducedMotion;
      this.reducedMotion = Boolean(savedMotion || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches));
      this.objects = [];
      this.tweens = [];
      this.tileSize = 48;
      this.startX = 0;
      this.startY = 0;
    }

    // This records the current grid geometry so every rope point lands on a tile centre.
    setGeometry(tileSize, startX, startY) {
      this.tileSize = tileSize;
      this.startX = startX;
      this.startY = startY;
    }

    // This converts one board position into its exact screen centre.
    centre(point) {
      return {
        x: this.startX + point.column * this.tileSize,
        y: this.startY + point.row * this.tileSize
      };
    }

    // This removes the previous snake drawings and stops their decorative tweens before redrawing.
    clear() {
      for (let index = 0; index < this.tweens.length; index += 1) {
        this.tweens[index].stop();
      }
      for (let index = 0; index < this.objects.length; index += 1) {
        this.objects[index].destroy();
      }
      this.tweens = [];
      this.objects = [];
      this.headContainer = null;
    }

    // This draws diagonal marks over occupied cells so blocked body tiles never rely on colour alone.
    drawHatches(board) {
      const graphics = this.scene.add.graphics().setDepth(1.4).setAlpha(0.22);
      graphics.lineStyle(1, 0xF2EDE4, 0.8);
      for (let row = 0; row < board.grid.length; row += 1) {
        for (let column = 0; column < board.grid[row].length; column += 1) {
          if (board.grid[row][column].state !== "BODY") {
            continue;
          }
          const point = this.centre({ row: row, column: column });
          const radius = this.tileSize * 0.31;
          graphics.beginPath();
          graphics.moveTo(point.x - radius, point.y + radius * 0.45);
          graphics.lineTo(point.x + radius * 0.45, point.y - radius);
          graphics.moveTo(point.x - radius * 0.45, point.y + radius);
          graphics.lineTo(point.x + radius, point.y - radius * 0.45);
          graphics.strokePath();
        }
      }
      this.objects.push(graphics);
      this.hatchGraphics = graphics;
    }

    // This draws the body as connected rounded segments with an age gradient from tail to head.
    drawRope(board) {
      if (board.bodyOrder.length === 0) {
        return;
      }
      const points = board.bodyOrder.concat([board.head]);
      const graphics = this.scene.add.graphics().setDepth(1.2);
      for (let index = 0; index < points.length - 1; index += 1) {
        const from = this.centre(points[index]);
        const to = this.centre(points[index + 1]);
        const ratio = points.length <= 2 ? 0.7 : index / (points.length - 2);
        const blended = Phaser.Display.Color.Interpolate.ColorWithColor(DARK_BODY, BRIGHT_BODY, 100, Math.round(ratio * 72));
        const width = this.tileSize * (index === 0 ? 0.48 : 0.6);
        const numericColor = colorNumber(blended);
        graphics.lineStyle(width, numericColor, 1);
        graphics.beginPath();
        graphics.moveTo(from.x, from.y);
        graphics.lineTo(to.x, to.y);
        graphics.strokePath();
        graphics.fillStyle(numericColor, 1);
        graphics.fillCircle(to.x, to.y, width / 2);
      }
      const tail = this.centre(points[0]);
      graphics.fillStyle(0x842F38, 1);
      graphics.fillCircle(tail.x, tail.y, this.tileSize * 0.24);
      this.objects.push(graphics);
      this.ropeGraphics = graphics;
    }

    // This outlines only fresh neighbouring letters so the next legal moves are obvious at a glance.
    drawLegalMoves(board) {
      const graphics = this.scene.add.graphics().setDepth(1.6).setAlpha(0.38);
      graphics.lineStyle(Math.max(3, this.tileSize * 0.055), 0xF2EDE4, 1);
      const moves = board.getLegalMoves();
      for (let index = 0; index < moves.length; index += 1) {
        const point = this.centre({
          row: board.head.row + moves[index].row,
          column: board.head.column + moves[index].column
        });
        graphics.strokeRoundedRect(
          point.x - this.tileSize * 0.49,
          point.y - this.tileSize * 0.49,
          this.tileSize * 0.98,
          this.tileSize * 0.98,
          this.tileSize * 0.12
        );
      }
      this.objects.push(graphics);
      this.legalGraphics = graphics;
      if (!this.reducedMotion && moves.length > 0) {
        const tween = this.scene.tweens.add({ targets: graphics, alpha: 0.46, duration: 750, yoyo: true, repeat: -1 });
        this.tweens.push(tween);
      }
    }

    // This creates the raised gold head and keeps its letter readable above the rope.
    drawHead(board, moveResult) {
      const destination = this.centre(board.head);
      const start = moveResult && moveResult.from ? this.centre(moveResult.from) : destination;
      const container = this.scene.add.container(start.x, start.y).setDepth(3);
      const shadow = this.scene.add.graphics();
      shadow.fillStyle(0x000000, 0.24);
      shadow.fillRoundedRect(-this.tileSize * 0.45 + 3, -this.tileSize * 0.45 + 4, this.tileSize * 0.9, this.tileSize * 0.9, this.tileSize * 0.14);
      const plate = this.scene.add.graphics();
      plate.fillStyle(0xD4A24C, 1);
      plate.fillRoundedRect(-this.tileSize * 0.45, -this.tileSize * 0.45, this.tileSize * 0.9, this.tileSize * 0.9, this.tileSize * 0.14);
      plate.lineStyle(Math.max(1, this.tileSize * 0.035), 0xF6D999, 0.8);
      plate.strokeRoundedRect(-this.tileSize * 0.45, -this.tileSize * 0.45, this.tileSize * 0.9, this.tileSize * 0.9, this.tileSize * 0.14);
      const letter = this.scene.add.text(0, 1, board.grid[board.head.row][board.head.column].letter, {
        fontFamily: "Arial, sans-serif",
        fontSize: Math.floor(this.tileSize * 0.43) + "px",
        fontStyle: "bold",
        color: "#1A1A1D"
      }).setOrigin(0.5);
      container.add([shadow, plate, letter]);
      container.setScale(1.08);
      this.objects.push(container);
      this.headContainer = container;

      if (moveResult && moveResult.from && !moveResult.undone) {
        const horizontal = Math.abs(destination.x - start.x) > 0;
        container.setScale(horizontal ? 1.13 : 1.04, horizontal ? 1.04 : 1.13);
        const tween = this.scene.tweens.add({
          targets: container,
          x: destination.x,
          y: destination.y,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: this.reducedMotion ? 80 : 110,
          ease: "Sine.easeOut"
        });
        this.tweens.push(tween);
      } else {
        container.setPosition(destination.x, destination.y);
      }

      if (!this.reducedMotion) {
        const breath = this.scene.tweens.add({ targets: container, scaleX: 1.11, scaleY: 1.11, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        this.tweens.push(breath);
      }
    }

    // This sends a faint light bead from the oldest segment toward the head every few seconds.
    drawFlowPulse(board) {
      if (this.reducedMotion || board.bodyOrder.length < 2) {
        return;
      }
      const points = board.bodyOrder.concat([board.head]).map(this.centre.bind(this));
      const bead = this.scene.add.circle(points[0].x, points[0].y, Math.max(2, this.tileSize * 0.08), 0xF2EDE4, 0).setDepth(1.7);
      const progress = { value: 0 };
      this.objects.push(bead);
      const tween = this.scene.tweens.add({
        targets: progress,
        value: points.length - 1,
        duration: 600,
        delay: 1900,
        repeatDelay: 1900,
        repeat: -1,
        // This places the light between its two surrounding rope points as the pulse advances.
        onUpdate: function updateFlow() {
          const lower = Math.floor(progress.value);
          const upper = Math.min(points.length - 1, lower + 1);
          const amount = progress.value - lower;
          bead.setPosition(
            Phaser.Math.Linear(points[lower].x, points[upper].x, amount),
            Phaser.Math.Linear(points[lower].y, points[upper].y, amount)
          );
          bead.setAlpha(Math.sin((progress.value / Math.max(1, points.length - 1)) * Math.PI) * 0.42);
        }
      });
      this.tweens.push(tween);
    }

    // This redraws every snake layer after the board changes while keeping letters above the rope.
    render(board, moveResult) {
      this.clear();
      this.drawHatches(board);
      this.drawRope(board);
      this.drawLegalMoves(board);
      this.drawHead(board, moveResult);
      this.drawFlowPulse(board);
    }

    // This nudges the head toward an illegal destination and flashes the blocked edge or body tile red.
    blockedFeedback(target, board) {
      if (!this.headContainer) {
        return;
      }
      const rowChange = Phaser.Math.Clamp(target.row - board.head.row, -1, 1);
      const columnChange = Phaser.Math.Clamp(target.column - board.head.column, -1, 1);
      const originalX = this.headContainer.x;
      const originalY = this.headContainer.y;
      const flashPoint = this.centre({
        row: Phaser.Math.Clamp(target.row, 0, SIZE_MINUS_ONE()),
        column: Phaser.Math.Clamp(target.column, 0, SIZE_MINUS_ONE())
      });
      const flash = this.scene.add.rectangle(flashPoint.x, flashPoint.y, this.tileSize * 0.88, this.tileSize * 0.88, 0xB04A3E, 0.4)
        .setDepth(4);
      this.objects.push(flash);
      if (this.hatchGraphics && this.getStateAt(board, target) === "BODY") {
        this.hatchGraphics.setAlpha(0.62);
      }
      const tween = this.scene.tweens.add({
        targets: this.headContainer,
        x: originalX + columnChange * 5,
        y: originalY + rowChange * 5,
        duration: 90,
        yoyo: true,
        ease: "Sine.easeOut",
        // This removes the red flash and returns the hatch to its quiet state after the nudge.
        onComplete: function finishBlockedFeedback() {
          flash.destroy();
          if (this.hatchGraphics) {
            this.hatchGraphics.setAlpha(0.22);
          }
        }.bind(this)
      });
      this.tweens.push(tween);
    }

    // This safely reads a state for blocked feedback without assuming the target is on the board.
    getStateAt(board, target) {
      if (target.row < 0 || target.row >= board.grid.length || target.column < 0 || target.column >= board.grid.length) {
        return "EDGE";
      }
      return board.grid[target.row][target.column].state;
    }

    // This runs a gold tail-to-head sweep before the scene clears and refills the body.
    animateBank(bodyOrder, head, onComplete) {
      const points = bodyOrder.concat([head]);
      const sweep = this.scene.add.graphics().setDepth(2.1).setAlpha(0);
      sweep.lineStyle(this.tileSize * 0.65, 0xF3C866, 0.85);
      for (let index = 0; index < points.length - 1; index += 1) {
        const from = this.centre(points[index]);
        const to = this.centre(points[index + 1]);
        sweep.beginPath();
        sweep.moveTo(from.x, from.y);
        sweep.lineTo(to.x, to.y);
        sweep.strokePath();
      }
      this.objects.push(sweep);
      const tween = this.scene.tweens.add({
        targets: sweep,
        alpha: 1,
        duration: 175,
        yoyo: true,
        // This returns control after the required sweep has travelled across the rope.
        onComplete: function finishBankSweep() {
          onComplete();
        }
      });
      this.tweens.push(tween);
    }

    // This flashes the body red, traces the missed word in gold, and then opens the summary panel.
    animateDeath(board, solution, onComplete) {
      const deathFlash = this.scene.add.graphics().setDepth(4).setAlpha(0);
      const bodyPoints = board.bodyOrder.concat([board.head]);
      deathFlash.lineStyle(this.tileSize * 0.64, 0xB04A3E, 0.82);
      for (let index = 0; index < bodyPoints.length - 1; index += 1) {
        const from = this.centre(bodyPoints[index]);
        const to = this.centre(bodyPoints[index + 1]);
        deathFlash.beginPath();
        deathFlash.moveTo(from.x, from.y);
        deathFlash.lineTo(to.x, to.y);
        deathFlash.strokePath();
      }
      const path = solution ? [board.head].concat(solution.path) : [];
      const missedPath = this.scene.add.graphics().setDepth(4.2).setAlpha(0);
      missedPath.lineStyle(Math.max(4, this.tileSize * 0.12), 0xD4A24C, 1);
      for (let index = 0; index < path.length - 1; index += 1) {
        const from = this.centre(path[index]);
        const to = this.centre(path[index + 1]);
        missedPath.beginPath();
        missedPath.moveTo(from.x, from.y);
        missedPath.lineTo(to.x, to.y);
        missedPath.strokePath();
      }
      this.objects.push(deathFlash, missedPath);
      const flashTween = this.scene.tweens.add({
        targets: deathFlash,
        alpha: 1,
        duration: 200,
        yoyo: true,
        // This begins the solver path only after the player's own rope has flashed.
        onComplete: function beginMissedPath() {
          this.scene.tweens.add({
            targets: missedPath,
            alpha: 1,
            duration: this.reducedMotion ? 200 : 600,
            // This opens the panel after the missed word is visible behind it.
            onComplete: function finishDeathAnimation() {
              onComplete(missedPath);
            }
          });
        }.bind(this)
      });
      this.tweens.push(flashTween);
    }

    // This removes all snake-owned objects when a scene or run is replaced.
    destroy() {
      this.clear();
    }
  }

  // This keeps the board-edge clamp readable inside blocked feedback.
  function SIZE_MINUS_ONE() {
    return window.ChainBoard.SIZE - 1;
  }

  window.ChainSnake = { SnakeRenderer: SnakeRenderer };
}());
