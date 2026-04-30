const MAX_VISIT = 180;
let STARTING_SCORE = 501;
let LEGS_TO_WIN = 2;
let GAME_TYPE = "bestOf";
let IN_MODE = "straight";
let CUSTOM_START_SCORE = 901;
let MATCH_MODE = "local";
let STATS_MODE = "competitive";


const state = {
  currentPlayer: 0,
  visitHistory: [],
  legJustWon: false,
  matchStartedAt: null,
  winnerIndex: null,
  players: [
    {
      score: STARTING_SCORE,
      legs: 0,
      totalScored: 0,
      dartsThrown: 0,
      lastScore: null,
      checkoutHits: 0,
      checkoutAttempts: 0,
      highestOut: 0,
      highScore: 0,
      oneEightys: 0,
      bullOuts: 0,
      legDarts: [],
      currentLegDarts: 0
    },
    {
      score: STARTING_SCORE,
      legs: 0,
      totalScored: 0,
      dartsThrown: 0,
      lastScore: null,
      checkoutHits: 0,
      checkoutAttempts: 0,
      highestOut: 0,
      highScore: 0,
      oneEightys: 0,
      bullOuts: 0,
      legDarts: [],
      currentLegDarts: 0
    },
  ]
};

const CHECKOUTS = {
  170: "T20 · T20 · Bull",
  167: "T20 · T19 · Bull",
  164: "T20 · T18 · Bull",
  161: "T20 · T17 · Bull",
  160: "T20 · T20 · D20",
  158: "T20 · T20 · D19",
  157: "T20 · T19 · D20",
  156: "T20 · T20 · D18",
  155: "T20 · T15 · Bull",
  154: "T20 · T18 · D20",
  153: "T20 · T19 · D18",
  152: "T20 · T20 · D16",
  151: "T20 · T17 · D20",
  150: "T20 · T18 · D18",
  149: "T20 · T19 · D16",
  148: "T20 · T16 · D20",
  147: "T20 · T17 · D18",
  146: "T20 · T18 · D16",
  145: "T20 · T15 · D20",
  144: "T20 · T20 · D12",
  143: "T20 · T17 · D16",
  142: "T20 · T14 · D20",
  141: "T20 · T15 · D18",
  140: "T20 · T16 · D16",
  139: "T20 · T13 · D20",
  138: "T20 · T14 · D18",
  137: "T17 · T18 · D16",
  136: "T20 · T20 · D8",
  135: "T20 · T15 · D15",
  134: "T20 · T14 · D16",
  133: "T20 · T19 · D8",
  132: "T20 · T20 · D6",
  131: "T20 · T13 · D16",
  130: "T20 · T18 · D8",
  129: "T20 · T19 · D6",
  128: "T18 · T14 · D16",
  127: "T19 · T18 · D8",
  126: "T19 · T19 · D6",
  125: "Bull · T20 · D20",
  124: "T20 · D16 · D16",
  123: "T19 · T16 · D9",
  122: "T18 · T20 · D4",
  121: "T20 · T15 · D8",
  120: "T20 · 20 · D20",
  119: "T19 · T10 · D16",
  118: "T20 · 18 · D20",
  117: "T20 · 17 · D20",
  116: "T20 · 16 · D20",
  115: "T20 · 15 · D20",
  114: "T20 · 14 · D20",
  113: "T20 · 13 · D20",
  112: "T20 · 20 · D16",
  111: "T20 · 19 · D16",
  110: "T20 · 18 · D16",
  109: "T20 · 17 · D16",
  108: "T20 · 16 · D16",
  107: "T19 · 18 · D16",
  106: "T20 · 14 · D16",
  105: "T20 · 13 · D16",
  104: "T18 · 18 · D16",
  103: "T20 · 11 · D16",
  102: "T20 · 10 · D16",
  101: "T17 · 18 · D16",
  100: "T20 · D20",
  99: "T19 · 10 · D16",
  98: "T20 · D19",
  97: "T19 · D20",
  96: "T20 · D18",
  95: "T15 · 18 · D16",
  94: "T18 · D20",
  93: "T19 · D18",
  92: "T20 · D16",
  91: "T17 · D20",
  90: "T18 · D18",
  89: "T19 · D16",
  88: "T16 · D20",
  87: "T17 · D18",
  86: "T18 · D16",
  85: "T15 · D20",
  84: "T20 · D12",
  83: "T17 · D16",
  82: "T14 · D20",
  81: "T15 · D18",
  80: "T16 · D16",
  79: "T13 · D20",
  78: "T14 · D18",
  77: "T15 · D16",
  76: "T20 · D8",
  75: "T15 · D15",
  74: "T14 · D16",
  73: "T19 · D8",
  72: "T20 · D6",
  71: "T13 · D16",
  70: "T18 · D8",
  69: "T19 · D6",
  68: "T16 · D10",
  67: "T17 · D8",
  66: "T10 · D18",
  65: "T15 · D10",
  64: "D16 · D16",
  63: "T13 · D12",
  62: "T10 · D16",
  61: "T15 · D8",
  60: "20 · D20",
  59: "19 · D20",
  58: "18 · D20",
  57: "17 · D20",
  56: "16 · D20",
  55: "15 · D20",
  54: "14 · D20",
  53: "13 · D20",
  52: "20 · D16",
  51: "19 · D16",
  50: "18 · D16",
  49: "17 · D16",
  48: "16 · D16",
  47: "15 · D16",
  46: "14 · D16",
  45: "13 · D16",
  44: "12 · D16",
  43: "11 · D16",
  42: "10 · D16",
  41: "9 · D16",
  40: "D20",
  39: "7 · D16",
  38: "D19",
  37: "5 · D16",
  36: "D18",
  35: "3 · D16",
  34: "D17",
  33: "1 · D16",
  32: "D16",
  31: "15 · D8",
  30: "D15",
  29: "13 · D8",
  28: "D14",
  27: "11 · D8",
  26: "D13",
  25: "9 · D8",
  24: "D12",
  23: "7 · D8",
  22: "D11",
  21: "5 · D8",
  20: "D10",
  19: "3 · D8",
  18: "D9",
  17: "1 · D8",
  16: "D8",
  15: "7 · D4",
  14: "D7",
  13: "5 · D4",
  12: "D6",
  11: "3 · D4",
  10: "D5",
  9: "1 · D4",
  8: "D4",
  7: "3 · D2",
  6: "D3",
  5: "1 · D2",
  4: "D2",
  3: "1 · D1",
  2: "D1",
};

