// This file draws every screen and connects visible controls to the underlying game rules.
(function () {
  "use strict";

  // This reads one visual value from the shared design-token file.
  function cssToken(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // This converts one CSS colour token into the number Phaser uses for drawing.
  function tokenColor(name) {
    return Phaser.Display.Color.HexStringToColor(cssToken(name)).color;
  }

  const COLORS = {
    background: tokenColor("--bg-base"),
    panel: tokenColor("--bg-panel"),
    elevated: tokenColor("--bg-elevated"),
    grid: tokenColor("--grid-line"),
    tile: tokenColor("--tile-face"),
    tileLetter: tokenColor("--tile-letter"),
    body: tokenColor("--tile-body"),
    bodyInk: tokenColor("--tile-body-ink"),
    cyan: tokenColor("--accent-cyan"),
    magenta: tokenColor("--accent-magenta"),
    green: tokenColor("--accent-lime"),
    red: tokenColor("--accent-magenta"),
    gold: tokenColor("--accent-lime"),
    white: cssToken("--ink-primary"),
    muted: cssToken("--ink-secondary"),
    tertiary: cssToken("--ink-tertiary"),
    ink: cssToken("--tile-letter")
  };

  const FONTS = {
    display: "Clash Display, sans-serif",
    ui: "Satoshi, sans-serif",
    data: "Geist Mono, monospace"
  };

  // This scene owns the home, game, summary, archive, and settings views without page navigation.
  class AppScene extends Phaser.Scene {
    // This gives the one application scene a stable name for browser checks and restarts.
    constructor() {
      super({ key: "AppScene" });
    }

    // This prepares collections used to cleanly replace screens and board drawings.
    init() {
      this.screenObjects = [];
      this.boardObjects = [];
      this.overlayObjects = [];
      this.orientationObjects = [];
      this.inputQueue = [];
      this.currentMode = "daily";
      this.screen = "home";
      this.animating = false;
      this.runEnded = false;
      this.coachingActive = false;
      this.lifeWarningActive = false;
      this.gameCoachStage = -1;
    }

    // This creates the keyboard connection and opens Daily as the hero mode.
    create() {
      this.cameras.main.setBackgroundColor(COLORS.background);
      this.snake = new window.ChainSnake.SnakeRenderer(this);
      this.input.keyboard.addCapture([
        Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.RIGHT,
        Phaser.Input.Keyboard.KeyCodes.SPACE
      ]);
      this.input.keyboard.on("keydown", this.handleKeyDown, this);
      this.input.on("pointerdown", this.handlePointerDown, this);
      this.input.on("pointerup", this.handlePointerUp, this);
      this.scale.on("resize", this.handleResize, this);
      this.events.once("shutdown", this.cleanUp, this);
      this.showHome("daily");
      if (this.isCompactLandscape()) {
        this.showOrientationNotice();
      }
    }

    // This remembers a display object so replacing a screen never leaves dead controls behind.
    track(object, group) {
      (group || this.screenObjects).push(object);
      return object;
    }

    // This destroys every object in one tracked collection and empties that collection.
    destroyGroup(group) {
      for (let index = 0; index < group.length; index += 1) {
        if (group[index] && group[index].destroy) {
          group[index].destroy();
        }
      }
      group.length = 0;
    }

    // This removes the current screen, board, overlays, and snake before drawing a different view.
    clearEverything() {
      this.destroyGroup(this.overlayObjects);
      this.destroyGroup(this.orientationObjects);
      this.destroyGroup(this.boardObjects);
      this.destroyGroup(this.screenObjects);
      if (this.feedbackTween) {
        this.feedbackTween.stop();
        this.feedbackTween = null;
      }
      this.snake.clear();
    }

    // This draws a flat restrained grid without a large decorative shape behind the interface.
    drawBackdrop() {
      const width = this.scale.width;
      const height = this.scale.height;
      const graphics = this.add.graphics().setDepth(-5);
      graphics.fillStyle(COLORS.background, 1);
      graphics.fillRect(0, 0, width, height);
      graphics.lineStyle(1, COLORS.grid, 0.35);
      for (let x = 0; x <= width; x += 44) {
        graphics.lineBetween(x, 0, x, height);
      }
      for (let y = 0; y <= height; y += 44) {
        graphics.lineBetween(0, y, width, y);
      }
      return this.track(graphics);
    }

    // This keeps the dense 8-by-8 board legible on short phones instead of crushing it into landscape.
    isCompactLandscape() {
      return this.scale.width > this.scale.height && this.scale.height < 500;
    }

    // This blocks accidental play beneath a clear instruction until the phone returns to portrait.
    showOrientationNotice() {
      this.destroyGroup(this.orientationObjects);
      const width = this.scale.width;
      const height = this.scale.height;
      const shade = this.add.rectangle(width / 2, height / 2, width, height, COLORS.background, 0.98)
        .setDepth(100).setInteractive();
      this.track(shade, this.orientationObjects);
      this.track(this.add.text(width / 2, height / 2 - 30, "TURN  YOUR  PHONE", {
        fontFamily: FONTS.display, fontSize: "30px", fontStyle: "bold", color: COLORS.white
      }).setOrigin(0.5).setDepth(101), this.orientationObjects);
      this.track(this.add.text(width / 2, height / 2 + 22, "CHAIN is designed for portrait play.\nRotate upright for a sharp, full-size board.", {
        fontFamily: FONTS.ui, fontSize: "15px", color: COLORS.muted, align: "center", lineSpacing: 6
      }).setOrigin(0.5).setDepth(101), this.orientationObjects);
      this.track(this.add.rectangle(width / 2, height / 2 + 82, 64, 3, COLORS.cyan, 1).setDepth(101), this.orientationObjects);
    }

    // This creates one angular working button with hover and disabled states.
    createButton(label, x, y, width, onClick, options) {
      const settings = options || {};
      const container = this.add.container(x, y).setDepth(settings.depth || 10);
      const fill = settings.fill === undefined ? COLORS.tile : settings.fill;
      const stroke = settings.stroke === undefined ? fill : settings.stroke;
      const buttonHeight = Math.max(48, settings.height || 52);
      const background = this.add.rectangle(0, 0, width, buttonHeight, fill, settings.alpha === undefined ? 0.94 : settings.alpha)
        .setStrokeStyle(settings.strokeWidth === undefined ? 1 : settings.strokeWidth, stroke, settings.strokeAlpha === undefined ? 0.92 : settings.strokeAlpha);
      const brightFill = fill === COLORS.tile || fill === COLORS.cyan || fill === COLORS.magenta || fill === COLORS.green;
      const displayLabel = String(label).replace(/ +/g, "  ");
      const text = this.add.text(0, 0, displayLabel, {
        fontFamily: FONTS.ui,
        fontSize: (settings.fontSize || 15) + "px",
        fontStyle: "bold",
        color: settings.textColor || (brightFill ? COLORS.ink : COLORS.white),
        letterSpacing: settings.letterSpacing === undefined ? 0.8 : settings.letterSpacing,
        align: "center"
      }).setOrigin(0.5);
      container.add([background, text]);
      container.background = background;
      container.label = text;
      if (!settings.disabled) {
        background.setInteractive({ useHandCursor: true });
        // This runs the real action only after the player releases the pointer over the button.
        background.on("pointerup", onClick);
        // This makes desktop hover unmistakable while preserving the same working touch target.
        background.on("pointerover", function showButtonHover() {
          background.setFillStyle(settings.hoverFill === undefined ? fill : settings.hoverFill);
          background.setStrokeStyle(settings.hoverStrokeWidth || 2, settings.hoverStroke === undefined ? stroke : settings.hoverStroke, 1);
          background.setAlpha(settings.hoverAlpha === undefined ? 0.92 : settings.hoverAlpha);
          text.setColor(settings.hoverTextColor || settings.textColor || (brightFill ? COLORS.ink : COLORS.white));
          container.setScale(settings.hoverScale || 1.015);
        });
        // This restores the normal button opacity when the pointer leaves.
        background.on("pointerout", function hideButtonHover() {
          background.setFillStyle(fill);
          background.setStrokeStyle(settings.strokeWidth === undefined ? 1 : settings.strokeWidth, stroke, settings.strokeAlpha === undefined ? 0.92 : settings.strokeAlpha);
          background.setAlpha(settings.alpha === undefined ? 0.94 : settings.alpha);
          text.setColor(settings.textColor || (brightFill ? COLORS.ink : COLORS.white));
          container.setScale(1);
        });
      } else {
        background.setAlpha(0.36);
        text.setAlpha(0.56);
      }
      return this.track(container, settings.group || this.screenObjects);
    }

    // This draws the persistent Daily and Practice segmented control on non-gameplay screens.
    createModeSwitcher(mode, y, group) {
      const active = mode === "practice" ? "practice" : "daily";
      const width = Math.min(460, this.scale.width - 48);
      const gap = 12;
      const segment = (width - gap) / 2;
      const x = this.scale.width / 2;
      const offset = (segment + gap) / 2;
      this.createButton("DAILY", x - offset, y, segment, this.showHome.bind(this, "daily"), {
        fill: active === "daily" ? COLORS.cyan : COLORS.panel,
        stroke: COLORS.cyan,
        textColor: active === "daily" ? COLORS.ink : COLORS.tertiary,
        alpha: active === "daily" ? 0.94 : 0.72,
        strokeAlpha: 0.95,
        strokeWidth: active === "daily" ? 2 : 1,
        hoverFill: active === "daily" ? COLORS.cyan : COLORS.elevated,
        hoverStroke: COLORS.cyan,
        hoverTextColor: active === "daily" ? COLORS.ink : "#04E7F0",
        height: 44,
        fontSize: 13,
        group: group
      });
      this.createButton("PRACTICE", x + offset, y, segment, this.showHome.bind(this, "practice"), {
        fill: active === "practice" ? COLORS.magenta : COLORS.panel,
        stroke: COLORS.magenta,
        textColor: active === "practice" ? COLORS.ink : COLORS.tertiary,
        alpha: active === "practice" ? 0.94 : 0.72,
        strokeAlpha: 0.95,
        strokeWidth: active === "practice" ? 2 : 1,
        hoverFill: active === "practice" ? COLORS.magenta : COLORS.elevated,
        hoverStroke: COLORS.magenta,
        hoverTextColor: active === "practice" ? COLORS.ink : "#FF168B",
        height: 44,
        fontSize: 13,
        group: group
      });
    }

    // This draws the Daily-first home and gives every visible action a working destination.
    showHome(mode) {
      this.currentMode = mode === "practice" ? "practice" : "daily";
      this.screen = "home";
      this.runEnded = false;
      this.lifeWarningActive = false;
      this.clearEverything();
      this.drawBackdrop();
      const width = this.scale.width;
      const height = this.scale.height;
      const centreX = width / 2;
      const save = window.ChainState.get();
      const compactHome = height < 700;
      const titleY = compactHome ? 44 : Math.max(52, height * 0.075);
      const title = this.add.text(centreX, titleY, "CHAIN", {
        fontFamily: FONTS.display,
        fontSize: Math.min(48, Math.max(40, width * 0.055)) + "px",
        fontStyle: "bold",
        color: COLORS.white,
        letterSpacing: 3
      }).setOrigin(0.5);
      this.track(title);
      this.track(this.add.rectangle(centreX + Math.min(112, width * 0.17), titleY + 14, 7, 7, COLORS.magenta, 1));
      this.track(this.add.rectangle(centreX - Math.min(111, width * 0.17), titleY - 14, 24, 3, COLORS.cyan, 1));
      this.createModeSwitcher(this.currentMode, titleY + (compactHome ? 72 : 82));

      const heroY = titleY + (compactHome ? 134 : 150);
      if (this.currentMode === "daily") {
        this.drawDailyHome(heroY, save);
      } else {
        this.drawPracticeHome(heroY, save);
      }

      const activityY = compactHome
        ? Math.min(height - (height < 620 ? 205 : 185), heroY + 220)
        : Math.min(height - 205, heroY + 230);
      this.drawWeekActivity(activityY, save);
      const veryShortHome = height < 620;
      const scoreY = activityY + (veryShortHome ? 78 : (compactHome ? 88 : 96));
      const scoreWidth = Math.min(260, width - 72);
      const scoreHeight = veryShortHome ? 38 : 48;
      const homeScore = window.ChainOnline.homeScore(save.bestScore);
      this.track(this.add.rectangle(centreX, scoreY, scoreWidth, scoreHeight, COLORS.panel, 0.96)
        .setStrokeStyle(1, COLORS.grid, 0.75));
      this.track(this.add.text(centreX - scoreWidth / 2 + 16, scoreY, homeScore.label, {
        fontFamily: FONTS.ui, fontSize: (width < 360 ? 9 : 10) + "px", fontStyle: "bold", color: COLORS.muted, letterSpacing: 0.8
      }).setOrigin(0, 0.5));
      this.track(this.add.text(centreX + scoreWidth / 2 - 16, scoreY, homeScore.value, {
        fontFamily: FONTS.data, fontSize: (veryShortHome ? 18 : 22) + "px", fontStyle: "bold", color: "#69F23B", letterSpacing: 0.4
      }).setOrigin(1, 0.5));
      const utilityY = veryShortHome ? scoreY + 40 : scoreY + (compactHome ? 62 : 68);
      const utilityGap = 14;
      const utilityWidth = Math.min(150, (width - 48 - utilityGap) / 2);
      const utilityOffset = (utilityWidth + utilityGap) / 2;
      this.createButton("HOW TO PLAY", centreX - utilityOffset, utilityY, utilityWidth, this.showTutorial.bind(this, 0), {
        fill: COLORS.panel, stroke: COLORS.grid, textColor: COLORS.white, height: 38, fontSize: 11
      });
      this.createButton("LEADERBOARD", centreX + utilityOffset, utilityY, utilityWidth, window.ChainOnline.openLeaderboard, {
        fill: COLORS.panel, stroke: COLORS.grid, textColor: COLORS.white, height: 38, fontSize: 10
      });
      const utilityRowGap = veryShortHome ? 58 : 62;
      this.createButton(window.ChainOnline.accountLabel(), centreX - utilityOffset, utilityY + utilityRowGap, utilityWidth, window.ChainOnline.openAccount, {
        fill: COLORS.panel, stroke: COLORS.grid, textColor: COLORS.white, height: 38, fontSize: 11
      });
      this.createButton("SETTINGS", centreX + utilityOffset, utilityY + utilityRowGap, utilityWidth, this.showSettings.bind(this), {
        fill: COLORS.panel, stroke: COLORS.grid, textColor: COLORS.white, height: 38, fontSize: 12
      });
      if (!save.tutorialSeen && !this.tutorialActive) {
        // This opens the guide after the home screen is visible on a player's first visit.
        this.time.delayedCall(90, this.showTutorial, [0], this);
      }
    }

    // This draws only the information needed to enter today's global challenge.
    drawDailyHome(heroY) {
      const centreX = this.scale.width / 2;
      const todayResult = window.ChainState.getDailyResult();
      const progress = window.ChainState.getDailyProgress();
      const number = window.ChainState.dailyNumber();
      this.track(this.add.text(centreX, heroY, "TODAY'S GLOBAL CHALLENGE", {
        fontFamily: FONTS.data, fontSize: "11px", fontStyle: "bold", color: cssToken("--accent-lime"), letterSpacing: 1.8
      }).setOrigin(0.5));
      this.track(this.add.text(centreX, heroY + 32, "CHAIN #" + number, {
        fontFamily: FONTS.display, fontSize: "32px", fontStyle: "bold", color: COLORS.white
      }).setOrigin(0.5));
      if (todayResult) {
        const qualified = todayResult.qualified === true || todayResult.words >= window.ChainState.dailyTarget;
        this.createButton(qualified ? "TOMORROW UNLOCKED  ✓" : "RUN ENDED · TRY TOMORROW", centreX, heroY + 92, Math.min(460, this.scale.width - 48), function noAction() {}, {
          fill: COLORS.panel, stroke: qualified ? COLORS.green : COLORS.red,
          textColor: qualified ? cssToken("--accent-lime") : "#FF8085", height: 56, fontSize: 13, disabled: true
        });
      } else {
        this.createButton(progress ? "RESUME TODAY" : "PLAY TODAY'S CHAIN", centreX, heroY + 92, Math.min(460, this.scale.width - 48), this.startDaily.bind(this), {
          fill: COLORS.magenta, stroke: COLORS.magenta, height: 56, fontSize: 15
        });
      }
    }

    // This draws the unlimited Practice entry and the archive of past shared boards.
    drawPracticeHome(heroY) {
      const centreX = this.scale.width / 2;
      const compactPractice = this.scale.height < 620;
      this.track(this.add.text(centreX, heroY, "PRACTICE", {
        fontFamily: FONTS.data, fontSize: "11px", fontStyle: "bold", color: cssToken("--accent-lime"), letterSpacing: 2
      }).setOrigin(0.5));
      this.track(this.add.text(centreX, heroY + (compactPractice ? 30 : 34), "UNLIMITED  BOARDS", {
        fontFamily: FONTS.display, fontSize: (this.scale.width < 360 ? 26 : 30) + "px", fontStyle: "bold", color: COLORS.white
      }).setOrigin(0.5));
      this.track(this.add.text(centreX, heroY + (compactPractice ? 58 : 66), "Retry, rewind, and sharpen your word finding.", {
        fontFamily: FONTS.ui, fontSize: (this.scale.width < 360 ? 12 : 13) + "px", color: COLORS.muted
      }).setOrigin(0.5));
      this.createButton("START PRACTICE", centreX, heroY + (compactPractice ? 96 : 112), Math.min(460, this.scale.width - 48), this.startPractice.bind(this, null, "Practice"), {
        fill: COLORS.magenta, stroke: COLORS.magenta, height: 58, fontSize: 16
      });
      this.createButton("DAILY ARCHIVE", centreX, heroY + (compactPractice ? 151 : 178), Math.min(280, this.scale.width - 64), this.showArchive.bind(this), {
        fill: COLORS.panel, stroke: COLORS.grid, textColor: COLORS.white, height: 42, fontSize: 12
      });
    }

    // This shows the current Sunday-to-Saturday Daily activity without another large panel.
    drawWeekActivity(y, save) {
      const centreX = this.scale.width / 2;
      const compactWeek = this.scale.height < 620;
      const initials = ["S", "M", "T", "W", "T", "F", "S"];
      const today = new Date();
      const sunday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      sunday.setUTCDate(today.getUTCDate() - today.getUTCDay());
      const gap = Math.min(48, (this.scale.width - 80) / 7);
      for (let index = 0; index < 7; index += 1) {
        const date = new Date(sunday);
        date.setUTCDate(sunday.getUTCDate() + index);
        const played = Boolean(window.ChainState.getDailyResult(window.ChainState.dateKey(date)));
        const x = centreX + (index - 3) * gap;
        this.track(this.add.text(x, y, initials[index], {
          fontFamily: FONTS.ui, fontSize: "12px", fontStyle: "bold", color: played ? COLORS.white : COLORS.muted
        }).setOrigin(0.5));
        const circleY = y + (compactWeek ? 22 : 27);
        this.track(this.add.circle(x, circleY, compactWeek ? 12 : 14, played ? COLORS.elevated : COLORS.panel, 1)
          .setStrokeStyle(1, played ? COLORS.magenta : COLORS.grid, played ? 0.8 : 0.55));
        if (played) {
          this.track(this.add.text(x, circleY, "🔥", { fontSize: (compactWeek ? 10 : 12) + "px" }).setOrigin(0.5));
        }
      }
      this.track(this.add.text(centreX, y + (compactWeek ? 48 : 58), save.dailyResults.length + (save.dailyResults.length === 1 ? " DAY PLAYED" : " DAYS PLAYED"), {
        fontFamily: FONTS.ui, fontSize: "12px", fontStyle: "bold", color: COLORS.muted, letterSpacing: 0.8
      }).setOrigin(0.5));
    }

    // This starts or resumes today's deterministic one-attempt run.
    startDaily() {
      if (window.ChainState.getDailyResult()) {
        this.showHome("daily");
        return;
      }
      const progress = window.ChainState.getDailyProgress();
      const seed = Number(window.ChainState.dateKey());
      const board = new window.ChainBoard.BoardModel({ mode: "daily", seed: seed, state: progress ? progress.board : null });
      this.beginRun(board, "DAILY #" + window.ChainState.dailyNumber(), "daily");
      window.ChainState.saveDailyProgress(this.board);
    }

    // This starts a fresh, retried, or archived Practice board using the supplied seed when present.
    startPractice(seed, label) {
      const board = new window.ChainBoard.BoardModel({ mode: "practice", seed: Number.isFinite(seed) ? seed : undefined });
      this.beginRun(board, label || "PRACTICE", "practice");
    }

    // This replaces menus with the complete game HUD and renders the first verified board.
    beginRun(board, label, mode) {
      this.clearEverything();
      this.drawBackdrop();
      this.screen = "game";
      this.currentMode = mode;
      this.board = board;
      this.runLabel = label;
      this.initialSeed = board.seed;
      this.runEnded = false;
      this.runStartedAt = Date.now();
      this.preMoveState = board.exportState();
      this.animating = false;
      this.inputQueue = [];
      this.startingWordCount = window.ChainWords.countReachableWords(this.board.grid, this.board.head);
      this.createGameHud();
      this.layoutGame();
      this.renderBoard();
      this.updateChainFeedback();
      const save = window.ChainState.get();
      if (!save.gameplayGuideSeen && this.board.chain.length === 0 && this.board.wordsFound.length === 0) {
        this.gameCoachStage = 0;
        this.coachingActive = true;
        // This lets the board settle before the first contextual lesson appears over it.
        this.time.delayedCall(220, this.showGameCoach, [0], this);
      }
    }

    // This pauses the first live run and points directly at the board feature being explained.
    showGameCoach(stage) {
      this.destroyGroup(this.overlayObjects);
      this.coachingActive = true;
      const lessons = [
        {
          label: "STEP 1 OF 3 · PICK YOUR FIRST LETTER",
          body: "Tap the cyan START tile. That letter becomes the first letter of your word. After a correct word, you can choose any tile to begin the next round.",
          action: "SHOW ME"
        },
        {
          label: "STEP 2 OF 3 · READ YOUR TRAIL",
          body: "The tile behind you is now red. Every red tile is your used body. Touch any red tile and the run ends. Practice has a separate REWIND button while you learn.",
          action: "I SEE IT"
        },
        {
          label: "STEP 3 OF 3 · BANK OR KEEP BUILDING",
          body: "When your word turns gold, BANK scores it. Each word scores once. An invalid word, red-trail hit, or boxed-in path costs a life. One more mistake ends the run.",
          action: "GOT IT"
        }
      ];
      const lesson = lessons[stage];
      const width = this.scale.width;
      const panelWidth = Math.min(620, width - 48);
      this.track(this.add.rectangle(width / 2, this.scale.height - 104, panelWidth, 168, 0x07111E, 0.98)
        .setStrokeStyle(2, stage === 1 ? 0xFF6B70 : COLORS.cyan, 0.95).setDepth(54), this.overlayObjects);
      this.track(this.add.text(width / 2, this.scale.height - 157, lesson.label, {
        fontFamily: FONTS.data, fontSize: "11px", fontStyle: "bold", color: stage === 1 ? "#FF8085" : "#69F23B", letterSpacing: 1.2
      }).setOrigin(0.5).setDepth(55), this.overlayObjects);
      this.track(this.add.text(width / 2, this.scale.height - 119, lesson.body, {
        fontFamily: FONTS.ui, fontSize: "13px", color: "#D7E6F3", align: "center",
        lineSpacing: 4, wordWrap: { width: panelWidth - 48 }
      }).setOrigin(0.5).setDepth(55), this.overlayObjects);
      this.createButton(lesson.action, width / 2, this.scale.height - 55, 180, this.dismissGameCoach.bind(this, stage), {
        fill: stage === 1 ? COLORS.red : COLORS.cyan, stroke: stage === 1 ? 0xFF8085 : COLORS.cyan,
        height: 38, fontSize: 11, depth: 56, group: this.overlayObjects
      });

      let focus = null;
      if (stage === 0 && this.board.starterPath && this.board.starterPath[0]) {
        focus = this.board.starterPath[0];
      } else if (stage === 1 && this.board.bodyOrder.length > 0) {
        focus = this.board.bodyOrder[this.board.bodyOrder.length - 1];
      }
      if (focus) {
        const focusX = this.gridStartX + focus.column * this.tileSize;
        const focusY = this.gridStartY + focus.row * this.tileSize;
        const ring = this.add.rectangle(focusX, focusY, this.tileSize - 1, this.tileSize - 1, 0x000000, 0)
          .setStrokeStyle(4, stage === 1 ? 0xFF8085 : COLORS.cyan, 1).setDepth(53);
        this.track(ring, this.overlayObjects);
        this.tweens.add({ targets: ring, alpha: 0.35, duration: 520, yoyo: true, repeat: -1 });
      }
    }

    // This returns control after one lesson and remembers completion after the banking lesson.
    dismissGameCoach(stage) {
      this.destroyGroup(this.overlayObjects);
      this.coachingActive = false;
      this.gameCoachStage = stage + 1;
      if (this.gameCoachStage >= 3) {
        window.ChainState.completeGameplayGuide();
      }
    }

    // This creates the persistent score, multiplier, pause, chain, and action controls for a run.
    createGameHud() {
      const compactLabel = this.scale.width < 380 && this.currentMode === "practice" ? "PRACTICE" : this.runLabel;
      this.modeLabel = this.track(this.add.text(22, 25, compactLabel, {
        fontFamily: FONTS.data, fontSize: (this.scale.width < 360 ? 11 : 13) + "px", fontStyle: "bold", color: this.currentMode === "daily" ? "#04E7F0" : "#FF168B", letterSpacing: 1.2
      }));
      this.scoreText = this.track(this.add.text(this.scale.width / 2, 25, "SCORE 0", {
        fontFamily: FONTS.data, fontSize: (this.scale.width < 360 ? 14 : 16) + "px", fontStyle: "bold", color: COLORS.white
      }).setOrigin(0.5, 0));
      this.multiplierText = this.track(this.add.text(16, 61, "MULTIPLIER  ×1", {
        fontFamily: FONTS.data, fontSize: "10px", fontStyle: "bold", color: "#F3C866",
        backgroundColor: "#111720", padding: { x: 7, y: 5 }, letterSpacing: 0.4
      }));
      this.livesText = this.track(this.add.text(this.scale.width - 16, 61, "LIVES  2/2  ♥♥", {
        fontFamily: FONTS.data, fontSize: "10px", fontStyle: "bold", color: "#FF8085",
        backgroundColor: "#111720", padding: { x: 7, y: 5 }, letterSpacing: 0.4
      }).setOrigin(1, 0));
      this.wordCountText = this.track(this.add.text(this.scale.width / 2, 92, "", {
        fontFamily: FONTS.data, fontSize: (this.scale.width < 360 ? 8 : 9) + "px", fontStyle: "bold", color: "#04E7F0", letterSpacing: 0.6
      }).setOrigin(0.5, 0));
      this.pauseButton = this.createButton("II", this.scale.width - 28, 33, 38, this.showPause.bind(this), {
        fill: COLORS.panel, stroke: 0x77737C, textColor: COLORS.white, height: 34, fontSize: 13
      });
      this.chainText = this.track(this.add.text(0, 0, "", {
        fontFamily: FONTS.display, fontSize: "29px", fontStyle: "bold", color: COLORS.white, align: "center"
      }).setOrigin(0.5));
      this.feedbackText = this.track(this.add.text(0, 0, "", {
        fontFamily: FONTS.ui, fontSize: "14px", color: COLORS.muted, align: "center"
      }).setOrigin(0.5));
      this.feedbackUnderline = this.track(this.add.rectangle(0, 0, 170, 2, COLORS.red, 0).setOrigin(0.5));
      const actionWidth = this.currentMode === "practice"
        ? Math.min(180, (this.scale.width - 60) / 2)
        : Math.min(220, this.scale.width - 64);
      this.bankButton = this.createButton("BANK", 0, 0, actionWidth, this.tryBank.bind(this), {
        fill: COLORS.tile, stroke: COLORS.tile, height: 50, fontSize: 16
      });
      if (this.currentMode === "practice") {
        this.rewindButton = this.createButton("REWIND ↺", 0, 0, actionWidth, this.tryRewind.bind(this), {
          fill: COLORS.panel, stroke: COLORS.cyan, textColor: "#04E7F0", height: 50, fontSize: 13
        });
      }
    }

    // This computes board and HUD positions from the current browser size.
    layoutGame() {
      const width = this.scale.width;
      const height = this.scale.height;
      const availableWidth = Math.min(500, width - 30);
      const availableHeight = Math.max(320, height - 245);
      this.tileSize = Math.floor(Math.min(availableWidth / 8, availableHeight / 8));
      this.boardTop = Math.max(116, Math.floor((height - (this.tileSize * 8 + 175)) / 2) + 48);
      this.gridStartX = (width - this.tileSize * 8) / 2 + this.tileSize / 2;
      this.gridStartY = this.boardTop + this.tileSize / 2;
      this.modeLabel.setPosition(22, 25);
      this.scoreText.setPosition(width / 2, 25);
      this.multiplierText.setPosition(16, 61);
      this.livesText.setPosition(width - 16, 61);
      this.wordCountText.setPosition(width / 2, 92);
      this.pauseButton.setPosition(width - 28, 33);
      const boardBottom = this.boardTop + this.tileSize * 8;
      this.chainText.setPosition(width / 2, boardBottom + 27);
      this.feedbackText.setPosition(width / 2, boardBottom + 58);
      this.feedbackUnderline.setPosition(width / 2, boardBottom + 73);
      if (this.currentMode === "practice") {
        const actionOffset = (this.bankButton.background.width + 12) / 2;
        this.bankButton.setPosition(width / 2 - actionOffset, boardBottom + 105);
        this.rewindButton.setPosition(width / 2 + actionOffset, boardBottom + 105);
      } else {
        this.bankButton.setPosition(width / 2, boardBottom + 105);
      }
    }

    // This redraws tile plates and letters, then lets the snake layer sit between them.
    renderBoard(moveResult, refilled) {
      this.destroyGroup(this.boardObjects);
      this.snake.setGeometry(this.tileSize, this.gridStartX, this.gridStartY);
      // This turns refilled coordinates into quick lookup keys for the drop animation.
      const refillKeys = new Set((refilled || []).map(function makeKey(point) {
        return point.row + ":" + point.column;
      }));
      let refillIndex = 0;
      for (let row = 0; row < this.board.grid.length; row += 1) {
        for (let column = 0; column < this.board.grid[row].length; column += 1) {
          const cell = this.board.grid[row][column];
          const x = this.gridStartX + column * this.tileSize;
          const y = this.gridStartY + row * this.tileSize;
          const isBody = cell.state === "BODY";
          const starter = this.board.awaitingStart && this.board.starterPath && this.board.starterPath[0];
          const isStartChoice = this.board.awaitingStart && (this.board.startMode === "free" || (starter && starter.row === row && starter.column === column));
          const plate = this.add.rectangle(x, y, this.tileSize - 5, this.tileSize - 5, isBody ? COLORS.body : COLORS.tile, 0.98)
            .setStrokeStyle(isBody || isStartChoice ? 2 : 1, isBody ? 0xFF6B70 : (isStartChoice ? COLORS.green : COLORS.cyan), isBody ? 0.95 : (isStartChoice ? 0.9 : 0.24))
            .setDepth(0);
          this.track(plate, this.boardObjects);
          if (cell.state === "LETTER") {
            plate.setInteractive({ useHandCursor: true });
            plate.on("pointerup", this.handleTileTap.bind(this, row, column));
          }
          const letter = this.add.text(x, y + 1, cell.letter, {
            fontFamily: FONTS.ui,
            fontSize: Math.max(18, Math.floor(this.tileSize * 0.42)) + "px",
            fontStyle: "bold",
            color: isBody ? "#F2EDE4" : COLORS.ink
          }).setOrigin(0.5).setDepth(cell.state === "HEAD" ? 7 : 2);
          this.track(letter, this.boardObjects);
          if (this.board.awaitingStart && this.board.startMode === "guided" && starter && starter.row === row && starter.column === column) {
            const startTag = this.add.text(x, y - this.tileSize * 0.31, "START", {
              fontFamily: FONTS.data, fontSize: Math.max(8, Math.floor(this.tileSize * 0.13)) + "px",
              fontStyle: "bold", color: "#00757A", backgroundColor: "#C8FFFF", padding: { x: 3, y: 1 }
            }).setOrigin(0.5).setDepth(4);
            this.track(startTag, this.boardObjects);
          }
          if (refillKeys.has(row + ":" + column)) {
            const delay = refillIndex * 4;
            refillIndex += 1;
            plate.setY(y - 24).setAlpha(0);
            if (letter) {
              letter.setY(y - 23).setAlpha(0);
            }
            this.tweens.add({ targets: letter ? [plate, letter] : [plate], y: y, alpha: 1, duration: 180, delay: delay, ease: "Sine.easeOut" });
          }
        }
      }
      this.snake.render(this.board, moveResult);
      this.scoreText.setText("SCORE " + this.board.score.toLocaleString("en-US"));
      this.multiplierText.setText("MULTIPLIER  ×" + window.ChainWords.getChainMultiplier(this.board.bankStreak));
      this.livesText.setText("LIVES  " + this.board.lives + "/2  " + "♥".repeat(this.board.lives) + "♡".repeat(Math.max(0, 2 - this.board.lives)));
      if (this.currentMode === "daily") {
        const found = this.board.wordsFound.length;
        this.wordCountText.setText(found >= window.ChainState.dailyTarget
          ? "20 WORDS CORRECT · TOMORROW'S BOARD UNLOCKED"
          : "GET 20 WORDS CORRECT AND PROGRESS TO TOMORROW'S BOARD");
        this.wordCountText.setColor(found >= window.ChainState.dailyTarget ? "#69F23B" : "#04E7F0");
      } else {
        this.wordCountText.setText("PRACTICE  THE  DAILY  RULES  ·  TWO  LIVES");
      }
    }

    // This updates all four live chain states, their icons, colours, copy, and bank emphasis.
    updateChainFeedback(temporaryMessage) {
      const evaluation = window.ChainWords.evaluateChain(this.board.chain, this.board.bankStreak);
      const duplicateWord = window.ChainWords.isWord(this.board.chain) && this.board.hasBankedWord(this.board.chain);
      const letters = this.board.chain.split("");
      while (letters.length < 9) {
        letters.push("_");
      }
      this.chainText.setText(letters.join(" "));
      const startMessage = this.board.startMode === "free"
        ? "Tap any tile to choose the first letter of your next word."
        : "Tap the START tile. Its letter begins your word.";
      this.feedbackText.setText(temporaryMessage || (this.board.awaitingStart ? startMessage : (duplicateWord ? "×  Already banked. Each word scores once." : (evaluation.icon + "  " + evaluation.text))));
      this.feedbackUnderline.setAlpha(evaluation.state === "DEAD" || duplicateWord ? 0.75 : 0);
      if (this.feedbackTween) {
        this.feedbackTween.stop();
        this.feedbackTween = null;
      }
      if (this.board.awaitingStart) {
        this.chainText.setColor(COLORS.white);
        this.feedbackText.setColor("#69F23B");
        this.bankButton.background.setFillStyle(COLORS.panel);
        this.bankButton.label.setColor(COLORS.muted);
      } else if (evaluation.state === "DEAD" || duplicateWord) {
        this.chainText.setColor("#77737C");
        this.feedbackText.setColor("#C46B61");
        this.bankButton.background.setFillStyle(COLORS.panel);
        this.bankButton.label.setColor(COLORS.white);
      } else if (evaluation.state === "BANKABLE" || evaluation.state === "BANKABLE_PLUS") {
        this.chainText.setColor("#D4A24C");
        this.feedbackText.setColor("#D4A24C");
        this.bankButton.background.setFillStyle(COLORS.gold);
        this.bankButton.label.setColor("#041019");
        this.feedbackTween = this.tweens.add({ targets: this.bankButton, alpha: 0.72, duration: 540, yoyo: true, repeat: -1 });
      } else {
        this.chainText.setColor(COLORS.white);
        this.feedbackText.setColor(COLORS.muted);
        this.bankButton.background.setFillStyle(COLORS.tile);
        this.bankButton.label.setColor(COLORS.ink);
        this.feedbackTween = this.tweens.add({ targets: this.chainText, alpha: 0.82, duration: 750, yoyo: true, repeat: -1 });
      }
      this.scoreText.setText("SCORE " + this.board.score.toLocaleString("en-US"));
      this.multiplierText.setText("MULTIPLIER  ×" + window.ChainWords.getChainMultiplier(this.board.bankStreak));
      this.livesText.setText("LIVES  " + this.board.lives + "/2  " + "♥".repeat(this.board.lives) + "♡".repeat(Math.max(0, 2 - this.board.lives)));
    }

    // This turns arrows, WASD, SPACE, BACKSPACE, R, and ESCAPE into discrete game actions.
    handleKeyDown(event) {
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (event.repeat || this.screen !== "game" || this.coachingActive || this.lifeWarningActive) {
        return;
      }
      if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.ESC) {
        this.showPause();
      } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.SPACE) {
        this.tryBank();
      } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.R) {
        this.tryRewind();
      } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.BACKSPACE) {
        event.preventDefault();
        this.tryStepBack();
      } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.UP || event.keyCode === Phaser.Input.Keyboard.KeyCodes.W) {
        this.tryMove(-1, 0);
      } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.DOWN || event.keyCode === Phaser.Input.Keyboard.KeyCodes.S) {
        this.tryMove(1, 0);
      } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.LEFT || event.keyCode === Phaser.Input.Keyboard.KeyCodes.A) {
        this.tryMove(0, -1);
      } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.RIGHT || event.keyCode === Phaser.Input.Keyboard.KeyCodes.D) {
        this.tryMove(0, 1);
      }
    }

    // This remembers the start of a finger gesture so a deliberate swipe can move the snake.
    handlePointerDown(pointer) {
      if (this.screen === "game") {
        this.pointerStart = { x: pointer.x, y: pointer.y };
      }
    }

    // This converts a swipe across the board into one cardinal move for comfortable one-handed play.
    handlePointerUp(pointer) {
      if (this.screen !== "game" || !this.pointerStart) {
        return;
      }
      const deltaX = pointer.x - this.pointerStart.x;
      const deltaY = pointer.y - this.pointerStart.y;
      this.pointerStart = null;
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 26) {
        return;
      }
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        this.tryMove(0, deltaX > 0 ? 1 : -1);
      } else {
        this.tryMove(deltaY > 0 ? 1 : -1, 0);
      }
    }

    // This lets a player tap any adjacent fresh tile without needing tiny directional controls.
    handleTileTap(row, column, pointer) {
      if (!pointer || pointer.getDistance() > 12 || this.screen !== "game") {
        return;
      }
      if (this.board.awaitingStart) {
        this.preMoveState = this.board.exportState();
        const startResult = this.board.selectStart(row, column);
        if (!startResult.selected) {
          this.updateChainFeedback(this.board.startMode === "guided" ? "×  Begin on the tile marked START." : "×  Choose a fresh letter tile.");
          return;
        }
        this.renderBoard();
        this.updateChainFeedback("◆  " + startResult.letter + " is your first letter. Build from here.");
        if (this.currentMode === "daily") {
          window.ChainState.saveDailyProgress(this.board);
        }
        return;
      }
      const rowChange = row - this.board.head.row;
      const columnChange = column - this.board.head.column;
      if (Math.abs(rowChange) + Math.abs(columnChange) === 1) {
        this.tryMove(rowChange, columnChange);
      }
    }

    // This makes a short local tone without downloading or tracking an audio file.
    playSound(kind) {
      if (!window.ChainState.get().settings.sound || !window.AudioContext) {
        return;
      }
      this.audioContext = this.audioContext || new window.AudioContext();
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.type = kind === "success" ? "sine" : "square";
      oscillator.frequency.value = kind === "success" ? 620 : 110;
      gain.gain.setValueAtTime(0.035, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.1);
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    // This applies one mistake consistently, redraws the reset board, and pauses for a clear one-life warning.
    applyMistake(reason, existingResult) {
      const result = existingResult || this.board.loseLife(reason);
      this.playSound("blocked");
      this.renderBoard();
      const shortReason = reason === "red-trail"
        ? "You stepped back into your red trail."
        : (reason === "boxed-in" ? "You ran out of safe moves." : "That was not a valid word.");
      this.updateChainFeedback(result.dead
        ? "×  " + shortReason + " Both lives are gone."
        : "♥  " + shortReason + " One life remains.");
      if (this.currentMode === "daily") {
        window.ChainState.saveDailyProgress(this.board);
      }
      if (result.dead) {
        this.beginDeath("lives");
        return;
      }
      this.showLifeWarning(shortReason);
    }

    // This makes the first lost life impossible to miss and explains the permanent free-start penalty.
    showLifeWarning(reasonCopy) {
      this.lifeWarningActive = true;
      this.animating = true;
      this.inputQueue = [];
      const width = this.scale.width;
      const height = this.scale.height;
      const panelWidth = Math.min(420, width - 40);
      const shade = this.add.rectangle(width / 2, height / 2, width, height, COLORS.background, 0.9).setDepth(44).setInteractive();
      const panel = this.add.rectangle(width / 2, height / 2, panelWidth, 360, COLORS.panel, 1)
        .setStrokeStyle(2, COLORS.red, 0.92).setDepth(45);
      this.track(shade, this.overlayObjects);
      this.track(panel, this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 - 126, "ONE  LIFE  LEFT", {
        fontFamily: FONTS.display, fontSize: "28px", fontStyle: "bold", color: COLORS.white, letterSpacing: 0.6
      }).setOrigin(0.5).setDepth(46), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 - 82, "♥  ♡", {
        fontFamily: FONTS.data, fontSize: "24px", fontStyle: "bold", color: "#FF8085", letterSpacing: 4
      }).setOrigin(0.5).setDepth(46), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 - 45, reasonCopy + "\n\nFree-start choices are now gone. CHAIN will pick each new starting letter for the rest of this run. One more mistake ends the run.", {
        fontFamily: FONTS.ui, fontSize: "14px", color: "#D7E6F3", align: "center",
        lineSpacing: 5, wordWrap: { width: panelWidth - 54 }
      }).setOrigin(0.5, 0).setDepth(46), this.overlayObjects);
      this.createButton("KEEP PLAYING", width / 2, height / 2 + 128, panelWidth - 64, this.dismissLifeWarning.bind(this), {
        fill: COLORS.magenta, stroke: COLORS.magenta, height: 50, fontSize: 14, depth: 46, group: this.overlayObjects
      });
    }

    // This returns to the automatically selected new round after the player reads the warning.
    dismissLifeWarning() {
      this.destroyGroup(this.overlayObjects);
      this.lifeWarningActive = false;
      this.animating = false;
      this.updateChainFeedback("♥  One life left. Your starting letter is now chosen automatically.");
    }

    // This lets Practice use BACKSPACE as rewind while Daily applies the same two-life rule as a red-trail hit.
    tryStepBack() {
      if (!this.board) {
        return;
      }
      if (this.board.awaitingStart) {
        this.updateChainFeedback("Choose your first tile before moving.");
        return;
      }
      if (this.currentMode === "practice") {
        this.tryRewind();
        return;
      }
      this.preMoveState = this.board.exportState();
      this.applyMistake("red-trail");
    }

    // This performs one move, shows blocked feedback, saves Daily, and checks for a fair death.
    tryMove(rowChange, columnChange) {
      if (this.runEnded || this.coachingActive) {
        return;
      }
      if (this.animating) {
        this.inputQueue.push({ type: "move", row: rowChange, column: columnChange });
        return;
      }
      if (this.board.awaitingStart) {
        this.updateChainFeedback(this.board.startMode === "free" ? "Tap any tile to choose your start." : "Tap the tile marked START first.");
        return;
      }
      this.preMoveState = this.board.exportState();
      const result = this.board.move(rowChange, columnChange);
      if (!result.moved) {
        this.playSound("blocked");
        this.snake.blockedFeedback(result.target, this.board);
        const state = this.board.getCell(result.target.row, result.target.column);
        if (state && state.state === "BODY") {
          this.applyMistake("red-trail");
        } else {
          this.updateChainFeedback("×  The grid ends there. Use an outlined tile.");
        }
        return;
      }
      this.renderBoard(result);
      this.updateChainFeedback();
      if (this.gameCoachStage === 1) {
        this.coachingActive = true;
        // This waits for the head movement to finish before explaining the new red body tile.
        this.time.delayedCall(150, this.showGameCoach, [1], this);
      } else if (this.gameCoachStage === 2 && window.ChainWords.isWord(this.board.chain)) {
        this.coachingActive = true;
        // This reveals the final lesson at the exact first moment banking becomes possible.
        this.time.delayedCall(150, this.showGameCoach, [2], this);
      }
      if (this.currentMode === "daily") {
        window.ChainState.saveDailyProgress(this.board);
      }
      if (this.board.isDead()) {
        this.preMoveState = this.board.exportState();
        this.applyMistake("boxed-in");
      }
    }

    // This rejects guesses gently or queues a short bank animation before scoring and refill.
    tryBank() {
      if (this.runEnded || this.coachingActive) {
        return;
      }
      if (this.animating) {
        this.inputQueue.push({ type: "bank" });
        return;
      }
      if (this.board.awaitingStart) {
        this.updateChainFeedback(this.board.startMode === "free" ? "Choose a start tile before banking." : "Tap the START tile before banking.");
        return;
      }
      if (!window.ChainWords.isWord(this.board.chain)) {
        this.preMoveState = this.board.exportState();
        const invalidResult = this.board.bank();
        this.applyMistake("invalid-word", invalidResult);
        return;
      }
      if (this.board.hasBankedWord(this.board.chain)) {
        this.board.bank();
        this.updateChainFeedback("×  " + this.board.chain + " is already gone. Find a new word.");
        this.tweens.add({ targets: this.chainText, x: this.chainText.x + 6, duration: 45, yoyo: true, repeat: 2 });
        if (this.currentMode === "daily") {
          window.ChainState.saveDailyProgress(this.board);
        }
        if (this.board.isDead()) {
          this.beginDeath("boxed-in");
        }
        return;
      }
      this.animating = true;
      const body = this.board.bodyOrder.slice();
      const head = { row: this.board.head.row, column: this.board.head.column };
      this.snake.animateBank(body, head, this.finishBank.bind(this));
    }

    // This applies score and refill after the rope sweep, then releases queued input within 800ms.
    finishBank() {
      const result = this.board.bank();
      this.playSound("success");
      this.renderBoard(null, result.refilled);
      this.updateChainFeedback("◆  " + result.word + " banked for " + result.points + " points. Choose your next start.");
      if (this.currentMode === "daily" && this.board.wordsFound.length === window.ChainState.dailyTarget) {
        this.showRarityToast("TOMORROW UNLOCKED");
      }
      if (result.rarity === "RARE" || result.rarity === "ELITE") {
        this.showRarityToast(result.rarity + " WORD");
      }
      if (this.currentMode === "daily") {
        window.ChainState.saveDailyProgress(this.board);
        window.ChainOnline.submitBoardScore(this.board);
      }
      // This waits only for the visible drop to settle before processing the next queued action.
      this.time.delayedCall(240, this.releaseInputQueue, [], this);
    }

    // This exchanges a completed rewarded video for one clearly highlighted reachable word and route.
    async tryRevealWord() {
      if (this.runEnded || this.animating || this.coachingActive) {
        return;
      }
      const friendlyOpening = this.board.chain.length === 0 && this.board.starterWord && this.board.starterPath.length
        ? { word: this.board.starterWord, path: this.board.starterPath.slice() }
        : null;
      const usedWords = this.board.wordsFound.map(function collectUsedWord(entry) { return entry.word; });
      const solution = friendlyOpening || window.ChainWords.solve(this.board.grid, this.board.head, { includeBody: false, minLength: 3, excludeWords: usedWords });
      if (!solution) {
        this.updateChainFeedback("×  No fresh word route remains from this tile.");
        return;
      }
      this.animating = true;
      const earned = await window.ChainAds.showRewarded("word-hint");
      this.animating = false;
      if (!earned) {
        this.updateChainFeedback("×  Finish the video to reveal a word.");
        return;
      }
      const path = [this.board.head].concat(solution.path);
      const graphics = this.add.graphics().setDepth(8);
      graphics.lineStyle(Math.max(4, this.tileSize * 0.1), COLORS.magenta, 0.95);
      for (let index = 0; index < path.length - 1; index += 1) {
        graphics.lineBetween(
          this.gridStartX + path[index].column * this.tileSize,
          this.gridStartY + path[index].row * this.tileSize,
          this.gridStartX + path[index + 1].column * this.tileSize,
          this.gridStartY + path[index + 1].row * this.tileSize
        );
      }
      this.track(graphics, this.boardObjects);
      const hint = this.add.text(this.scale.width / 2, this.boardTop + this.tileSize * 4, "WORD  " + solution.word, {
        fontFamily: FONTS.display, fontSize: "26px", fontStyle: "bold", color: COLORS.white,
        backgroundColor: "#05080DEE", padding: { x: 22, y: 12 }
      }).setOrigin(0.5).setDepth(9);
      this.track(hint, this.boardObjects);
      this.updateChainFeedback("◆  Follow the magenta route to spell " + solution.word + ".");
      this.time.delayedCall(4500, function hideHint() {
        if (graphics.active) { graphics.destroy(); }
        if (hint.active) { hint.destroy(); }
      });
    }

    // This shows a brief non-blocking rarity callout without pausing or stealing input.
    showRarityToast(message) {
      const toast = this.add.text(this.scale.width / 2, this.boardTop + this.tileSize * 4, message, {
        fontFamily: FONTS.display, fontSize: "24px", fontStyle: "bold", color: "#F3C866",
        backgroundColor: "#1A1A1DEB", padding: { x: 24, y: 14 }
      }).setOrigin(0.5).setDepth(20);
      this.track(toast, this.overlayObjects);
      this.tweens.add({ targets: toast, alpha: 0, y: toast.y - 18, duration: 1200, ease: "Sine.easeOut" });
    }

    // This restores one retained Practice action, including a banked score, and redraws the exact state.
    tryRewind() {
      if (this.currentMode !== "practice" || this.runEnded) {
        return;
      }
      const result = this.board.rewind();
      if (!result.rewound) {
        this.updateChainFeedback("↺  No earlier action remains");
        return;
      }
      this.renderBoard();
      this.updateChainFeedback("↺  Rewound one " + result.kind);
    }

    // This releases animation input and immediately performs the oldest action the player queued.
    releaseInputQueue() {
      this.animating = false;
      const next = this.inputQueue.shift();
      if (!next) {
        return;
      }
      if (next.type === "bank") {
        this.tryBank();
      } else {
        this.tryMove(next.row, next.column);
      }
    }

    // This freezes a fatal run, explains the cause, and then offers the one permitted Daily revive.
    beginDeath(reason) {
      if (this.runEnded) {
        return;
      }
      this.runEnded = true;
      this.animating = true;
      this.deathReason = reason === "trail" ? "trail" : (reason === "lives" ? "lives" : "boxed-in");
      this.deathRestoreState = this.preMoveState || this.board.exportState();
      const usedWords = this.board.wordsFound.map(function collectUsedWord(entry) { return entry.word; });
      const solution = window.ChainWords.solve(this.board.grid, this.board.head, { includeBody: true, excludeWords: usedWords });
      if (solution && !window.ChainWords.verifySolution(this.board.grid, this.board.head, solution)) {
        throw new Error("The solver produced a path that is not legally reachable.");
      }
      this.deathSolution = solution;
      this.snake.animateDeath(this.board, solution, this.currentMode === "daily" ? this.showDeathOffer.bind(this) : this.showSummary.bind(this));
    }

    // This makes death unmistakable before the player chooses a rewarded revive or locks the score.
    showDeathOffer() {
      this.animating = false;
      this.destroyGroup(this.overlayObjects);
      const width = this.scale.width;
      const height = this.scale.height;
      const panelWidth = Math.min(420, width - 48);
      const reasonCopy = this.deathReason === "trail"
        ? "You touched your red trail. Red tiles are always fatal."
        : (this.deathReason === "lives" ? "Two mistakes used both of your lives." : "No fresh move or bankable word remained.");
      this.track(this.add.rectangle(width / 2, height / 2, width, height, COLORS.background, 0.9).setDepth(40), this.overlayObjects);
      this.track(this.add.rectangle(width / 2, height / 2, panelWidth, 330, COLORS.panel, 1)
        .setStrokeStyle(2, COLORS.magenta, 0.9).setDepth(41), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 - 116, "RUN  OVER", {
        fontFamily: FONTS.display, fontSize: "32px", fontStyle: "bold", color: COLORS.white
      }).setOrigin(0.5).setDepth(42), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 - 68, reasonCopy, {
        fontFamily: FONTS.ui, fontSize: "14px", color: COLORS.muted, align: "center",
        lineSpacing: 5, wordWrap: { width: panelWidth - 56 }
      }).setOrigin(0.5).setDepth(42), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 - 18, "SCORE  " + this.board.score.toLocaleString("en-US"), {
        fontFamily: FONTS.data, fontSize: "17px", color: COLORS.white, letterSpacing: 1
      }).setOrigin(0.5).setDepth(42), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 + 12, this.board.wordsFound.length + "/" + window.ChainState.dailyTarget + " WORDS", {
        fontFamily: FONTS.data, fontSize: "12px", color: this.board.wordsFound.length >= window.ChainState.dailyTarget ? "#69F23B" : "#FF8085", letterSpacing: 1
      }).setOrigin(0.5).setDepth(42), this.overlayObjects);
      const reviveAvailable = !this.board.reviveUsed && window.ChainAds.isAvailable();
      if (reviveAvailable) {
        this.createButton("WATCH VIDEO · REVIVE", width / 2, height / 2 + 62, panelWidth - 48, this.watchRevive.bind(this), {
          fill: COLORS.magenta, stroke: COLORS.magenta, height: 52, fontSize: 14, depth: 42, group: this.overlayObjects
        });
      }
      this.createButton(this.board.reviveUsed ? "END RUN" : "KEEP SCORE · END RUN", width / 2, height / 2 + (reviveAvailable ? 124 : 82), panelWidth - 96, this.finishDeath.bind(this), {
        fill: COLORS.panel, stroke: COLORS.grid, textColor: COLORS.white, height: 48, fontSize: 12, depth: 42, group: this.overlayObjects
      });
    }

    // This grants a revive only after the native rewarded-ad callback confirms the reward was earned.
    async watchRevive() {
      if (this.board.reviveUsed) {
        return;
      }
      const earned = await window.ChainAds.showRewarded("revive");
      if (!earned) {
        this.updateChainFeedback("×  The video did not finish. Your score is still safe.");
        return;
      }
      this.board.restore(this.deathRestoreState);
      this.board.history = JSON.parse(JSON.stringify(this.deathRestoreState.history || []));
      this.board.reviveUsed = true;
      this.runEnded = false;
      this.animating = false;
      this.destroyGroup(this.overlayObjects);
      this.renderBoard();
      this.updateChainFeedback("♥  Revived. Your one extra life is now used.");
      window.ChainState.saveDailyProgress(this.board);
    }

    // This locks the Daily score only after the player declines or has already used the revive.
    finishDeath() {
      this.destroyGroup(this.overlayObjects);
      this.showSummary();
    }

    // This records progress and slides the complete Daily or Practice summary over the frozen board.
    showSummary() {
      this.screen = "summary";
      this.animating = false;
      const previousBest = window.ChainState.get().bestScore;
      let dailyResult = null;
      if (this.currentMode === "daily") {
        dailyResult = window.ChainState.completeDaily(this.board);
        window.ChainOnline.submitDailyScore(dailyResult);
      } else {
        window.ChainState.recordProgress(this.board);
      }
      window.ChainState.recordRunMetrics(this.board, this.currentMode, Date.now() - this.runStartedAt, this.deathReason || "boxed-in");
      const width = this.scale.width;
      const height = this.scale.height;
      const panelWidth = Math.min(580, width - 24);
      const shade = this.add.rectangle(width / 2, height / 2, width, height, COLORS.background, 0.83).setDepth(30);
      const panel = this.add.rectangle(width / 2, height / 2, panelWidth, Math.min(height - 28, 590), COLORS.panel, 0.97)
        .setStrokeStyle(2, COLORS.gold, 0.9).setDepth(31);
      this.track(shade, this.overlayObjects);
      this.track(panel, this.overlayObjects);
      const top = Math.max(46, height / 2 - Math.min(height - 28, 590) / 2 + 26);
      const qualified = this.currentMode === "daily" && this.board.wordsFound.length >= window.ChainState.dailyTarget;
      const summaryTitle = this.currentMode === "daily"
        ? (qualified ? "TOMORROW UNLOCKED" : "DAILY FAILED")
        : (this.deathReason === "trail" ? "TRAIL HIT" : (this.deathReason === "lives" ? "OUT OF LIVES" : "BOXED IN"));
      this.track(this.add.text(width / 2, top, summaryTitle.replace(/ +/g, "  "), {
        fontFamily: FONTS.display, fontSize: (width < 480 ? 26 : 34) + "px", fontStyle: "bold", color: COLORS.white
      }).setOrigin(0.5).setDepth(32), this.overlayObjects);
      if (this.currentMode === "daily") {
        this.track(this.add.text(width / 2, top + 94, qualified
          ? this.board.wordsFound.length + " WORDS · YOU QUALIFIED"
          : this.board.wordsFound.length + "/" + window.ChainState.dailyTarget + " WORDS · TRY AGAIN TOMORROW", {
          fontFamily: FONTS.data, fontSize: "11px", fontStyle: "bold",
          color: qualified ? "#69F23B" : "#FF8085", letterSpacing: 1
        }).setOrigin(0.5).setDepth(32), this.overlayObjects);
      }
      this.track(this.add.text(width / 2, top + 46, "FINAL  SCORE  " + this.board.score.toLocaleString("en-US"), {
        fontFamily: FONTS.data, fontSize: "18px", fontStyle: "bold", color: "#D4A24C"
      }).setOrigin(0.5).setDepth(32), this.overlayObjects);
      let framing = "A new personal best.";
      if (this.board.score <= previousBest && previousBest > 0 && this.board.score >= previousBest * 0.85) {
        framing = "You were " + (previousBest - this.board.score).toLocaleString("en-US") + " points from your best.";
      } else if (this.board.score <= previousBest) {
        framing = "Your best is " + previousBest.toLocaleString("en-US") + ".";
      }
      this.track(this.add.text(width / 2, top + 72, framing, {
        fontFamily: FONTS.ui, fontSize: "13px", color: COLORS.muted
      }).setOrigin(0.5).setDepth(32), this.overlayObjects);

      const missedText = this.deathSolution
        ? this.deathSolution.word + " was on the board. " + this.deathSolution.points + " points."
        : "No three-letter route remained from your final tile.";
      this.track(this.add.text(width / 2, top + 116, missedText, {
        fontFamily: FONTS.display, fontSize: "18px", fontStyle: "bold", color: "#F3C866",
        align: "center", wordWrap: { width: panelWidth - 60 }
      }).setOrigin(0.5).setDepth(32), this.overlayObjects);

      // This orders the player's best words first for the screenshot-friendly summary list.
      const sorted = this.board.wordsFound.slice().sort(function sortWords(first, second) {
        return second.points - first.points;
      });
      this.track(this.add.text(width / 2, top + 160, "WORDS YOU FOUND (" + sorted.length + ")", {
        fontFamily: FONTS.data, fontSize: "12px", fontStyle: "bold", color: "#04E7F0", letterSpacing: 1.5
      }).setOrigin(0.5).setDepth(32), this.overlayObjects);
      // This formats each top word into an aligned score and rarity row.
      const listLines = sorted.slice(0, 5).map(function formatWord(entry) {
        return entry.word.padEnd(10, " ") + String(entry.points).padStart(4, " ") + "   " + entry.rarity;
      });
      this.track(this.add.text(width / 2, top + 185, listLines.length ? listLines.join("\n") : "No words banked this run.", {
        fontFamily: FONTS.data, fontSize: "13px", color: COLORS.white, lineSpacing: 5, align: "left"
      }).setOrigin(0.5, 0).setDepth(32), this.overlayObjects);

      const buttonY = Math.min(height - 84, top + 330);
      const summaryGap = 12;
      const summaryButtonWidth = Math.min(250, (width - 48 - summaryGap) / 2);
      const summaryButtonOffset = (summaryButtonWidth + summaryGap) / 2;
      if (this.currentMode === "practice") {
        this.createButton("NEW BOARD", width / 2 - summaryButtonOffset, buttonY, summaryButtonWidth, this.startPractice.bind(this, null, "Practice"), {
          fill: COLORS.magenta, stroke: COLORS.magenta, height: 48, fontSize: 14, depth: 33, group: this.overlayObjects
        });
        this.createButton("RETRY THIS BOARD", width / 2 + summaryButtonOffset, buttonY, summaryButtonWidth, this.startPractice.bind(this, this.initialSeed, this.runLabel), {
          fill: COLORS.panel, stroke: COLORS.cyan, textColor: "#04E7F0", height: 48, fontSize: width < 480 ? 11 : 13, depth: 33, group: this.overlayObjects
        });
      } else {
        this.createButton("COPY RESULT", width / 2 - summaryButtonOffset, buttonY, summaryButtonWidth, this.copyDailyResult.bind(this, dailyResult), {
          fill: COLORS.cyan, stroke: COLORS.cyan, height: 48, fontSize: 14, depth: 33, group: this.overlayObjects
        });
        this.createButton("PRACTICE THIS BOARD", width / 2 + summaryButtonOffset, buttonY, summaryButtonWidth, this.startPractice.bind(this, Number(dailyResult.date), "Daily #" + dailyResult.number + " practice"), {
          fill: COLORS.panel, stroke: COLORS.magenta, textColor: "#FF168B", height: 48, fontSize: width < 480 ? 10 : 12, depth: 33, group: this.overlayObjects
        });
      }
      this.createButton("HOME", width / 2, buttonY + 61, 170, this.showHome.bind(this, this.currentMode), {
        fill: COLORS.panel, stroke: 0x77737C, textColor: COLORS.white, height: 38, fontSize: 12, depth: 33, group: this.overlayObjects
      });
      this.createModeSwitcher(this.currentMode, Math.min(height - 24, buttonY + 112), this.overlayObjects);
    }

    // This builds the under-200-character Daily card and copies it to the browser clipboard.
    copyDailyResult(result) {
      if (!result) {
        return;
      }
      const best = result.bestWord ? result.bestWord.word + " (" + result.bestWord.points + ")" : "None";
      const url = window.location.origin + window.location.pathname;
      const outcome = result.words >= window.ChainState.dailyTarget ? "Tomorrow unlocked" : result.words + "/" + window.ChainState.dailyTarget + " words";
      let text = "CHAIN #" + result.number + "\n" + result.score.toLocaleString("en-US") + " pts · " + outcome + "\nBest: " + best + "\n🔥 " + result.streak + " day streak\n" + url;
      if (text.length > 199) {
        text = text.slice(0, 196) + "…";
      }
      const copyAttempt = navigator.clipboard.writeText(text);
      copyAttempt.then(this.handleCopySuccess.bind(this), this.handleCopyFailure.bind(this));
    }

    // This confirms that the browser accepted the requested Daily result clipboard write.
    handleCopySuccess() {
      this.showNotice("RESULT COPIED");
    }

    // This explains when browser permissions prevent the requested clipboard action.
    handleCopyFailure() {
      this.showNotice("COPY WAS BLOCKED BY THE BROWSER");
    }

    // This shows a short status message for actions such as copying without adding a modal.
    showNotice(message) {
      const notice = this.add.text(this.scale.width / 2, 32, message, {
        fontFamily: FONTS.data, fontSize: "12px", fontStyle: "bold", color: "#69F23B",
        backgroundColor: "#1A1A1DEE", padding: { x: 14, y: 8 }
      }).setOrigin(0.5).setDepth(60);
      this.track(notice, this.overlayObjects);
      this.tweens.add({ targets: notice, alpha: 0, duration: 900, delay: 550 });
    }

    // This opens a focused gameplay pause layer with only actions that belong to the current run.
    showPause() {
      if (this.screen !== "game" || this.animating || this.runEnded) {
        return;
      }
      this.screen = "pause";
      const width = this.scale.width;
      const height = this.scale.height;
      const practicePause = this.currentMode === "practice";
      const panelHeight = practicePause ? 300 : 238;
      this.track(this.add.rectangle(width / 2, height / 2, width, height, COLORS.background, 0.88).setDepth(40), this.overlayObjects);
      this.track(this.add.rectangle(width / 2, height / 2, Math.min(460, width - 32), panelHeight, COLORS.panel, 0.98).setStrokeStyle(1, COLORS.grid, 0.9).setDepth(41), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 - (practicePause ? 106 : 78), "RUN  PAUSED", {
        fontFamily: FONTS.display, fontSize: "28px", fontStyle: "bold", color: COLORS.white, letterSpacing: 0.6
      }).setOrigin(0.5).setDepth(42), this.overlayObjects);
      this.createButton("RESUME", width / 2, height / 2 - (practicePause ? 40 : 14), 260, this.closePause.bind(this), {
        fill: COLORS.cyan, stroke: COLORS.cyan, height: 46, fontSize: 14, depth: 42, group: this.overlayObjects
      });
      if (practicePause) {
        this.createButton("RETRY THIS BOARD", width / 2, height / 2 + 24, 260, this.startPractice.bind(this, this.initialSeed, this.runLabel), {
          fill: COLORS.panel, stroke: COLORS.magenta, textColor: "#FF168B", height: 42, fontSize: 12, depth: 42, group: this.overlayObjects
        });
      }
      this.createButton("HOME", width / 2, height / 2 + (practicePause ? 88 : 54), 180, this.confirmLeaveRun.bind(this, this.currentMode), {
        fill: COLORS.panel, stroke: COLORS.grid, textColor: COLORS.white, height: 38, fontSize: 12, depth: 42, group: this.overlayObjects
      });
    }

    // This closes pause and restores gameplay without changing the board or random sequence.
    closePause() {
      this.destroyGroup(this.overlayObjects);
      this.screen = "game";
    }

    // This asks before leaving because Practice progress ends and a Daily attempt becomes final.
    confirmLeaveRun(targetMode) {
      this.destroyGroup(this.overlayObjects);
      const width = this.scale.width;
      const height = this.scale.height;
      const dailyWarning = this.currentMode === "daily" ? "Leaving ends today's run. Reach 20 first." : "Leave this run?";
      this.track(this.add.rectangle(width / 2, height / 2, width, height, COLORS.background, 0.92).setDepth(45), this.overlayObjects);
      this.track(this.add.rectangle(width / 2, height / 2, Math.min(430, width - 32), 230, COLORS.panel, 1).setStrokeStyle(2, COLORS.red, 0.8).setDepth(46), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 - 62, dailyWarning, {
        fontFamily: FONTS.display, fontSize: "21px", fontStyle: "bold", color: COLORS.white
      }).setOrigin(0.5).setDepth(47), this.overlayObjects);
      this.createButton("KEEP PLAYING", width / 2, height / 2 - 5, 240, this.closeConfirmation.bind(this), {
        fill: COLORS.tile, stroke: COLORS.tile, height: 42, fontSize: 13, depth: 47, group: this.overlayObjects
      });
      this.createButton("LEAVE RUN", width / 2, height / 2 + 54, 240, this.leaveRun.bind(this, targetMode), {
        fill: COLORS.panel, stroke: COLORS.red, textColor: "#D77A70", height: 42, fontSize: 12, depth: 47, group: this.overlayObjects
      });
    }

    // This removes the confirmation and returns to the unchanged paused game.
    closeConfirmation() {
      this.destroyGroup(this.overlayObjects);
      this.screen = "game";
      this.showPause();
    }

    // This finalizes an abandoned Daily or records Practice, then opens the requested mode home.
    leaveRun(targetMode) {
      if (this.currentMode === "daily") {
        window.ChainState.completeDaily(this.board);
      } else {
        window.ChainState.recordProgress(this.board);
      }
      this.showHome(targetMode);
    }

    // This draws a compact screenshot-style board example for one How to Play lesson.
    drawTutorialExample(index, centreX, centreY, panelWidth) {
      const cardWidth = Math.min(390, panelWidth - 48);
      const card = this.add.rectangle(centreX, centreY, cardWidth, 126, 0x07111E, 1)
        .setStrokeStyle(1, index === 2 || index === 4 ? COLORS.red : COLORS.cyan, 0.72).setDepth(72);
      this.track(card, this.overlayObjects);
      this.track(this.add.text(centreX - cardWidth / 2 + 14, centreY - 50, "BOARD  EXAMPLE", {
        fontFamily: FONTS.data, fontSize: "9px", fontStyle: "bold", color: "#69F23B", letterSpacing: 1.5
      }).setDepth(73), this.overlayObjects);

      if (index === 1) {
        this.track(this.add.text(centreX, centreY - 18, "DAILY #412", {
          fontFamily: FONTS.data, fontSize: "13px", fontStyle: "bold", color: "#04E7F0", letterSpacing: 1.6
        }).setOrigin(0.5).setDepth(73), this.overlayObjects);
        this.track(this.add.text(centreX, centreY + 11, "SCORE  2,840", {
          fontFamily: FONTS.data, fontSize: "24px", fontStyle: "bold", color: COLORS.white
        }).setOrigin(0.5).setDepth(73), this.overlayObjects);
        this.track(this.add.text(centreX, centreY + 40, "GET 20 WORDS · UNLOCK TOMORROW", {
          fontFamily: FONTS.data, fontSize: "10px", fontStyle: "bold", color: "#69F23B", letterSpacing: 1
        }).setOrigin(0.5).setDepth(73), this.overlayObjects);
        return;
      }

      const examples = [
        { letters: "SNAKE", body: [], head: 0, start: -1, caption: "GOLD IS YOU · OUTLINES ARE SAFE MOVES" },
        { letters: "TRACE", body: [0, 1, 2], head: 3, start: -1, caption: "RED IS YOUR USED, BLOCKED TRAIL" },
        { letters: "WORD", body: [], head: -1, start: 0, caption: "START MARKS ONLY THE FIRST STEP" },
        { letters: "TRAP", body: [0, 1, 3], head: 2, start: -1, caption: "NO FRESH TILE + NO WORD = BOXED IN" }
      ];
      const example = examples[index === 0 ? 0 : index - 1];
      const cellSize = Math.min(42, Math.floor((cardWidth - 42) / example.letters.length));
      const rowY = centreY + 1;
      const startX = centreX - ((example.letters.length - 1) * cellSize) / 2;
      for (let cellIndex = 0; cellIndex < example.letters.length; cellIndex += 1) {
        const cellX = startX + cellIndex * cellSize;
        const isBody = example.body.indexOf(cellIndex) !== -1;
        const isHead = example.head === cellIndex;
        const fill = isBody ? COLORS.body : (isHead ? COLORS.gold : COLORS.tile);
        const stroke = isBody ? 0xFF6B70 : (isHead ? 0xFFE19B : COLORS.cyan);
        this.track(this.add.rectangle(cellX, rowY, cellSize - 4, cellSize - 4, fill, 1)
          .setStrokeStyle(isHead || isBody ? 2 : 1, stroke, isHead || isBody ? 0.95 : 0.34).setDepth(73), this.overlayObjects);
        this.track(this.add.text(cellX, rowY + 1, example.letters[cellIndex], {
          fontFamily: FONTS.ui, fontSize: "17px", fontStyle: "bold", color: isBody ? COLORS.white : COLORS.ink
        }).setOrigin(0.5).setDepth(74), this.overlayObjects);
        if (example.start === cellIndex) {
          this.track(this.add.text(cellX, rowY - cellSize * 0.33, "START", {
            fontFamily: FONTS.data, fontSize: "7px", fontStyle: "bold", color: "#041019", backgroundColor: "#7EFBFF", padding: { x: 2, y: 1 }
          }).setOrigin(0.5).setDepth(75), this.overlayObjects);
        }
      }
      this.track(this.add.text(centreX, centreY + 45, example.caption, {
        fontFamily: FONTS.data, fontSize: "9px", fontStyle: "bold", color: "#B8CBDE", letterSpacing: 0.9
      }).setOrigin(0.5).setDepth(73), this.overlayObjects);
    }

    // This opens one visual page of the guided first-run explanation over the current home screen.
    showTutorial(page) {
      const steps = [
        {
          label: "THE IDEA",
          title: "SCRABBLE MEETS SNAKE",
          body: "Tap START to choose the first letter, then move one tile at a time. Every move grows your red trail. Bank a valid word to score it. Each word can score only once per run."
        },
        {
          label: "THE DAILY GOAL",
          title: "FIND 20, THEN AIM HIGH",
          body: "Bank 20 unique words to unlock tomorrow's challenge, then keep playing for the day's highest score. Every new round gets a fresh board and a different planted opening word."
        },
        {
          label: "THE BOARD",
          title: "CHOOSE, BUILD, THEN SURVIVE",
          body: "After a correct word, choose any tile as your next start. Your first invalid word, red-trail hit, or boxed-in path costs one life and removes free starts. A second mistake ends the run."
        }
      ];
      const index = Phaser.Math.Clamp(Number(page) || 0, 0, steps.length - 1);
      const step = steps[index];
      this.destroyGroup(this.overlayObjects);
      this.tutorialActive = true;
      const width = this.scale.width;
      const height = this.scale.height;
      const panelWidth = Math.min(560, width - 48);
      const compactHeight = height < 640;
      const topOffset = compactHeight ? -236 : -250;
      const labelOffset = compactHeight ? -204 : -214;
      const titleOffset = compactHeight ? -166 : -174;
      const exampleOffset = compactHeight ? -68 : -70;
      const bodyOffset = compactHeight ? 72 : 68;
      const markerOffset = compactHeight ? 145 : 158;
      const navOffset = compactHeight ? 188 : 214;
      const closeOffset = compactHeight ? 240 : 270;
      this.track(this.add.rectangle(width / 2, height / 2, width, height, COLORS.background, 0.92).setDepth(70), this.overlayObjects);
      this.track(this.add.rectangle(width / 2, height / 2, panelWidth, Math.min(590, height - 24), COLORS.panel, 1)
        .setStrokeStyle(1, COLORS.cyan, 0.65).setDepth(71), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 + topOffset, "HOW TO PLAY  " + (index + 1) + "/" + steps.length, {
        fontFamily: FONTS.data, fontSize: "11px", fontStyle: "bold", color: cssToken("--accent-lime"), letterSpacing: 1.8
      }).setOrigin(0.5).setDepth(72), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 + labelOffset, step.label, {
        fontFamily: FONTS.data, fontSize: "11px", fontStyle: "bold", color: cssToken("--accent-cyan"), letterSpacing: 2
      }).setOrigin(0.5).setDepth(72), this.overlayObjects);
      this.track(this.add.text(width / 2, height / 2 + titleOffset, step.title.replace(/ +/g, "  "), {
        fontFamily: FONTS.display, fontSize: Math.min(27, Math.max(20, width * 0.052)) + "px",
        fontStyle: "bold", color: COLORS.white, align: "center", wordWrap: { width: panelWidth - 54 }
      }).setOrigin(0.5).setDepth(72), this.overlayObjects);
      this.drawTutorialExample([0, 1, 2][index], width / 2, height / 2 + exampleOffset, panelWidth);
      this.track(this.add.text(width / 2, height / 2 + bodyOffset, step.body, {
        fontFamily: FONTS.ui, fontSize: (compactHeight ? 13 : 14) + "px", color: COLORS.white, align: "center",
        lineSpacing: compactHeight ? 5 : 7, wordWrap: { width: panelWidth - 74 }
      }).setOrigin(0.5).setDepth(72), this.overlayObjects);

      for (let marker = 0; marker < steps.length; marker += 1) {
        const markerColor = marker <= index ? COLORS.cyan : COLORS.grid;
        this.track(this.add.rectangle(width / 2 - 12 + marker * 24, height / 2 + markerOffset, 16, 3, markerColor, 1).setDepth(72), this.overlayObjects);
      }
      const tutorialGap = 12;
      const tutorialButtonWidth = Math.min(190, (panelWidth - 32 - tutorialGap) / 2);
      const tutorialButtonOffset = (tutorialButtonWidth + tutorialGap) / 2;
      if (index > 0) {
        this.createButton("BACK", width / 2 - tutorialButtonOffset, height / 2 + navOffset, tutorialButtonWidth, this.showTutorial.bind(this, index - 1), {
          fill: COLORS.panel, stroke: 0x77737C, textColor: COLORS.white, height: 44, fontSize: 12, depth: 72, group: this.overlayObjects
        });
      }
      this.createButton(index === steps.length - 1 ? (width < 480 ? "START PRACTICE" : "START FIRST PRACTICE") : "NEXT", index > 0 ? width / 2 + tutorialButtonOffset : width / 2, height / 2 + navOffset, index > 0 ? tutorialButtonWidth : Math.min(260, panelWidth - 48),
        index === steps.length - 1 ? this.finishTutorial.bind(this, true) : this.showTutorial.bind(this, index + 1), {
          fill: COLORS.magenta, stroke: COLORS.magenta,
          height: 44, fontSize: width < 380 ? 11 : 13, depth: 72, group: this.overlayObjects
        });
      if (index < steps.length - 1) {
        this.createButton("CLOSE GUIDE", width / 2, height / 2 + closeOffset, 150, this.finishTutorial.bind(this, false), {
          fill: COLORS.panel, stroke: 0x555159, textColor: COLORS.muted, height: 32, fontSize: 10, depth: 72, group: this.overlayObjects
        });
      }
    }

    // This closes the guide and prevents the automatic version from returning on later visits.
    finishTutorial(startPracticeRun) {
      window.ChainState.completeTutorial();
      this.destroyGroup(this.overlayObjects);
      this.tutorialActive = false;
      if (startPracticeRun) {
        this.startPractice(null, "FIRST PRACTICE");
      }
    }

    // This lists seven previous deterministic Daily boards as real Practice launch buttons.
    showArchive() {
      this.clearEverything();
      this.drawBackdrop();
      this.screen = "archive";
      this.currentMode = "practice";
      const width = this.scale.width;
      const centreX = width / 2;
      this.track(this.add.text(centreX, 54, "DAILY  ARCHIVE", {
        fontFamily: FONTS.display, fontSize: "34px", fontStyle: "bold", color: COLORS.white
      }).setOrigin(0.5));
      this.createModeSwitcher("practice", 105);
      const compactArchive = width < 520 || this.scale.height < 650;
      const archiveWidth = compactArchive ? (width - 60) / 2 : Math.min(420, width - 48);
      for (let offset = 1; offset <= 7; offset += 1) {
        const date = new Date(Date.now() - offset * 86400000);
        const key = window.ChainState.dateKey(date);
        const number = window.ChainState.dailyNumber(date);
        const label = "DAILY #" + number + "  ·  " + date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const archiveRow = Math.floor((offset - 1) / (compactArchive ? 2 : 1));
        const archiveColumn = compactArchive ? (offset - 1) % 2 : 0;
        const archiveX = compactArchive ? centreX + (archiveColumn ? 1 : -1) * (archiveWidth + 12) / 2 : centreX;
        const archiveY = compactArchive ? 176 + archiveRow * 56 : 150 + offset * 55;
        this.createButton(label, archiveX, archiveY, archiveWidth, this.startPractice.bind(this, Number(key), "Daily #" + number + " practice"), {
          fill: COLORS.panel, stroke: offset % 2 ? COLORS.cyan : COLORS.magenta, textColor: COLORS.white, height: 44, fontSize: compactArchive ? 9 : 13
        });
      }
      this.createButton("BACK", centreX, compactArchive ? Math.min(this.scale.height - 40, 416) : Math.min(this.scale.height - 40, 575), 150, this.showHome.bind(this, "practice"), {
        fill: COLORS.tile, stroke: COLORS.tile, height: 38, fontSize: 12
      });
    }

    // This draws the compact language, sound, motion, and contrast controls used by Phase 5.
    showSettings() {
      this.clearEverything();
      this.drawBackdrop();
      this.screen = "settings";
      const width = this.scale.width;
      const centreX = width / 2;
      const save = window.ChainState.get();
      const spellingGap = 12;
      const spellingWidth = Math.min(192, (width - 48 - spellingGap) / 2);
      const spellingOffset = (spellingWidth + spellingGap) / 2;
      const settingsLeft = Math.max(24, centreX - 230);
      const settingsToggleX = Math.min(width - 69, centreX + 185);
      this.track(this.add.text(centreX, 66, "SETTINGS", {
        fontFamily: FONTS.display, fontSize: "34px", fontStyle: "bold", color: COLORS.white
      }).setOrigin(0.5));
      this.track(this.add.text(centreX, 122, "SPELLING", {
        fontFamily: FONTS.data, fontSize: "11px", fontStyle: "bold", color: cssToken("--accent-cyan"), letterSpacing: 2
      }).setOrigin(0.5));
      this.createButton("US ENGLISH", centreX - spellingOffset, 163, spellingWidth, this.chooseSpelling.bind(this, "US"), {
        fill: save.settings.spelling === "US" ? COLORS.cyan : COLORS.panel,
        stroke: COLORS.cyan, textColor: save.settings.spelling === "US" ? COLORS.ink : COLORS.white, height: 42, fontSize: 12
      });
      this.createButton("UK ENGLISH", centreX + spellingOffset, 163, spellingWidth, this.chooseSpelling.bind(this, "UK"), {
        fill: save.settings.spelling === "UK" ? COLORS.cyan : COLORS.panel,
        stroke: COLORS.cyan, textColor: save.settings.spelling === "UK" ? COLORS.ink : COLORS.white, height: 42, fontSize: 12
      });
      const rows = [
        { key: "sound", label: "SOUND", y: 235 },
        { key: "highContrast", label: "HIGH CONTRAST", y: 295 },
        { key: "reducedMotion", label: "REDUCED MOTION", y: 355 },
        { key: "colorblind", label: "COLORBLIND PATTERNS", y: 415 }
      ];
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const enabled = Boolean(save.settings[row.key]);
        this.track(this.add.text(settingsLeft, row.y, row.label, {
          fontFamily: FONTS.ui, fontSize: "13px", fontStyle: "bold", color: COLORS.white
        }).setOrigin(0, 0.5));
        this.createButton(enabled ? "ON" : "OFF", settingsToggleX, row.y, 90, this.toggleSetting.bind(this, row.key), {
          fill: enabled ? COLORS.cyan : COLORS.panel, stroke: enabled ? COLORS.cyan : COLORS.grid,
          textColor: enabled ? COLORS.ink : COLORS.tertiary, height: 36, fontSize: 11
        });
      }
      this.createButton("BACK", centreX, Math.min(this.scale.height - 44, 505), 170, this.showHome.bind(this, this.currentMode), {
        fill: COLORS.tile, stroke: COLORS.tile, height: 40, fontSize: 12
      });
    }

    // This applies the chosen dictionary variant and redraws Settings to show the new selection.
    chooseSpelling(variant) {
      window.ChainState.updateSetting("spelling", variant);
      this.showSettings();
    }

    // This flips one boolean preference and immediately applies contrast changes to the page.
    toggleSetting(key) {
      const enabled = !window.ChainState.get().settings[key];
      window.ChainState.updateSetting(key, enabled);
      if (key === "highContrast") {
        document.documentElement.dataset.highContrast = enabled ? "true" : "false";
      }
      if (key === "highContrast" || key === "reducedMotion") {
        window.location.reload();
        return;
      }
      this.showSettings();
    }

    // This redraws the current top-level view when the browser changes size.
    handleResize() {
      if (this.isCompactLandscape()) {
        this.showOrientationNotice();
        return;
      }
      this.destroyGroup(this.orientationObjects);
      if (this.screen === "home") {
        this.showHome(this.currentMode);
      } else if (this.screen === "archive") {
        this.showArchive();
      } else if (this.screen === "settings") {
        this.showSettings();
      } else if (this.screen === "game") {
        this.layoutGame();
        this.renderBoard();
        this.updateChainFeedback();
      }
    }

    // This removes browser-size and keyboard listeners when Phaser closes the scene.
    cleanUp() {
      this.input.keyboard.off("keydown", this.handleKeyDown, this);
      this.input.off("pointerdown", this.handlePointerDown, this);
      this.input.off("pointerup", this.handlePointerUp, this);
      this.scale.off("resize", this.handleResize, this);
      this.snake.destroy();
    }
  }

  window.ChainScenes = { AppScene: AppScene };
}());