const POSSIBLE_CHECKOUTS = new Set(Object.keys(CHECKOUTS).map(Number));

const FORCED_BULL_OUTS = new Set([161, 164, 167, 170]);

function canAskBullOut(score) {
  return score >= 50 && score <= 170 && POSSIBLE_CHECKOUTS.has(score);
}

let pendingCheckoutPrompt = null;

const els = {
  cards: [document.getElementById("playerOneCard"), document.getElementById("playerTwoCard")],
  names: [document.getElementById("playerOneName"), document.getElementById("playerTwoName")],
  scores: [document.getElementById("playerOneScore"), document.getElementById("playerTwoScore")],
  legs: [document.getElementById("playerOneLegs"), document.getElementById("playerTwoLegs")],
  avgs: [document.getElementById("playerOneAvg"), document.getElementById("playerTwoAvg")],
  lasts: [document.getElementById("playerOneLast"), document.getElementById("playerTwoLast")],
  darts: [document.getElementById("playerOneDarts"), document.getElementById("playerTwoDarts")],
  input: document.getElementById("scoreInput"),
  submit: document.getElementById("submitScoreBtn"),
  turnMessage: document.getElementById("turnMessage"),
  keypad: document.querySelector(".keypad"),
  newGame: document.getElementById("newGameBtn"),
  impossibleOverlay: document.getElementById("impossibleOverlay"),
  impossibleText: document.getElementById("impossibleText"),
  checkoutOverlay: document.getElementById("checkoutOverlay"),
  doublePromptBlock: document.getElementById("doublePromptBlock"),
  doublePromptOptions: document.getElementById("doublePromptOptions"),
  checkoutPromptBlock: document.getElementById("checkoutPromptBlock"),
  checkoutPromptOptions: document.getElementById("checkoutPromptOptions"),
  confirmCheckoutPromptBtn: document.getElementById("confirmCheckoutPromptBtn"),
  checkouts: [
    document.getElementById("playerOneCheckout"),
    document.getElementById("playerTwoCheckout")
  ],
  setupCard: document.getElementById("scorerSetupCard"),
  scorerCard: document.querySelector(".scorerCard"),
  setupPlayerOneName: document.getElementById("setupPlayerOneName"),
  setupPlayerTwoName: document.getElementById("setupPlayerTwoName"),
  bestFirstToggle: document.getElementById("bestFirstToggle"),
  bestOfBtn: document.getElementById("bestOfBtn"),
  firstToBtn: document.getElementById("firstToBtn"),
  legsCount: document.getElementById("legsCount"),
  legsDownBtn: document.getElementById("legsDownBtn"),
  legsUpBtn: document.getElementById("legsUpBtn"),
  startScorerGameBtn: document.getElementById("startScorerGameBtn"),
  customScoreBtn: document.getElementById("customScoreBtn"),
  customScoreOverlay: document.getElementById("customScoreOverlay"),
  customScoreInput: document.getElementById("customScoreInput"),
  closeCustomScoreBtn: document.getElementById("closeCustomScoreBtn"),
  confirmCustomScoreBtn: document.getElementById("confirmCustomScoreBtn"),
  startScoreSwitch: document.getElementById("startScoreSwitch"),
  inModeSwitch: document.getElementById("inModeSwitch"),
  quitGameBtn: document.getElementById("quitGameBtn"),
  gameSettingsBtn: document.getElementById("gameSettingsBtn"),
  gameTitleText: document.getElementById("gameTitleText"),
  statsBtn: document.getElementById("statsBtn"),
  statsOverlay: document.getElementById("statsOverlay"),
  closeStatsBtn: document.getElementById("closeStatsBtn"),
  statsMatchTitle: document.getElementById("statsMatchTitle"),
  statsMatchDate: document.getElementById("statsMatchDate"),
  statsPlayerOneName: document.getElementById("statsPlayerOneName"),
  statsPlayerTwoName: document.getElementById("statsPlayerTwoName"),
  statsPlayerOneLegs: document.getElementById("statsPlayerOneLegs"),
  statsPlayerTwoLegs: document.getElementById("statsPlayerTwoLegs"),
  statsPlayerOneWon: document.getElementById("statsPlayerOneWon"),
  statsPlayerTwoWon: document.getElementById("statsPlayerTwoWon"),
  statsRows: document.getElementById("statsRows"),
  quitConfirmOverlay: document.getElementById("quitConfirmOverlay"),
  closeQuitConfirmBtn: document.getElementById("closeQuitConfirmBtn"),
  cancelQuitBtn: document.getElementById("cancelQuitBtn"),
  confirmQuitBtn: document.getElementById("confirmQuitBtn"),
  settingsOverlay: document.getElementById("settingsOverlay"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  matchCompleteActions: document.getElementById("matchCompleteActions"),
  rematchBtn: document.getElementById("rematchBtn"),
  continueAfterMatchBtn: document.getElementById("continueAfterMatchBtn"),
  matchModeSwitch: document.getElementById("matchModeSwitch"),
  addOpponentBtn: document.getElementById("addOpponentBtn"),
  opponentOverlay: document.getElementById("opponentOverlay"),
  closeOpponentBtn: document.getElementById("closeOpponentBtn"),
  linkedPlayersList: document.getElementById("linkedPlayersList"),
  unlinkedPlayersList: document.getElementById("unlinkedPlayersList"),
  guestPlayerBtn: document.getElementById("guestPlayerBtn"),
  guestPlayerOverlay: document.getElementById("guestPlayerOverlay"),
  closeGuestPlayerBtn: document.getElementById("closeGuestPlayerBtn"),
  guestPlayerNameInput: document.getElementById("guestPlayerNameInput"),
  confirmGuestPlayerBtn: document.getElementById("confirmGuestPlayerBtn"),
  setupPlayerOneDisplay: document.getElementById("setupPlayerOneDisplay"),
  setupPlayerOneImage: document.getElementById("setupPlayerOneImage"),
  profileOverlay: document.getElementById("profileOverlay"),
  closeProfileBtn: document.getElementById("closeProfileBtn"),
  checkoutModal: document.querySelector(".checkoutModal"),
  statsModeSwitch: document.getElementById("statsModeSwitch"),
  statsModeText: document.getElementById("statsModeText"),
  setupPlayerTwoTile: document.getElementById("setupPlayerTwoTile"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
};

// ✅ Hide fullscreen button on desktop/tablet
if (window.innerWidth >= 500 && els.fullscreenBtn) {
  els.fullscreenBtn.style.display = "none";
}


function resetAddOpponentButton() {
  els.setupPlayerTwoName.value = "Player 2";

  els.setupPlayerTwoTile.className = "setupPlayerTile addPlayerTile";
  els.setupPlayerTwoTile.innerHTML = `
    <button id="addOpponentBtn" type="button" class="addOpponentBtn" aria-label="Add player">
      <span>+</span>
    </button>
  `;

  els.addOpponentBtn = document.getElementById("addOpponentBtn");
  els.addOpponentBtn.addEventListener("click", openOpponentModal);
}

async function getPlayerImageByName(name) {
  let imageUrl = "graphics/logoWoText.png";

  try {
    if (name && window.PlayerData?.fetchPlayerPhotosFromDrive) {
      const photos = await window.PlayerData.fetchPlayerPhotosFromDrive();
      const key = window.PlayerData.photoKey(name);
      imageUrl = photos[key] || imageUrl;
    }
  } catch (err) {
    console.warn("Could not load player image", err);
  }

  return imageUrl;
}

async function setOpponent(name) {
  els.setupPlayerTwoName.value = name;
  const imageUrl = await getPlayerImageByName(name);

  els.setupPlayerTwoTile.className = "setupPlayerTile hasPlayer";
  els.setupPlayerTwoTile.innerHTML = `
    <div class="setupPlayerAvatarWrap">
      <img class="setupPlayerAvatar" src="${imageUrl}" alt="${name}">
      <button type="button" class="removeSetupPlayerBtn" id="removeOpponentBtn">×</button>
    </div>
    <div class="setupPlayerName">${name}</div>
  `;

  document.getElementById("removeOpponentBtn").addEventListener("click", event => {
    event.stopPropagation();
    resetAddOpponentButton();
  });

  closeOpponentModal();
}

function removeOpponent() {
  resetAddOpponentButton();
}
async function openOpponentModal() {
  els.opponentOverlay.classList.remove("hidden");
  els.opponentOverlay.setAttribute("aria-hidden", "false");

  els.linkedPlayersList.innerHTML = `
    <div class="loadingRow">
      <span class="inlineSpinner"></span>
      <span>Loading linked players...</span>
    </div>
  `;

  if (els.unlinkedPlayersList) {
    els.unlinkedPlayersList.innerHTML = "";
  }

  try {
    const result = await postDartMatch({
      action: "getLinkedPlayers"
    });

    if (!result.success) {
      els.linkedPlayersList.innerHTML = `<div class="muted">Could not load linked players.</div>`;
      return;
    }

    const currentUser = window.ONMSession?.getUser?.();
    const currentPlayerKey = currentUser?.linkedPlayerKey;

    const players = (result.players || []).filter(player => {
      return player.playerKey !== currentPlayerKey;
    });

    if (!players.length) {
      els.linkedPlayersList.innerHTML = `<div class="muted">No other linked players found.</div>`;
      return;
    }

    let drivePhotos = {};

    try {
      if (window.PlayerData?.fetchPlayerPhotosFromDrive) {
        drivePhotos = await window.PlayerData.fetchPlayerPhotosFromDrive();
      }
    } catch (err) {
      console.warn("Could not load player photos", err);
    }

    els.linkedPlayersList.innerHTML = players.map(player => {
      const key = window.PlayerData?.photoKey
        ? window.PlayerData.photoKey(player.playerName)
        : player.playerKey;

      const imageUrl = drivePhotos[key] || "graphics/logoWoText.png";

      return `
        <div class="playerRow">
          <img src="${imageUrl}" alt="${player.playerName}">
          <span>${player.playerName} <span class="playerTick">✓</span></span>
          <button type="button" class="inviteBtn" data-player="${player.playerName}">Invite</button>
        </div>
      `;
    }).join("");

    els.linkedPlayersList.querySelectorAll("[data-player]").forEach(button => {
      button.addEventListener("click", () => setOpponent(button.dataset.player));
    });

  } catch (err) {
    console.warn("Could not load linked players", err);
    els.linkedPlayersList.innerHTML = `<div class="muted">Could not connect to linked players.</div>`;
  }
}

function closeOpponentModal() {
  els.opponentOverlay.classList.add("hidden");
  els.opponentOverlay.setAttribute("aria-hidden", "true");
}

els.addOpponentBtn?.addEventListener("click", openOpponentModal);
els.closeOpponentBtn.addEventListener("click", closeOpponentModal);

els.guestPlayerBtn.addEventListener("click", () => {
  els.guestPlayerOverlay.classList.remove("hidden");
  els.guestPlayerOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => els.guestPlayerNameInput.focus(), 50);
});

els.closeGuestPlayerBtn.addEventListener("click", () => {
  els.guestPlayerOverlay.classList.add("hidden");
});

els.confirmGuestPlayerBtn.addEventListener("click", () => {
  const name = els.guestPlayerNameInput.value.trim();
  if (!name) return;
  els.guestPlayerOverlay.classList.add("hidden");
  setOpponent(name);
});


function playerName(index) {
  return els.names[index].value.trim() || `Player ${index + 1}`;
}

function isCheckout(scoreBeforeVisit, visitScore) {
  return scoreBeforeVisit - visitScore === 0 && POSSIBLE_CHECKOUTS.has(scoreBeforeVisit);
}

function updateLegTarget() {
  const count = Number(els.legsCount.textContent);

  if (GAME_TYPE === "bestOf") {
    LEGS_TO_WIN = Math.floor(count / 2) + 1;
  } else {
    LEGS_TO_WIN = count;
  }
}

function getGameTitle() {
  const count = Number(els.legsCount.textContent);
  const gameTypeText = GAME_TYPE === "bestOf" ? `BO${count}` : `FT${count}`;
  const statsModeText = STATS_MODE === "competitive" ? "COMPETITIVE" : "CASUAL";

  return `${statsModeText}: ${STARTING_SCORE} · ${gameTypeText}`;
}

document.getElementById("removePlayerOneBtn")?.addEventListener("click", () => {
  els.setupPlayerOneName.value = "Player 1";
  els.setupPlayerOneDisplay.textContent = "Player 1";
  els.setupPlayerOneImage.src = "graphics/logoWoText.png";
});

els.bestOfBtn.addEventListener("click", () => {
  GAME_TYPE = "bestOf";
  setTogglePosition(els.bestFirstToggle, els.bestOfBtn);
  updateLegTarget();
});

els.firstToBtn.addEventListener("click", () => {
  GAME_TYPE = "firstTo";
  setTogglePosition(els.bestFirstToggle, els.firstToBtn);
  updateLegTarget();
});

els.legsUpBtn.addEventListener("click", () => {
  let count = Number(els.legsCount.textContent);
  count = Math.min(21, count + 1);
  els.legsCount.textContent = count;
  updateLegTarget();
});

els.legsDownBtn.addEventListener("click", () => {
  let count = Number(els.legsCount.textContent);
  count = Math.max(1, count - 1);
  els.legsCount.textContent = count;
  updateLegTarget();
});


document.querySelectorAll("#startScoreSwitch .toggleBtn").forEach(button => {
  button.addEventListener("click", () => {
    if (button.id === "customScoreBtn") {
      els.customScoreOverlay.classList.remove("hidden");
      els.customScoreOverlay.setAttribute("aria-hidden", "false");
      els.customScoreInput.value = CUSTOM_START_SCORE;

      setTimeout(() => {
        els.customScoreInput.focus();
        els.customScoreInput.select();
      }, 50);
      return;
    }

    STARTING_SCORE = Number(button.dataset.startScore);
    setTogglePosition(els.startScoreSwitch, button);
  });
});

els.closeCustomScoreBtn.addEventListener("click", () => {
  els.customScoreOverlay.classList.add("hidden");
  els.customScoreOverlay.setAttribute("aria-hidden", "true");
});

els.confirmCustomScoreBtn.addEventListener("click", () => {
  const customValue = Number(els.customScoreInput.value);

  if (!Number.isInteger(customValue) || customValue < 2 || customValue > 5001) {
    els.customScoreInput.select();
    return;
  }

  CUSTOM_START_SCORE = customValue;
  STARTING_SCORE = customValue;
  els.customScoreBtn.innerHTML = `<span>Custom</span><strong>${customValue}</strong>`;
  setTogglePosition(els.startScoreSwitch, els.customScoreBtn);

  els.customScoreOverlay.classList.add("hidden");
  els.customScoreOverlay.setAttribute("aria-hidden", "true");
});

document.querySelectorAll("#inModeSwitch .toggleBtn").forEach(button => {
  button.addEventListener("click", () => {
    IN_MODE = button.dataset.inMode;
    setTogglePosition(els.inModeSwitch, button);
  });
});

function closeQuitConfirm() {
  els.quitConfirmOverlay.classList.add("hidden");
  els.quitConfirmOverlay.setAttribute("aria-hidden", "true");
}

els.closeQuitConfirmBtn.addEventListener("click", closeQuitConfirm);
els.cancelQuitBtn.addEventListener("click", closeQuitConfirm);

els.quitConfirmOverlay.addEventListener("click", event => {
  if (event.target !== els.quitConfirmOverlay) return;
  closeQuitConfirm();
});

els.confirmQuitBtn.addEventListener("click", () => {
  closeQuitConfirm();
  newGame();
  els.scorerCard.classList.add("hidden");
  els.setupCard.classList.remove("hidden");

  if (window.innerWidth < 500) {
    exitScorerFullscreen();
  }
});

els.quitGameBtn.addEventListener("click", () => {
  els.quitConfirmOverlay.classList.remove("hidden");
  els.quitConfirmOverlay.setAttribute("aria-hidden", "false");
});

els.gameSettingsBtn.addEventListener("click", () => {
  els.settingsOverlay.classList.remove("hidden");
  els.settingsOverlay.setAttribute("aria-hidden", "false");
});

function closeSettingsModal() {
  els.settingsOverlay.classList.add("hidden");
  els.settingsOverlay.setAttribute("aria-hidden", "true");
}

els.closeSettingsBtn.addEventListener("click", closeSettingsModal);

els.settingsOverlay.addEventListener("click", event => {
  if (event.target !== els.settingsOverlay) return;
  closeSettingsModal();
});

els.startScorerGameBtn.addEventListener("click", () => {
  els.names[0].value = els.setupPlayerOneName.value.trim() || "Player 1";
  els.names[1].value = els.setupPlayerTwoName.value.trim() || "Player 2";

  updateLegTarget();
  els.gameTitleText.textContent = getGameTitle();
  state.matchStartedAt = new Date();
  state.winnerIndex = null;
  newGame();

  els.setupCard.classList.add("hidden");
  els.scorerCard.classList.remove("hidden");

  // ✅ ONLY fullscreen on small screens
  if (window.innerWidth < 500) {
    enterScorerFullscreen();
  }
});

function render() {
  state.players.forEach((player, index) => {
    const checkout = CHECKOUTS[player.score];

    els.checkouts[index].textContent = checkout || "";
    els.checkouts[index].classList.toggle("show", Boolean(checkout));
    els.scores[index].textContent = player.score;
    els.legs[index].textContent = player.legs;
    els.lasts[index].textContent = player.lastScore ?? "-";
    els.darts[index].textContent = player.dartsThrown;

    const average = player.dartsThrown
      ? (player.totalScored / player.dartsThrown) * 3
      : 0;

    els.avgs[index].textContent = average.toFixed(2);
    els.cards[index].classList.toggle("activePlayer", index === state.currentPlayer);
  });

  els.turnMessage.textContent = `${playerName(state.currentPlayer)}'s turn!`;
  els.turnMessage.classList.toggle("playerTwoTurn", state.currentPlayer === 1);
  if (document.activeElement !== els.input) {
    els.input.blur();
  }
}

function switchPlayer() {
  state.currentPlayer = state.currentPlayer === 0 ? 1 : 0;
}

function getMinimumCheckoutDarts(score) {
  if (!POSSIBLE_CHECKOUTS.has(score)) return null;

  if (score <= 40 && score % 2 === 0) return 1;
  if (score === 50) return 1;

  if (score <= 110) return 2;

  return 3;
}

function getDoubleOptionsForMissedVisit(scoreBeforeVisit, visitScore) {
  const remaining = scoreBeforeVisit - visitScore;

  if (remaining < 2 || remaining > 50) return null;
  if (remaining === 1) return null;

  const wasAlreadyOnOneDartFinish =
    scoreBeforeVisit <= 40 && scoreBeforeVisit % 2 === 0;

  if (wasAlreadyOnOneDartFinish || scoreBeforeVisit === 50) {
    return [1, 2, 3];
  }

  const possibleAttempts = 3 - Math.ceil(visitScore / 60);
  const maxAttempts = Math.max(0, Math.min(2, possibleAttempts));

  return Array.from({ length: maxAttempts + 1 }, (_, index) => index);
}

function buildPromptButtons(container, values, selectedValue) {
  container.innerHTML = "";

  values.forEach(value => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = value;
    button.dataset.value = value;

    if (value === selectedValue) {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => {
      if (button.disabled) return;

      container.querySelectorAll("button").forEach(btn => btn.classList.remove("selected"));
      button.classList.add("selected");

      syncCheckoutPromptOptions(container);
    });

    container.appendChild(button);
  });
}

function openCheckoutPrompt(config) {
  pendingCheckoutPrompt = config;

  document.getElementById("bullOutPromptBlock")?.remove();

  if (config.doubleOptions) {
    els.doublePromptBlock.classList.remove("hidden");
    buildPromptButtons(els.doublePromptOptions, config.doubleOptions, config.doubleOptions[0]);
  } else {
    els.doublePromptBlock.classList.add("hidden");
    els.doublePromptOptions.innerHTML = "";
  }

  if (config.checkoutOptions) {
    els.checkoutPromptBlock.classList.remove("hidden");
    buildPromptButtons(els.checkoutPromptOptions, config.checkoutOptions, config.checkoutOptions[0]);
  } else {
    els.checkoutPromptBlock.classList.add("hidden");
    els.checkoutPromptOptions.innerHTML = "";
  }

  if (config.bullOutOptions) {
    const block = document.createElement("div");
    block.id = "bullOutPromptBlock";
    block.className = "checkoutPromptBlock";

    block.innerHTML = `
      <div class="checkoutPromptLabel">Bull-out?</div>
      <div id="bullOutPromptOptions" class="checkoutPromptOptions"></div>
    `;

    els.confirmCheckoutPromptBtn.before(block);

    const optionsEl = document.getElementById("bullOutPromptOptions");
    buildPromptButtons(optionsEl, config.bullOutOptions, config.bullOutDefault);
  }

  els.checkoutOverlay.classList.remove("hidden");
  els.checkoutOverlay.setAttribute("aria-hidden", "false");

  syncCheckoutPromptOptions();
}

function getSelectedPromptValue(container) {
  const selected = container.querySelector("button.selected");
  return selected ? Number(selected.dataset.value) : 0;
}

function syncCheckoutPromptOptions(changedContainer = null) {
  if (!pendingCheckoutPrompt || !pendingCheckoutPrompt.doubleOptions || !pendingCheckoutPrompt.checkoutOptions) return;

  const doubleDarts = getSelectedPromptValue(els.doublePromptOptions);
  const checkoutDarts = getSelectedPromptValue(els.checkoutPromptOptions);

  if (changedContainer === els.doublePromptOptions && doubleDarts > checkoutDarts) {
    els.checkoutPromptOptions.querySelectorAll("button").forEach(button => {
      button.classList.toggle("selected", Number(button.dataset.value) === doubleDarts);
    });
  }

  if (changedContainer === els.checkoutPromptOptions && checkoutDarts < doubleDarts) {
    els.doublePromptOptions.querySelectorAll("button").forEach(button => {
      button.classList.toggle("selected", Number(button.dataset.value) === checkoutDarts);
    });
  }
}

function showImpossibleMessage(message) {
  els.impossibleText.textContent = message.toUpperCase();
  els.impossibleOverlay.classList.remove("hidden");
  els.impossibleOverlay.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    els.impossibleOverlay.classList.add("hidden");
    els.impossibleOverlay.setAttribute("aria-hidden", "true");
    els.input.value = "";
    els.input.blur();
  }, 1200);
}

function closeCheckoutPrompt() {
  els.checkoutOverlay.classList.add("hidden");
  els.checkoutOverlay.setAttribute("aria-hidden", "true");
  pendingCheckoutPrompt = null;
}

function submitScore() {
  const value = Number(els.input.value);

  if (!Number.isInteger(value) || value < 0 || value > MAX_VISIT) {
    els.input.select();
    return;
  }

  state.legJustWon = false;

  const player = state.players[state.currentPlayer];
  const previousScore = player.score;
  let bust = false;
  let legWon = false;

  if (value > previousScore) {
    showImpossibleMessage(`${value} is impossible`);
    els.input.value = "";
    return;
  }

  if (previousScore - value === 1) {
    showImpossibleMessage("1 is impossible");
    els.input.value = "";
    return;
  }

  if (previousScore - value === 0) {

    if (!CHECKOUTS[previousScore]) {
      showImpossibleMessage(`${previousScore} is impossible`);
      els.input.value = "";
      return;
    }
    if (isCheckout(previousScore, value)) {
      legWon = true;
    } else {
      bust = true;
    }
  }

  if (legWon) {
    const minimumDarts = getMinimumCheckoutDarts(previousScore);

    const bullOutOptions = canAskBullOut(previousScore)
      ? FORCED_BULL_OUTS.has(previousScore) ? ["Yes"] : ["No", "Yes"]
      : null;

    const bullOutDefault = FORCED_BULL_OUTS.has(previousScore) ? "Yes" : "No";

    if (minimumDarts === 1) {
      openCheckoutPrompt({
        title: "Checkout details",
        playerIndex: state.currentPlayer,
        visitScore: value,
        previousScore,
        legWon: true,
        bust: false,
        doubleOptions: [1, 2, 3],
        checkoutOptions: [1, 2, 3],
        bullOutOptions,
        bullOutDefault
      });
      return;
    }

    if (minimumDarts === 2) {
      openCheckoutPrompt({
        title: "Checkout details",
        playerIndex: state.currentPlayer,
        visitScore: value,
        previousScore,
        legWon: true,
        bust: false,
        doubleOptions: [1, 2],
        checkoutOptions: [2, 3],
        bullOutOptions,
        bullOutDefault
      });
      return;
    }
    if (minimumDarts === 3 && bullOutOptions) {
      openCheckoutPrompt({
        title: "Checkout details",
        playerIndex: state.currentPlayer,
        visitScore: value,
        previousScore,
        legWon: true,
        bust: false,
        doubleOptions: null,
        checkoutOptions: null,
        bullOutOptions,
        bullOutDefault
      });
      return;
    }
  }

  if (!legWon && !bust) {
    const doubleOptions = getDoubleOptionsForMissedVisit(previousScore, value);

    if (doubleOptions && doubleOptions.length > 1) {
      openCheckoutPrompt({
        title: "Darts at double",
        playerIndex: state.currentPlayer,
        visitScore: value,
        previousScore,
        legWon: false,
        bust: false,
        doubleOptions,
        checkoutOptions: null
      });
      return;
    }
  }

  applyVisit({
    playerIndex: state.currentPlayer,
    visitScore: value,
    previousScore,
    legWon,
    bust,
    dartsUsed: 3,
    doublesAttempted: 0,
    bullOut: false
  });
}

function setTogglePosition(toggleEl, activeBtn) {
  const buttons = [...toggleEl.querySelectorAll(".toggleBtn")];
  const slider = toggleEl.querySelector(".toggleSlider");
  const index = buttons.indexOf(activeBtn);
  const count = buttons.length;

  buttons.forEach(btn => btn.classList.remove("active"));
  activeBtn.classList.add("active");

  slider.style.width = `calc((100% - 8px) / ${count})`;
  slider.style.transform = `translateX(${index * 100}%)`;
}

function launchFireworks(playerIndex) {
  const card = els.cards[playerIndex];
  const colors = ["#FFD740", "#44d17a", "#ffffff", "#ff4d4d", "#2f8cff"];

  for (let i = 0; i < 28; i++) {
    const particle = document.createElement("span");
    particle.className = "fireworkParticle";

    const angle = Math.random() * Math.PI * 2;
    const distance = 55 + Math.random() * 90;

    particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];

    card.appendChild(particle);

    setTimeout(() => {
      particle.remove();
    }, 900);
  }
}

function applyVisit({ playerIndex, visitScore, previousScore, legWon, bust, dartsUsed, doublesAttempted, bullOut = false }) {
  const player = state.players[playerIndex];

  const historyItem = {
    playerIndex,
    previousScore,
    previousLastScore: player.lastScore,
    previousTotalScored: player.totalScored,
    previousDartsThrown: player.dartsThrown,
    previousLegs: player.legs,
    bust,
    legWon,
    doublesAttempted
  };

  player.lastScore = bust ? "-" : visitScore;
  const previousDartsThrown = player.dartsThrown;

  player.dartsThrown += dartsUsed;
  player.currentLegDarts += dartsUsed;

  if (!bust) {
    player.highScore = Math.max(player.highScore, visitScore);

    player.totalScored += visitScore;
    player.score -= visitScore;

    if (visitScore === 180) {
      player.oneEightys += 1;
    }
  }

  if (legWon) {
    if (bullOut) {
      player.bullOuts += 1;
    }
    player.legs += 1;
    player.checkoutHits += 1;
    player.checkoutAttempts += Math.max(1, doublesAttempted);
    player.highestOut = Math.max(player.highestOut, previousScore);
    player.legDarts.push(player.currentLegDarts);
    state.visitHistory = [];
    state.legJustWon = true;
    launchFireworks(playerIndex);

    if (player.legs >= LEGS_TO_WIN) {
      state.winnerIndex = playerIndex;
      els.submit.disabled = true;

      setTimeout(() => {
        openStatsModal(true);
      }, 700);
    } else {
      resetLeg();
    }
  } else if (!bust && doublesAttempted) {
    if (doublesAttempted) {
      player.checkoutAttempts += doublesAttempted;
    }
  }

  state.visitHistory.push(historyItem);
  els.input.value = "";

  if (!els.submit.disabled) {
    switchPlayer();
  }

  render();
}

function resetLeg() {
  state.players.forEach(player => {
    player.score = STARTING_SCORE;
    player.lastScore = null;
    player.currentLegDarts = 0;
  });
}

function undoLastVisit() {
  if (state.legJustWon) {
    els.input.blur();
    return;
  }

  const last = state.visitHistory.pop();
  if (!last) {
    els.input.blur();
    return;
  }

  const player = state.players[last.playerIndex];
  player.score = last.previousScore;
  player.lastScore = last.previousLastScore;
  player.totalScored = last.previousTotalScored;
  player.dartsThrown = last.previousDartsThrown;
  player.legs = last.previousLegs;

  state.currentPlayer = last.playerIndex;
  els.submit.disabled = false;
  render();
}

function formatMatchDate(date) {
  if (!date) return "";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getPlayerStats(player) {
  const average = player.dartsThrown
    ? ((player.totalScored / player.dartsThrown) * 3).toFixed(2)
    : "0.00";

  const checkoutRate = player.checkoutAttempts
    ? `${((player.checkoutHits / player.checkoutAttempts) * 100).toFixed(2)}%`
    : "0.00%";

  return {
    average,
    checkouts: `${player.checkoutHits}/${player.checkoutAttempts}`,
    checkoutRate,
    highestOut: player.highestOut || "-",
    highScore: player.highScore || "-",
    bestLeg: player.legDarts.length ? `${Math.min(...player.legDarts)} darts` : "-",
    worstLeg: player.legDarts.length ? `${Math.max(...player.legDarts)} darts` : "-",
    oneEightys: player.oneEightys || 0,
    bullOuts: player.bullOuts || 0,
  };
}

async function submitCompetitiveResult() {
  const button = document.getElementById("submitMatchResultBtn");
  if (!button) return;

  button.disabled = true;
  button.innerHTML = `<span class="btnSpinner"></span> Submitting`;

  const saved = await saveFinishedDartMatch();

  if (!saved) {
    button.disabled = false;
    button.textContent = "Submit result";
    alert("Could not submit result. Please try again.");
    return;
  }

  els.statsRows.insertAdjacentHTML("afterend", `
    <div class="resultSubmittedSuccess">
      <div class="linkSuccessIcon">✓</div>
      <div class="linkSuccessTitle">Result submitted</div>
    </div>
  `);

  button.remove();

  setTimeout(() => {
    closeStatsModal();
    newGame();
    els.scorerCard.classList.add("hidden");
    els.setupCard.classList.remove("hidden");
  }, 1200);
}

function openStatsModal(isMatchComplete = false) {
  const p1 = state.players[0];
  const p2 = state.players[1];
  const s1 = getPlayerStats(p1);
  const s2 = getPlayerStats(p2);

  document.querySelector("#statsOverlay .modalTitle").textContent = isMatchComplete
    ? `Match complete - ${playerName(state.winnerIndex)} wins`
    : "Match stats";

  els.statsMatchTitle.textContent = getGameTitle();
  els.statsMatchDate.textContent = formatMatchDate(state.matchStartedAt);

  els.statsPlayerOneName.textContent = playerName(0);
  els.statsPlayerTwoName.textContent = playerName(1);
  els.statsPlayerOneLegs.textContent = p1.legs;
  els.statsPlayerTwoLegs.textContent = p2.legs;

  els.statsOverlay.classList.toggle("matchComplete", isMatchComplete);

  els.statsPlayerOneWon.classList.toggle("hidden", !isMatchComplete || state.winnerIndex !== 0);
  els.statsPlayerTwoWon.classList.toggle("hidden", !isMatchComplete || state.winnerIndex !== 1);

  els.closeStatsBtn.classList.toggle("hidden", isMatchComplete);
  els.matchCompleteActions.classList.toggle("hidden", !isMatchComplete);

  if (isMatchComplete) {
    els.matchCompleteActions.innerHTML =
      STATS_MODE === "competitive"
        ? `<button id="submitMatchResultBtn" type="button" class="btn btnPrimary">Submit result</button>`
        : `
        <button id="rematchBtn" type="button" class="btn btnGhost">Rematch</button>
        <button id="continueAfterMatchBtn" type="button" class="btn btnPrimary">Continue</button>
      `;

    document.getElementById("submitMatchResultBtn")?.addEventListener("click", submitCompetitiveResult);

    document.getElementById("rematchBtn")?.addEventListener("click", () => {
      closeStatsModal();
      newGame();
    });

    document.getElementById("continueAfterMatchBtn")?.addEventListener("click", () => {
      closeStatsModal();
      newGame();
      els.scorerCard.classList.add("hidden");
      els.setupCard.classList.remove("hidden");
    });
  }

  const rows = [
    ["3-dart avg.", s1.average, s2.average],
    ["Checkouts", s1.checkouts, s2.checkouts],
    ["Checkout rate", s1.checkoutRate, s2.checkoutRate],
    ["Highest out", s1.highestOut, s2.highestOut],
    ["High score", s1.highScore, s2.highScore],
    ["Best leg", s1.bestLeg, s2.bestLeg],
    ["Worst leg", s1.worstLeg, s2.worstLeg],
    ["180s", s1.oneEightys, s2.oneEightys],
    ["Bull-outs", s1.bullOuts, s2.bullOuts]
  ];

  els.statsRows.innerHTML = rows.map(([label, left, right]) => `
    <div class="statRow">
      <div class="statValue">${left}</div>
      <div class="statLabelWrap">
        <div class="statLabel">${label}</div>
      </div>
      <div class="statValue">${right}</div>
    </div>
  `).join("");

  els.statsOverlay.classList.remove("hidden");
  els.statsOverlay.setAttribute("aria-hidden", "false");
}

function closeStatsModal() {
  els.statsOverlay.classList.add("hidden");
  els.statsOverlay.setAttribute("aria-hidden", "true");
}

function newGame() {
  matchSaved = false;
  state.currentPlayer = 0;
  state.visitHistory = [];
  state.legJustWon = false;
  state.players.forEach(player => {
    player.score = STARTING_SCORE;
    player.legs = 0;
    player.totalScored = 0;
    player.dartsThrown = 0;
    player.lastScore = null;
    player.checkoutHits = 0;
    player.checkoutAttempts = 0;
    player.highestOut = 0;
    player.highScore = 0;
    player.legDarts = [];
    player.currentLegDarts = 0;
    player.oneEightys = 0;
    player.bullOuts = 0;
  });

  els.submit.disabled = false;
  els.input.value = "";
  render();
}

const DART_MATCH_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXZp0rgR2xYo1S7P-512FzoOlWjMfJaRcRPpRVzTkBiWGUEWEbQ25V3_vcLBse_rt5wA/exec";

let matchSaved = false;

async function postDartMatch(payload) {
  const response = await fetch(DART_MATCH_APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    }
  });

  return response.json();
}

function cleanStatNumber(value) {
  if (value === "-" || value === undefined || value === null) return "";
  return String(value).replace(" darts", "").replace("%", "");
}

function buildDartMatchPayload() {
  const p1 = state.players[0];
  const p2 = state.players[1];

  const s1 = getPlayerStats(p1);
  const s2 = getPlayerStats(p2);

  const savedUser = localStorage.getItem("onmUser");
  const user = savedUser ? JSON.parse(savedUser) : null;

  return {
    matchId: `DART-${Date.now()}`,
    dateTime: state.matchStartedAt ? state.matchStartedAt.toISOString() : new Date().toISOString(),
    startScore: STARTING_SCORE,
    gameType: GAME_TYPE,
    legsCount: Number(els.legsCount.textContent),
    legsToWin: LEGS_TO_WIN,
    inMode: IN_MODE,
    matchMode: MATCH_MODE,

    playerOneName: playerName(0),
    playerOneId: user?.linkedPlayerKey || user?.userId || "",
    playerOneLegs: p1.legs,
    playerOneWon: state.winnerIndex === 0,
    playerOne3DartAvg: s1.average,
    playerOneDartsThrown: p1.dartsThrown,
    playerOneTotalScored: p1.totalScored,
    playerOneCheckoutsHit: p1.checkoutHits,
    playerOneCheckoutAttempts: p1.checkoutAttempts,
    playerOneCheckoutRate: cleanStatNumber(s1.checkoutRate),
    playerOneHighestOut: cleanStatNumber(s1.highestOut),
    playerOneHighScore: cleanStatNumber(s1.highScore),
    playerOneBestLeg: cleanStatNumber(s1.bestLeg),
    playerOneWorstLeg: cleanStatNumber(s1.worstLeg),
    playerOne180s: p1.oneEightys || 0,
    playerOneBullOuts: p1.bullOuts || 0,

    playerTwoName: playerName(1),
    playerTwoId: "",
    playerTwoLegs: p2.legs,
    playerTwoWon: state.winnerIndex === 1,
    playerTwo3DartAvg: s2.average,
    playerTwoDartsThrown: p2.dartsThrown,
    playerTwoTotalScored: p2.totalScored,
    playerTwoCheckoutsHit: p2.checkoutHits,
    playerTwoCheckoutAttempts: p2.checkoutAttempts,
    playerTwoCheckoutRate: cleanStatNumber(s2.checkoutRate),
    playerTwoHighestOut: cleanStatNumber(s2.highestOut),
    playerTwoHighScore: cleanStatNumber(s2.highScore),
    playerTwoBestLeg: cleanStatNumber(s2.bestLeg),
    playerTwoWorstLeg: cleanStatNumber(s2.worstLeg),
    playerTwo180s: p2.oneEightys || 0,
    playerTwoBullOuts: p2.bullOuts || 0
  };
}

async function saveFinishedDartMatch() {
  if (STATS_MODE !== "competitive") return true;
  if (matchSaved) return true;
  if (state.winnerIndex === null) return false;

  try {
    const result = await postDartMatch({
      action: "saveDartMatch",
      match: buildDartMatchPayload()
    });

    if (!result.success) {
      console.warn("Could not save dart match:", result.error);
      return false;
    }

    matchSaved = true;
    return true;
  } catch (err) {
    console.warn("Could not connect to save dart match:", err);
    return false;
  }
}

els.checkoutOverlay.addEventListener("click", event => {
  if (event.target !== els.checkoutOverlay) return;

  closeCheckoutPrompt();
  els.input.value = "";
  els.input.blur();
});

els.confirmCheckoutPromptBtn.addEventListener("click", () => {
  if (!pendingCheckoutPrompt) return;

  const doublesAttempted = pendingCheckoutPrompt.doubleOptions
    ? getSelectedPromptValue(els.doublePromptOptions)
    : 0;

  const dartsUsed = pendingCheckoutPrompt.checkoutOptions
    ? getSelectedPromptValue(els.checkoutPromptOptions)
    : 3;

  const bullOutSelected = document.querySelector("#bullOutPromptOptions button.selected");
  const bullOut = bullOutSelected
    ? bullOutSelected.dataset.value === "Yes"
    : false;

  const promptData = pendingCheckoutPrompt;
  closeCheckoutPrompt();

  applyVisit({
    playerIndex: promptData.playerIndex,
    visitScore: promptData.visitScore,
    previousScore: promptData.previousScore,
    legWon: promptData.legWon,
    bust: promptData.bust,
    dartsUsed,
    doublesAttempted,
    bullOut
  });
});

els.customScoreOverlay.addEventListener("click", (e) => {
  if (e.target !== els.customScoreOverlay) return;

  els.customScoreOverlay.classList.add("hidden");
  els.customScoreOverlay.setAttribute("aria-hidden", "true");
});

els.submit.addEventListener("click", submitScore);

els.input.addEventListener("keydown", event => {
  if (event.key === "Enter") submitScore();
});

els.input.addEventListener("input", () => {
  if (els.input.value === "") return;

  els.input.value = String(Number(els.input.value));

  if (Number(els.input.value) > MAX_VISIT) {
    els.input.value = String(MAX_VISIT);
  }
});

els.statsBtn.addEventListener("click", () => {
  openStatsModal(false);
});
els.closeStatsBtn.addEventListener("click", closeStatsModal);

els.statsOverlay.addEventListener("click", event => {
  if (event.target !== els.statsOverlay) return;
  if (state.winnerIndex !== null) return;
  closeStatsModal();
});

els.customScoreInput.addEventListener("focus", () => {
  els.customScoreInput.select();
});

document.querySelectorAll("#matchModeSwitch .toggleBtn").forEach(button => {
  button.addEventListener("click", () => {
    MATCH_MODE = button.dataset.matchMode;
    setTogglePosition(els.matchModeSwitch, button);
  });
});

document.querySelectorAll("#statsModeSwitch .toggleBtn").forEach(button => {
  button.addEventListener("click", () => {
    STATS_MODE = button.dataset.statsMode;
    setTogglePosition(els.statsModeSwitch, button);

    els.statsModeText.textContent =
      STATS_MODE === "competitive"
        ? "Stats/Data will be stored for this game."
        : "Stats/Data won't be stored for this game.";
  });
});

els.keypad.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.key) {
    const nextValue = `${els.input.value}${button.dataset.key}`;
    const cleanedValue = String(Number(nextValue));

    if (Number(cleanedValue) <= MAX_VISIT) {
      els.input.value = cleanedValue;
    }
  }

  if (button.dataset.action === "clear") {
    els.input.value = els.input.value.slice(0, -1);
  }

  if (button.dataset.action === "undo") {
    undoLastVisit();
    return;
  }

  els.input.blur();
});

if (els.newGame) {
  els.newGame.addEventListener("click", newGame);
}

let wakeLock = null;

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (err) {
    console.warn("Wake lock failed:", err);
  }
}

async function releaseWakeLock() {
  try {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (err) {
    console.warn("Wake lock release failed:", err);
  }
}

document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "visible" &&
    document.body.classList.contains("scorer-fullscreen")
  ) {
    requestWakeLock();
  }
});

function enterScorerFullscreen() {
  document.body.classList.add("scorer-fullscreen");

  if (els.fullscreenBtn) {
    els.fullscreenBtn.textContent = "✕";
  }

  els.input.blur();
  requestWakeLock();
}

function exitScorerFullscreen() {
  document.body.classList.remove("scorer-fullscreen");

  if (els.fullscreenBtn) {
    els.fullscreenBtn.textContent = "⛶";
  }

  releaseWakeLock();
}

function toggleScorerFullscreen() {
  if (document.body.classList.contains("scorer-fullscreen")) {
    exitScorerFullscreen();
  } else {
    enterScorerFullscreen();
  }
}

els.fullscreenBtn?.addEventListener("click", toggleScorerFullscreen);

async function initDartScorerAuth() {
  els.setupCard.classList.remove("hidden");

  let user = null;

  if (window.ONMSession?.init) {
    user = await window.ONMSession.init();
  } else {
    const savedUser = localStorage.getItem("onmUser");
    user = savedUser ? JSON.parse(savedUser) : null;
  }

  if (!user) return;

  await loadLoggedInPlayer(user);
}

async function loadLoggedInPlayer(user) {
  const displayName = user.linkedPlayerName || user.firstName || "Player 1";

  els.setupCard.classList.remove("hidden");

  els.setupPlayerOneName.value = displayName;
  els.setupPlayerOneDisplay.textContent = displayName;

  let imageUrl = "graphics/logoWoText.png";

  try {
    if (user.linkedPlayerName && window.PlayerData?.fetchPlayerPhotosFromDrive) {
      const photos = await window.PlayerData.fetchPlayerPhotosFromDrive();
      const key = window.PlayerData.photoKey(user.linkedPlayerName);
      imageUrl = photos[key] || imageUrl;
    }
  } catch (err) {
    console.warn("Could not load player photo", err);
  }

  els.setupPlayerOneImage.src = imageUrl;
}

initDartScorerAuth();

render();

setTogglePosition(
  els.startScoreSwitch,
  document.querySelector("#startScoreSwitch .toggleBtn.active")
);

setTogglePosition(
  els.inModeSwitch,
  document.querySelector("#inModeSwitch .toggleBtn.active")
);

setTogglePosition(
  els.bestFirstToggle,
  document.querySelector("#bestFirstToggle .toggleBtn.active")
);

setTogglePosition(
  els.matchModeSwitch,
  document.querySelector("#matchModeSwitch .toggleBtn.active")
);

setTogglePosition(
  els.statsModeSwitch,
  document.querySelector("#statsModeSwitch .toggleBtn.active")
);