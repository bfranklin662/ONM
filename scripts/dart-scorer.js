const MAX_VISIT = 180;
let STARTING_SCORE = 501;
let LEGS_TO_WIN = 2;
let GAME_TYPE = "bestOf";
let IN_MODE = "straight";
let CUSTOM_START_SCORE = 901;
let MATCH_MODE = "local";
let STATS_MODE = "casual";
window.STATS_MODE = STATS_MODE;

const PAGE_MODE = new URLSearchParams(window.location.search).get("mode") || "league";

document.body.classList.toggle("casualMode", PAGE_MODE === "casual");
document.body.classList.toggle("leagueMode", PAGE_MODE !== "casual");


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
      currentLegDarts: 0,
      firstNineScored: 0,
      firstNineDarts: 0,
      currentLegFirstNineScored: 0,
      currentLegFirstNineDarts: 0
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
      currentLegDarts: 0,
      firstNineScored: 0,
      firstNineDarts: 0,
      currentLegFirstNineScored: 0,
      currentLegFirstNineDarts: 0
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
let loggedInUser = null;

let onlineInviteAccepted = false;
let onlineInviteId = null;
let onlineRole = null; // "host" or "guest"
let onlineMatchId = null;
let lobbyCountdownInterval = null;
let lobbyCountdownEndsAt = null;
let lastOnlineStatus = null;
let onlineDeciderOpened = false;
let onlineCoinStarted = false;
let onlineBullSubmitted = false;
let onlineResultSaved = false;
let competitiveLobbyMode = false;
let competitiveLegsCount = 3;
let molVictoryShownForMatchId = null;
let rematchStarting = false;

let gameOnAnnouncedForMatchId = null;

const ONLINE_SESSION_KEY = "onmActiveDartMatch";

function saveOnlineSession() {
  if (!onlineMatchId || !onlineRole) return;

  localStorage.setItem(ONLINE_SESSION_KEY, JSON.stringify({
    matchId: onlineMatchId,
    role: onlineRole,
    inviteId: onlineInviteId,
    savedAt: Date.now()
  }));
}

function clearOnlineSession() {
  localStorage.removeItem(ONLINE_SESSION_KEY);
}

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
  guestPlayerOneName: document.getElementById("guestPlayerOneName"),
  guestPlayerTwoName: document.getElementById("guestPlayerTwoName"),
  guestPlayersSetup: document.getElementById("namePlayersSetup"),
  guestPlayerOneName: document.getElementById("guestPlayerOneName"),
  guestPlayerTwoName: document.getElementById("guestPlayerTwoName"),
  playerTwoNameField: document.getElementById("playerTwoNameField"),
  inviteOpponentSetupBtn: document.getElementById("inviteOpponentSetupBtn"),
  startDeciderScreen: document.getElementById("startDeciderScreen"),
  deciderQuitBtn: document.getElementById("deciderQuitBtn"),
  deciderChoiceView: document.getElementById("deciderChoiceView"),
  chooseBullBtn: document.getElementById("chooseBullBtn"),
  chooseCoinBtn: document.getElementById("chooseCoinBtn"),
  skipDeciderBtn: document.getElementById("skipDeciderBtn"),
  bullDeciderView: document.getElementById("bullDeciderView"),
  bullDeciderPrompt: document.getElementById("bullDeciderPrompt"),
  bullBoard: document.getElementById("bullBoard"),
  coinDeciderView: document.getElementById("coinDeciderView"),
  coinResultText: document.getElementById("coinResultText"),
  coinBtn: document.getElementById("coinBtn"),
  startDeciderBtn: document.getElementById("startDeciderBtn"),
  bullPlayerOneBox: document.getElementById("bullPlayerOneBox"),
  bullPlayerTwoBox: document.getElementById("bullPlayerTwoBox"),
  bullPlayerOneName: document.getElementById("bullPlayerOneName"),
  bullPlayerTwoName: document.getElementById("bullPlayerTwoName"),
  bullPlayerOneStatus: document.getElementById("bullPlayerOneStatus"),
  bullPlayerTwoStatus: document.getElementById("bullPlayerTwoStatus"),
  bullWinnerText: document.getElementById("bullWinnerText"),
  coinPlayerOneBox: document.getElementById("coinPlayerOneBox"),
  coinPlayerTwoBox: document.getElementById("coinPlayerTwoBox"),
  coinPlayerOneName: document.getElementById("coinPlayerOneName"),
  coinPlayerTwoName: document.getElementById("coinPlayerTwoName"),
  coinPlayerOneStatus: document.getElementById("coinPlayerOneStatus"),
  coinPlayerTwoStatus: document.getElementById("coinPlayerTwoStatus"),
  coinWinnerText: document.getElementById("coinWinnerText"),
  confirmBullThrowBtn: document.getElementById("confirmBullThrowBtn"),
  loginRequiredSetup: document.getElementById("loginRequiredSetup"),
  setupPlayerErrorMsg: document.getElementById("setupPlayerErrorMsg"),
  dartInviteOverlay: document.getElementById("dartInviteOverlay"),
  dartInviteText: document.getElementById("dartInviteText"),
  acceptDartInviteBtn: document.getElementById("acceptDartInviteBtn"),
  declineDartInviteBtn: document.getElementById("declineDartInviteBtn"),
  waitingInviteOverlay: document.getElementById("waitingInviteOverlay"),
  waitingInviteText: document.getElementById("waitingInviteText"),
  refreshPlayersBtn: document.getElementById("refreshPlayersBtn"),
  onlineTurnOverlay: document.getElementById("onlineTurnOverlay"),
  setupPlayerOneSide: document.getElementById("setupPlayerOneSide"),
  setupPlayerTwoSide: document.getElementById("setupPlayerTwoSide"),
  setupPlayerOneSlot: document.getElementById("setupPlayerOneSlot"),
  setupPlayerTwoSlot: document.getElementById("setupPlayerTwoSlot"),
  removeSetupPlayerOneBtn: document.getElementById("removeSetupPlayerOneBtn"),
  removeSetupPlayerTwoBtn: document.getElementById("removeSetupPlayerTwoBtn"),
  playTabBtn: document.getElementById("playTabBtn"),
  leaderboardTabBtn: document.getElementById("leaderboardTabBtn"),
  leaderboardPanel: document.getElementById("leaderboardPanel"),
  leaderboardRows: document.getElementById("leaderboardRows"),
  refreshLeaderboardBtn: document.getElementById("refreshLeaderboardBtn"),
  competitiveReadyOverlay: document.getElementById("competitiveReadyOverlay"),
  cancelReadyLobbyBtn: document.getElementById("cancelReadyLobbyBtn"),
  leaveReadyLobbyBtn: document.getElementById("leaveReadyLobbyBtn"),
  markReadyBtn: document.getElementById("markReadyBtn"),
  readyMatchTitle: document.getElementById("readyMatchTitle"),
  readyHostFlag: document.getElementById("readyHostFlag"),
  readyGuestFlag: document.getElementById("readyGuestFlag"),
  readyHostPhoto: document.getElementById("readyHostPhoto"),
  readyGuestPhoto: document.getElementById("readyGuestPhoto"),
  readyHostName: document.getElementById("readyHostName"),
  readyGuestName: document.getElementById("readyGuestName"),
  readyHostRank: document.getElementById("readyHostRank"),
  readyGuestRank: document.getElementById("readyGuestRank"),
  readyHostRating: document.getElementById("readyHostRating"),
  readyGuestRating: document.getElementById("readyGuestRating"),
  readyHostStatus: document.getElementById("readyHostStatus"),
  readyGuestStatus: document.getElementById("readyGuestStatus"),
  molVictoryOverlay: document.getElementById("molVictoryOverlay"),
  molVictoryTitle: document.getElementById("molVictoryTitle"),
  molVictoryStatsRows: document.getElementById("molVictoryStatsRows"),
  molVictoryCloseBtn: document.getElementById("molVictoryCloseBtn"),
  molVictoryPlayerOnePhoto: document.getElementById("molVictoryPlayerOnePhoto"),
  molVictoryPlayerTwoPhoto: document.getElementById("molVictoryPlayerTwoPhoto"),
  molVictoryPlayerOneName: document.getElementById("molVictoryPlayerOneName"),
  molVictoryPlayerTwoName: document.getElementById("molVictoryPlayerTwoName"),
  molVictoryPlayerOneLegs: document.getElementById("molVictoryPlayerOneLegs"),
  molVictoryPlayerTwoLegs: document.getElementById("molVictoryPlayerTwoLegs"),
  molVictoryPlayerOneRank: document.getElementById("molVictoryPlayerOneRank"),
  molVictoryPlayerTwoRank: document.getElementById("molVictoryPlayerTwoRank"),
  molVictoryPlayerOneRating: document.getElementById("molVictoryPlayerOneRating"),
  molVictoryPlayerTwoRating: document.getElementById("molVictoryPlayerTwoRating"),
  molVictoryMiddleScore: document.getElementById("molVictoryMiddleScore"),
  molStatsTrack: document.getElementById("molStatsTrack"),
  molStatsPageOne: document.getElementById("molStatsPageOne"),
  molStatsPageTwo: document.getElementById("molStatsPageTwo"),
  molVictoryPlayerOneFlag: document.getElementById("molVictoryPlayerOneFlag"),
  molVictoryPlayerTwoFlag: document.getElementById("molVictoryPlayerTwoFlag"),
  molVictoryPlayerOneWon: document.getElementById("molVictoryPlayerOneWon"),
  molVictoryPlayerTwoWon: document.getElementById("molVictoryPlayerTwoWon"),
  molVictoryRematchBtn: document.getElementById("molVictoryRematchBtn"),
  molVictoryPlayerOneRematch: document.getElementById("molVictoryPlayerOneRematch"),
  molVictoryPlayerTwoRematch: document.getElementById("molVictoryPlayerTwoRematch"),
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

let dartAudioQueue = [];
let dartAudioPlaying = false;
let dartActiveAudios = [];
let lastOnlineCalloutAt = null;
let lastOnlineCalloutId = null;
const dartAudioPageLoadedAt = Date.now();

let dartAudioUnlocked = false;
let dartAudioPlayer = null;
let dartAudioPlayerB = null;
let dartUsePlayerB = false;
let dartSfxPlayer = null;
let dartAudioUnlocker = null;
let dartAudioTimers = [];
let dartOneShotAudios = [];

let dartAudioSuppressedUntil = 0;

function isDartAudioSuppressed() {
  return Date.now() < dartAudioSuppressedUntil;
}

function createDartAudioElement() {
  const audio = document.createElement("audio");
  audio.preload = "auto";
  audio.playsInline = true;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("x-webkit-airplay", "deny");
  audio.disableRemotePlayback = true;
  audio.controls = false;
  audio.removeAttribute("controls");
  audio.style.display = "none";
  document.body.appendChild(audio);
  return audio;
}

function primeNotificationAudio() {
  if (!dartSfxPlayer) dartSfxPlayer = createDartAudioElement();

  dartSfxPlayer.src = "audio/darts/notification.mp3";
  dartSfxPlayer.volume = 0.01;

  dartSfxPlayer.play()
    .then(() => {
      dartSfxPlayer.pause();
      dartSfxPlayer.currentTime = 0;
      dartSfxPlayer.volume = 1;
    })
    .catch(err => {
      console.warn("Could not prime notification audio:", err);
    });
}

function unlockDartAudio() {
  if (!dartAudioPlayer) {
    dartAudioPlayer = createDartAudioElement();
  }

  if (!dartSfxPlayer) {
    dartSfxPlayer = createDartAudioElement();
  }

  if (!dartAudioUnlocker) {
    dartAudioUnlocker = createDartAudioElement();
  }

  if (dartAudioUnlocked) return;

  dartAudioUnlocker.src = "audio/darts/silence.mp3";
  dartAudioUnlocker.volume = 0.01;

  dartAudioUnlocker.play()
    .then(() => {
      dartAudioUnlocker.pause();
      dartAudioUnlocker.currentTime = 0;

      dartAudioUnlocked = true;

      console.log("Dart audio unlocked");

      primeNotificationAudio();
    })
    .catch(err => {
      console.warn("Could not unlock dart audio:", err);
    });
}

function announceVisitAndRequire(visitScore, requiredScore) {
  announceDartVisit(visitScore);
  announceRequiredScore(requiredScore);
}

function clearDartAudioQueue() {
  dartAudioTimers.forEach(clearTimeout);
  dartAudioTimers = [];

  dartAudioQueue = [];
  dartAudioPlaying = false;

  [
    dartAudioPlayer,
    dartAudioPlayerB,
    dartSfxPlayer,
    dartAudioUnlocker,
    ...dartOneShotAudios
  ].forEach(audio => {
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (err) { }
  });
}

function fullyStopDartAudio() {
  dartAudioSuppressedUntil = Date.now() + 5000;
  clearDartAudioQueue();

  [
    dartAudioPlayer,
    dartAudioPlayerB,
    dartSfxPlayer,
    dartAudioUnlocker,
    ...dartOneShotAudios
  ].forEach(audio => {
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.src = "";
      audio.load();
    } catch (err) { }
  });

  dartOneShotAudios = [];
  dartAudioUnlocked = false;
}

function playDartCallout(fileName, fallbackFileName = null) {
  const credit = DART_VOICE_CREDITS[fileName];
  if (credit) showDartVoiceToast(credit);

  dartAudioQueue.push({
    src: `audio/darts/${fileName}`,
    fallbackSrc: fallbackFileName ? `audio/darts/${fallbackFileName}` : null
  });

  playNextDartCallout();
}

function playLayeredDartAudio(fileName, volume = 1) {
  unlockDartAudio();

  if (isDartAudioSuppressed()) return;

  const audio = new Audio(`audio/darts/${fileName}`);
  audio.preload = "auto";
  audio.playsInline = true;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("x-webkit-airplay", "deny");
  audio.disableRemotePlayback = true;
  audio.controls = false;
  audio.removeAttribute("controls");
  audio.volume = volume;

  dartOneShotAudios.push(audio);

  audio.onended = () => {
    dartOneShotAudios = dartOneShotAudios.filter(item => item !== audio);
  };

  audio.play().catch(err => {
    dartOneShotAudios = dartOneShotAudios.filter(item => item !== audio);
    console.warn("Could not play layered audio:", fileName, err);
  });

  return audio;
}

function playInstantDartSfx(fileName, volume = 1) {
  unlockDartAudio();

  if (!dartSfxPlayer) dartSfxPlayer = createDartAudioElement();

  dartSfxPlayer.pause();
  dartSfxPlayer.currentTime = 0;
  dartSfxPlayer.src = `audio/darts/${fileName}`;
  dartSfxPlayer.volume = volume;

  dartSfxPlayer.play().catch(err => {
    console.warn("Could not play instant dart sfx:", fileName, err);
  });

  return dartSfxPlayer;
}

const DART_VOICE_CREDITS = {
  "score-0.mp3": "Nick 🔊",
  "score-1.mp3": "Simon 🔊",
  "score-2.mp3": "Nick 🔊",
  "score-3.mp3": "Jack 🔊",
  "score-4.mp3": "Nick 🔊",
  "score-5.mp3": "Nick 🔊",
  "score-6.mp3": "Nick 🔊",
  "score-7.mp3": "Nick 🔊",
  "score-8.mp3": "Nick 🔊",
  "score-9.mp3": "Andy 🔊",
  "score-10.mp3": "Nick 🔊",
  "score-11.mp3": "Nick 🔊",
  "score-12.mp3": "Nick 🔊",
  "score-13.mp3": "Nick 🔊",
  "score-14.mp3": "Nick 🔊",
  "score-15.mp3": "Nick 🔊",
  "score-16.mp3": "Nick 🔊",
  "score-17.mp3": "Nick 🔊",
  "score-18.mp3": "Nick 🔊",
  "score-19.mp3": "Nick 🔊",
  "score-20.mp3": "Nick 🔊",
  "score-21.mp3": "Nick 🔊",
  "score-22.mp3": "Nick 🔊",
  "score-23.mp3": "Nick 🔊",
  "score-24.mp3": "Nick 🔊",
  "score-25.mp3": "Nick 🔊",
  "score-26.mp3": "Bobby 🔊",
  "score-27.mp3": "Nick 🔊",
  "score-28.mp3": "Nick 🔊",
  "score-29.mp3": "Nick 🔊",
  "score-30.mp3": "Nick 🔊",
  "score-31.mp3": "Nick 🔊",
  "score-32.mp3": "Nick 🔊",
  "score-33.mp3": "Nick 🔊",
  "score-34.mp3": "Nick 🔊",
  "score-35.mp3": "Nick 🔊",
  "score-36.mp3": "Nick 🔊",
  "score-37.mp3": "Nick 🔊",
  "score-38.mp3": "Nick 🔊",
  "score-39.mp3": "Nick 🔊",
  "score-40.mp3": "Nick 🔊",
  "score-41.mp3": "Nick 🔊",
  "score-42.mp3": "Nick 🔊",
  "score-43.mp3": "Nick 🔊",
  "score-44.mp3": "Nick 🔊",
  "score-45.mp3": "Ricky 🔊",
  "score-46.mp3": "Nick 🔊",
  "score-47.mp3": "Nick 🔊",
  "score-48.mp3": "Nick 🔊",
  "score-49.mp3": "Nick 🔊",
  "score-50.mp3": "Nick 🔊",
  "score-51.mp3": "Nick 🔊",
  "score-52.mp3": "Nick 🔊",
  "score-53.mp3": "Nick 🔊",
  "score-54.mp3": "Nick 🔊",
  "score-55.mp3": "Nick 🔊",
  "score-56.mp3": "Nick 🔊",
  "score-57.mp3": "Nick 🔊",
  "score-58.mp3": "Nick 🔊",
  "score-59.mp3": "Nick 🔊",
  "score-60.mp3": "Nick 🔊",
  "score-61.mp3": "Nick 🔊",
  "score-62.mp3": "Nick 🔊",
  "score-63.mp3": "Nick 🔊",
  "score-64.mp3": "Nick 🔊",
  "score-65.mp3": "Nick 🔊",
  "score-66.mp3": "Remzi 🔊",
  "score-67.mp3": "Nick 🔊",
  "score-68.mp3": "Nick 🔊",
  "score-69.mp3": "Luke 🔊",
  "score-70.mp3": "Nick 🔊",
  "score-71.mp3": "Nick 🔊",
  "score-72.mp3": "Nick 🔊",
  "score-73.mp3": "Nick 🔊",
  "score-74.mp3": "Nick 🔊",
  "score-75.mp3": "Nick 🔊",
  "score-76.mp3": "Nick 🔊",
  "score-77.mp3": "Nick 🔊",
  "score-78.mp3": "Nick 🔊",
  "score-79.mp3": "Nick 🔊",
  "score-80.mp3": "Nick 🔊",
  "score-81.mp3": "Nick 🔊",
  "score-82.mp3": "Nick 🔊",
  "score-83.mp3": "Nick 🔊",
  "score-84.mp3": "Nick 🔊",
  "score-85.mp3": "Nick 🔊",
  "score-86.mp3": "Nick 🔊",
  "score-87.mp3": "Nick 🔊",
  "score-88.mp3": "Nick 🔊",
  "score-89.mp3": "Nick 🔊",
  "score-90.mp3": "Nick 🔊",
  "score-91.mp3": "Nick 🔊",
  "score-92.mp3": "Nick 🔊",
  "score-93.mp3": "Nick 🔊",
  "score-94.mp3": "Nick 🔊",
  "score-95.mp3": "Dan 🔊",
  "score-96.mp3": "Nick 🔊",
  "score-97.mp3": "Nick 🔊",
  "score-98.mp3": "Nick 🔊",
  "score-99.mp3": "Maryna 🔊",
  "score-100.mp3": "Nick 🔊",
  "score-101.mp3": "Nick 🔊",
  "score-102.mp3": "Nick 🔊",
  "score-103.mp3": "Nick 🔊",
  "score-104.mp3": "Nick 🔊",
  "score-105.mp3": "Nick 🔊",
  "score-106.mp3": "Nick 🔊",
  "score-107.mp3": "Nick 🔊",
  "score-108.mp3": "Nick 🔊",
  "score-109.mp3": "Nick 🔊",
  "score-110.mp3": "Nick 🔊",
  "score-111.mp3": "Nick 🔊",
  "score-112.mp3": "Nick 🔊",
  "score-113.mp3": "Nick 🔊",
  "score-114.mp3": "Nick 🔊",
  "score-115.mp3": "Nick 🔊",
  "score-116.mp3": "Nick 🔊",
  "score-117.mp3": "Nick 🔊",
  "score-118.mp3": "Nick 🔊",
  "score-119.mp3": "Nick 🔊",
  "score-120.mp3": "Nick 🔊",
  "score-121.mp3": "Nick 🔊",
  "score-122.mp3": "Nick 🔊",
  "score-123.mp3": "Nick 🔊",
  "score-124.mp3": "Nick 🔊",
  "score-125.mp3": "Nick 🔊",
  "score-126.mp3": "Nick 🔊",
  "score-127.mp3": "Nick 🔊",
  "score-128.mp3": "Nick 🔊",
  "score-129.mp3": "Nick 🔊",
  "score-130.mp3": "Nick 🔊",
  "score-131.mp3": "Nick 🔊",
  "score-132.mp3": "Nick 🔊",
  "score-133.mp3": "Nick 🔊",
  "score-134.mp3": "Nick 🔊",
  "score-135.mp3": "Nick 🔊",
  "score-136.mp3": "Nick 🔊",
  "score-137.mp3": "Nick 🔊",
  "score-138.mp3": "Nick 🔊",
  "score-139.mp3": "Nick 🔊",
  "score-140.mp3": "Nick 🔊",
  "score-141.mp3": "Nick 🔊",
  "score-142.mp3": "Nick 🔊",
  "score-143.mp3": "Nick 🔊",
  "score-144.mp3": "Nick 🔊",
  "score-145.mp3": "Nick 🔊",
  "score-146.mp3": "Nick 🔊",
  "score-147.mp3": "Nick 🔊",
  "score-148.mp3": "Nick 🔊",
  "score-149.mp3": "Nick 🔊",
  "score-150.mp3": "Nick 🔊",
  "score-151.mp3": "Nick 🔊",
  "score-152.mp3": "Nick 🔊",
  "score-153.mp3": "Nick 🔊",
  "score-154.mp3": "Nick 🔊",
  "score-155.mp3": "Nick 🔊",
  "score-156.mp3": "Nick 🔊",
  "score-157.mp3": "Nick 🔊",
  "score-158.mp3": "Nick 🔊",
  "score-159.mp3": "Filip 🔊",
  "score-160.mp3": "Nick 🔊",
  "score-161.mp3": "Nick 🔊",
  "score-162.mp3": "Nick 🔊",
  "score-163.mp3": "Nick 🔊",
  "score-164.mp3": "Nick 🔊",
  "score-165.mp3": "Nick 🔊",
  "score-166.mp3": "Nick 🔊",
  "score-167.mp3": "Nick 🔊",
  "score-168.mp3": "Nick 🔊",
  "score-169.mp3": "Nick 🔊",
  "score-170.mp3": "Nick 🔊",
  "score-171.mp3": "Nick 🔊",
  "score-174.mp3": "Nick 🔊",
  "score-177.mp3": "Nick 🔊",
  "score-180.mp3": "Nick 🔊"
};

let dartVoiceToastTimer = null;

function showDartVoiceToast(label) {
  const toast = document.getElementById("dartVoiceToast");
  if (!toast || !label) return;

  clearTimeout(dartVoiceToastTimer);

  toast.textContent = label;
  toast.classList.remove("hidden");

  dartVoiceToastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 1000);
}




function playNextDartCallout() {
  if (dartAudioPlaying || !dartAudioQueue.length) return;
  if (isDartAudioSuppressed()) return;

  unlockDartAudio();

  if (!dartAudioPlayer) dartAudioPlayer = createDartAudioElement();

  dartAudioPlaying = true;

  const item = dartAudioQueue.shift();
  const src = item.src;
  const fallbackSrc = item.fallbackSrc;

  function playFallbackOrNext() {
    if (fallbackSrc) {
      dartAudioQueue.unshift({
        src: fallbackSrc,
        fallbackSrc: null
      });
    }

    dartAudioPlaying = false;
    playNextDartCallout();
  }

  dartAudioPlayer.pause();
  dartAudioPlayer.currentTime = 0;
  dartAudioPlayer.src = src;
  dartAudioPlayer.volume = 1;

  dartAudioPlayer.onended = () => {
    dartAudioPlayer.onended = null;
    dartAudioPlayer.onerror = null;
    dartAudioPlaying = false;
    playNextDartCallout();
  };

  dartAudioPlayer.onerror = () => {
    dartAudioPlayer.onended = null;
    dartAudioPlayer.onerror = null;
    console.warn("Could not load dart callout:", src);
    playFallbackOrNext();
  };

  dartAudioPlayer.play().catch(err => {
    dartAudioPlayer.onended = null;
    dartAudioPlayer.onerror = null;
    console.warn("Could not play dart callout:", src, err);
    playFallbackOrNext();
  });
}


function announceDartVisit(visitScore) {
  const score = Number(visitScore);
  if (!Number.isInteger(score) || score < 0 || score > 180) return;

  playDartCallout(`score-${score}.mp3`);
}

function announceRequiredScore(requiredScore) {
  const required = Number(requiredScore);

  if (
    Number.isInteger(required) &&
    required > 1 &&
    required <= 170 &&
    POSSIBLE_CHECKOUTS.has(required)
  ) {
    console.log("[AUDIO DEBUG] Queueing you-require and score", required);
    playDartCallout("you-require.mp3");
    playDartCallout(`score-${required}-short.mp3`, `score-${required}.mp3`);
  }
}


function announceLegWon(isMatchShot = false, isBullOut = false) {
  clearDartAudioQueue();
  playDartCallout(isMatchShot ? "match-shot.mp3" : "game-shot.mp3");

  if (isBullOut) {
    playDartCallout("bull-out.mp3");
  }
}

function announceGameOn() {
  playDartCallout("game-on.mp3");
}

function announceBullOut() {
  playDartCallout("bull-out.mp3");
}

function announceMatchResultForMe(winnerKey) {
  const myKey = getCurrentPlayerKey();

  if (!winnerKey || !myKey) return;

  playDartCallout(winnerKey === myKey ? "victory.mp3" : "defeat.mp3");
}

function shouldPlayFinishHim(player) {
  return (
    player &&
    Number(player.score) === 2 &&
    Number(player.checkoutAttempts || 0) >= 3 &&
    !player.finishHimPlayed
  );
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

function buildMatchStatsData() {
  const match = window.currentOnlineMatch || {};
  const keys = onlinePlayerKeys(match);
  const p1Key = keys[0];
  const p2Key = keys[1];

  const firebaseP1 = match.game?.players?.[p1Key] || {};
  const firebaseP2 = match.game?.players?.[p2Key] || {};

  function playerStatsFromFirebase(player) {
    return getPlayerStats({
      score: Number(player.score || STARTING_SCORE),
      legs: Number(player.legs || 0),
      totalScored: Number(player.totalScored || 0),
      dartsThrown: Number(player.dartsThrown || 0),
      lastScore: player.lastScore ?? null,
      checkoutHits: Number(player.checkoutHits || 0),
      checkoutAttempts: Number(player.checkoutAttempts || 0),
      highestOut: Number(player.highestOut || 0),
      highScore: Number(player.highScore || 0),
      oneEightys: Number(player.oneEightys || 0),
      bullOuts: Number(player.bullOuts || 0),
      legDarts: player.legDarts || [],
      currentLegDarts: Number(player.currentLegDarts || 0),
      firstNineScored: Number(player.firstNineScored || 0),
      firstNineDarts: Number(player.firstNineDarts || 0),
      currentLegFirstNineScored: Number(player.currentLegFirstNineScored || 0),
      currentLegFirstNineDarts: Number(player.currentLegFirstNineDarts || 0)
    });
  }

  const p1Stats = playerStatsFromFirebase(firebaseP1);
  const p2Stats = playerStatsFromFirebase(firebaseP2);

  function buildPlayerData(index, key, name, nationality, photo, firebasePlayer) {
    const isWinner = match.ratingChange?.winnerKey === key;
    const isLoser = match.ratingChange?.loserKey === key;

    const oldRating = isWinner
      ? Number(match.ratingChange?.winnerOldRating || 1000)
      : isLoser
        ? Number(match.ratingChange?.loserOldRating || 1000)
        : Number(getReadyPlayerRating(key)?.rating || 1000);

    const newRating = isWinner
      ? Number(match.ratingChange?.winnerNewRating || oldRating)
      : isLoser
        ? Number(match.ratingChange?.loserNewRating || oldRating)
        : oldRating;

    const ratingMove = formatMovement(oldRating, newRating);
    const rankData = getProjectedRankData(key, newRating);

    return {
      key,
      name,
      nationality,
      photo,
      legs: Number(firebasePlayer.legs || 0),
      stats: index === 0 ? p1Stats : p2Stats,
      isWinner,
      oldRating,
      newRating,
      ratingMove,
      oldRank: rankData.oldRank,
      newRank: rankData.newRank,
      rankMove: rankData.rankMove
    };
  }

  return {
    players: [
      buildPlayerData(
        0,
        p1Key,
        match.hostName || firebaseP1.name || playerName(0),
        match.hostNationality || "",
        match.hostPhoto || "graphics/logoWoText.png",
        firebaseP1
      ),
      buildPlayerData(
        1,
        p2Key,
        match.guestName || firebaseP2.name || playerName(1),
        match.guestNationality || "",
        match.guestPhoto || "graphics/logoWoText.png",
        firebaseP2
      )
    ]
  };
}

function buildStatsRowsHtml(rows) {
  return rows.map(([label, left, right]) => `
    <div class="statRow">
      <div class="statValue">${left}</div>
      <div class="statLabelWrap">
        <div class="statLabel">${label}</div>
      </div>
      <div class="statValue">${right}</div>
    </div>
  `).join("");
}

function populateMolVictoryStats(matchData) {
  const p1 = matchData.players[0].stats;
  const p2 = matchData.players[1].stats;

  const rows = [
    ["3-dart avg.", p1.average, p2.average],
    ["First 9 avg.", p1.firstNineAvg, p2.firstNineAvg],
    ["Checkouts", p1.checkouts, p2.checkouts],
    ["Checkout rate", p1.checkoutRate, p2.checkoutRate],
    ["Highest out", p1.highestOut, p2.highestOut],
    ["High score", p1.highScore, p2.highScore],
    ["Best leg", p1.bestLeg, p2.bestLeg],
    ["Worst leg", p1.worstLeg, p2.worstLeg],
    ["180s", p1.oneEightys, p2.oneEightys],
    ["Bull-outs", p1.bullOuts, p2.bullOuts]
  ];

  els.molStatsPageOne.innerHTML = buildStatsRowsHtml(rows.slice(0, 5));
  els.molStatsPageTwo.innerHTML = buildStatsRowsHtml(rows.slice(5));
  setMolStatsPage(0);
}

function getOnlineMatchId() {
  return onlineMatchId || window.currentOnlineMatch?.matchId || "";
}

async function updateMolResultPresence(status) {
  const matchId = getOnlineMatchId();
  const myKey = getCurrentPlayerKey();

  if (!matchId || !myKey || !window.ONMLiveDarts) return;

  const { db, ref, update } = window.ONMLiveDarts;

  await update(ref(db, `onlineMatches/${matchId}`), {
    [`resultPresence/${myKey}`]: status,
    [`resultPresenceUpdatedAt/${myKey}`]: Date.now()
  });
}

function applyMolRematchState(match) {
  const rematch = match.rematch || {};
  const presence = match.resultPresence || {};

  const hostRematch = Boolean(rematch[match.hostPlayerKey]);
  const guestRematch = Boolean(rematch[match.guestPlayerKey]);

  const hostLeft = presence[match.hostPlayerKey] === "left";
  const guestLeft = presence[match.guestPlayerKey] === "left";

  const myKey = getCurrentPlayerKey();
  const opponentKey =
    myKey === match.hostPlayerKey
      ? match.guestPlayerKey
      : match.hostPlayerKey;

  const amRematching = Boolean(rematch[myKey]);
  const opponentRematching = Boolean(rematch[opponentKey]);
  const opponentLeft = presence[opponentKey] === "left";

  els.molVictoryPlayerOneRematch.textContent = hostLeft
    ? "Declined"
    : hostRematch
      ? "Rematch ✓"
      : "Rematch";

  els.molVictoryPlayerTwoRematch.textContent = guestLeft
    ? "Declined"
    : guestRematch
      ? "Rematch ✓"
      : "Rematch";

  els.molVictoryPlayerOneRematch.classList.toggle("ready", hostRematch && !hostLeft);
  els.molVictoryPlayerTwoRematch.classList.toggle("ready", guestRematch && !guestLeft);

  els.molVictoryPlayerOneRematch.classList.toggle("pending", !hostRematch && !hostLeft);
  els.molVictoryPlayerTwoRematch.classList.toggle("pending", !guestRematch && !guestLeft);

  els.molVictoryPlayerOneRematch.classList.toggle("declined", hostLeft);
  els.molVictoryPlayerTwoRematch.classList.toggle("declined", guestLeft);

  if (opponentLeft) {
    els.molVictoryRematchBtn.textContent = "Opponent declined";
    els.molVictoryRematchBtn.disabled = true;
    els.molVictoryRematchBtn.classList.remove("active");

    els.molVictoryCloseBtn.disabled = false;
    return;
  }

  els.molVictoryRematchBtn.textContent = amRematching
    ? "Waiting for opponent..."
    : "Rematch";

  els.molVictoryRematchBtn.classList.toggle("active", amRematching);
  els.molVictoryRematchBtn.disabled = opponentLeft;

  // Once you click rematch, you cannot continue unless you untick it.
  els.molVictoryCloseBtn.disabled = amRematching;
}

function openMolVictoryScreen(matchData) {

  els.scorerCard?.classList.add("hidden");

  els.molVictoryOverlay?.classList.remove("hidden");

  const p1 = matchData.players[0];
  const p2 = matchData.players[1];

  els.molVictoryPlayerOnePhoto.closest(".molVictoryPlayerCard")
    ?.classList.toggle("winner", p1.isWinner);

  els.molVictoryPlayerTwoPhoto.closest(".molVictoryPlayerCard")
    ?.classList.toggle("winner", p2.isWinner);

  els.molVictoryPlayerOnePhoto.src = p1.photo;
  els.molVictoryPlayerTwoPhoto.src = p2.photo;

  els.molVictoryPlayerOneRank.innerHTML = `
    Rank ${p1.newRank}
    <span class="${p1.rankMove.className}">${p1.rankMove.text}</span>
  `;

  els.molVictoryPlayerTwoRank.innerHTML = `
    Rank ${p2.newRank}
    <span class="${p2.rankMove.className}">${p2.rankMove.text}</span>
  `;

  els.molVictoryPlayerOneRating.innerHTML = `
    Rating ${p1.newRating}
    <span class="${p1.ratingMove.className}">${p1.ratingMove.text}</span>
  `;

  els.molVictoryPlayerTwoRating.innerHTML = `
    Rating ${p2.newRating}
    <span class="${p2.ratingMove.className}">${p2.ratingMove.text}</span>
  `;

  els.molVictoryPlayerOneName.textContent =
    `${p1.name} ${countryToFlag(p1.nationality)}`;

  els.molVictoryPlayerTwoName.textContent =
    `${p2.name} ${countryToFlag(p2.nationality)}`;

  els.molVictoryMiddleScore.textContent =
    `${p1.legs} - ${p2.legs}`;

  els.molVictoryTitle.textContent =
    `${STARTING_SCORE} · BO${Number(els.legsCount.textContent)}`;

  els.molVictoryPlayerOneWon.classList.toggle("hidden", !p1.isWinner);
  els.molVictoryPlayerTwoWon.classList.toggle("hidden", !p2.isWinner);

  populateMolVictoryStats(matchData);
  updateMolResultPresence("viewing");
}

function updateLeaguePlayButton() {
  const btn = document.getElementById("leaderboardPlayDockBtn");
  if (!btn) return;

  const currentUser =
    window.ONMSession?.getUser?.() || loggedInUser;

  btn.textContent = currentUser
    ? "Play match"
    : "Log in / Register";
}

function openCompetitiveInviteFlow() {

  const currentUser =
    window.ONMSession?.getUser?.() || loggedInUser;

  if (!currentUser) {
    window.location.href =
      "auth.html?mode=register&redirect=dart-scorer.html";
    return;
  }

  competitiveLobbyMode = true;
  competitiveLegsCount = 3;

  MATCH_MODE = "online";
  STATS_MODE = "competitive";
  window.STATS_MODE = STATS_MODE;

  document.getElementById("leaderboardTabBtn")?.classList.add("active");
  document.getElementById("playTabBtn")?.classList.remove("active");

  document.getElementById("leaderboardView")?.classList.remove("hidden");
  els.setupCard?.classList.add("hidden");
  els.scorerCard?.classList.add("hidden");
  els.startDeciderScreen?.classList.add("hidden");

  openOpponentModal();
}

async function isPlayerOnline(playerKey) {
  if (!playerKey || !window.ONMLiveDarts) return false;

  const { db, ref, get } = window.ONMLiveDarts;
  const snapshot = await get(ref(db, `presence/${playerKey}`));

  return snapshot.exists() && snapshot.val()?.online === true;
}

async function getPlayerPresence(playerKey) {
  if (!playerKey || !window.ONMLiveDarts) return null;

  const { db, ref, get } = window.ONMLiveDarts;
  const snapshot = await get(ref(db, `presence/${playerKey}`));

  if (!snapshot.exists()) return null;

  const presence = snapshot.val();

  if (presence?.status === "playing" && presence?.updatedAt) {
    const ageMs = Date.now() - Number(presence.updatedAt);

    if (ageMs > 5 * 60 * 1000) {
      return {
        ...presence,
        status: "online",
        online: true
      };
    }
  }

  return presence;
}

async function openOpponentModal() {
  els.opponentOverlay.classList.remove("hidden");
  els.opponentOverlay.setAttribute("aria-hidden", "false");

  els.linkedPlayersList.innerHTML = `
    <div class="molInvitePanel">
      <div class="molInviteHead">
        <img src="graphics/logoWoText.png" alt="">
        <div>
          <h2>Monsters Online League</h2>
          <span>Leaderboard match</span>
        </div>
      </div>

      <div class="molInviteSettings">
        <div class="molInviteLabel">Settings</div>
        <div class="molLegButtons">
          <button type="button" class="active" data-comp-legs="3">BO3</button>
          <button type="button" data-comp-legs="5">BO5</button>
          <button type="button" data-comp-legs="7">BO7</button>
        </div>
      </div>

      <div class="molInvitePlayersTop">
        <div>
          <div class="molInviteLabel">Players</div>
          <span>Invite an online player</span>
        </div>
        <button id="molRefreshPlayersBtn" type="button">Refresh</button>
      </div>

      <div id="molInvitePlayersList" class="molInvitePlayersList">
        <div class="loadingRow">
          <span class="inlineSpinner"></span>
          <span>Loading players...</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById("molRefreshPlayersBtn")?.addEventListener("click", openOpponentModal);

  els.linkedPlayersList.querySelectorAll("[data-comp-legs]").forEach(button => {
    button.addEventListener("click", () => {
      els.linkedPlayersList.querySelectorAll("[data-comp-legs]").forEach(btn => {
        btn.classList.remove("active");
      });

      button.classList.add("active");
      competitiveLegsCount = Number(button.dataset.compLegs);
    });
  });

  try {
    const result = await postDartMatch({ action: "getLinkedPlayers" });

    if (!result.success) {
      document.getElementById("molInvitePlayersList").innerHTML =
        `<div class="muted">Could not load linked players.</div>`;
      return;
    }

    const currentUser = window.ONMSession?.getUser?.() || loggedInUser;
    const currentPlayerKey = getCurrentPlayerKey();

    const allPlayers = result.players || [];
    const currentPlayerProfile =
      allPlayers.find(player => getPlayerKey(player) === currentPlayerKey) || {};

    const players = allPlayers.filter(player => {
      return getPlayerKey(player) !== currentPlayerKey;
    });

    if (!players.length) {
      document.getElementById("molInvitePlayersList").innerHTML =
        `<div class="muted">No other linked players found.</div>`;
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

    const playerRows = await Promise.all(players.map(async player => {
      const fullName = getLinkedPlayerFullName(player);

      const photoKey = window.PlayerData?.photoKey
        ? window.PlayerData.photoKey(fullName)
        : player.playerKey;

      const imageUrl =
        getPlayerPhotoField(player) ||
        drivePhotos[photoKey] ||
        "graphics/logoWoText.png";

      const presence = await getPlayerPresence(getPresenceKey(player));
      const status = presence?.status || (presence?.online ? "online" : "offline");

      const buttonText =
        status === "playing" ? "Playing" :
          status === "online" ? "Invite" :
            "Offline";

      const buttonClass =
        status === "playing" ? "playing" :
          status === "online" ? "online" :
            "offline";

      const canInvite = status === "online";

      return `
        <div class="molInvitePlayerRow">
          <img src="${imageUrl}" alt="${fullName}">
          <div class="molInvitePlayerInfo">
            <strong>${fullName}</strong>
            <span class="molPresenceText ${buttonClass}">
              ${status === "playing" ? "Currently playing" : status === "online" ? "Online now" : "Offline"}
            </span>
          </div>

          <button
            type="button"
            class="molInviteStatusBtn ${buttonClass}"
            data-player="${fullName}"
            ${canInvite ? "" : "disabled"}
          >
            ${buttonText}
          </button>
        </div>
      `;
    }));

    document.getElementById("molInvitePlayersList").innerHTML = playerRows.join("");

    document.querySelectorAll("#molInvitePlayersList [data-player]").forEach(button => {
      button.addEventListener("click", async () => {
        unlockDartAudio();
        const player = players.find(p => getLinkedPlayerFullName(p) === button.dataset.player);
        if (!player) return;

        button.disabled = true;
        button.textContent = "Inviting...";

        try {
          const currentUser = window.ONMSession?.getUser?.() || loggedInUser;

          const opponentFullName = getLinkedPlayerFullName(player);
          const hostFullName = getLoggedInFullName(currentUser);

          const opponentPhotoKey = window.PlayerData?.photoKey
            ? window.PlayerData.photoKey(opponentFullName)
            : "";

          const hostPhotoKey = window.PlayerData?.photoKey
            ? window.PlayerData.photoKey(hostFullName)
            : "";

          const opponentPhoto =
            getPlayerPhotoField(player) ||
            drivePhotos[opponentPhotoKey] ||
            "";

          const hostPhoto =
            getPlayerPhotoField(currentUser) ||
            getPlayerPhotoField(currentPlayerProfile) ||
            drivePhotos[hostPhotoKey] ||
            "";

          const inviteId = await window.ONMLiveDarts.createOnlineInvite({
            fromUser: {
              ...currentPlayerProfile,
              ...currentUser,
              linkedPlayerKey: getCurrentPlayerKey(),
              playerKey: getCurrentPlayerKey(),
              fullName: hostFullName,
              playerName: hostFullName,
              photo: hostPhoto,
              nationality: getPlayerNationality(currentPlayerProfile) || getPlayerNationality(currentUser)
            },
            toPlayer: {
              ...player,
              linkedPlayerKey: getPlayerKey(player),
              playerKey: getPlayerKey(player),
              playerName: opponentFullName,
              fullName: opponentFullName,
              photo: opponentPhoto,
              nationality: getPlayerNationality(player)
            },
            settings: {
              statsMode: "competitive",
              startScore: 501,
              gameType: "bestOf",
              legsCount: competitiveLegsCount,
              inMode: "straight",
              competitive: true,
              inviteText: `${hostFullName} has invited you to a competitive leaderboard BO${competitiveLegsCount} game.`
            }
          });

          els.setupPlayerTwoName.value = opponentFullName;
          showInviteWaiting(opponentFullName);
          listenForInviteResponse(inviteId, opponentFullName);

        } catch (err) {
          console.error("Could not create invite:", err);
          button.disabled = false;
          button.textContent = "Invite";
          showOnlineNotice("Could not send invite. Please try again.");
        }
      });
    });

  } catch (err) {
    console.warn("Could not load linked players", err);
    document.getElementById("molInvitePlayersList").innerHTML =
      `<div class="muted">Could not connect to players.</div>`;
  }
}

function safeFirebaseKey(value) {
  return String(value || "")
    .trim()
    .replace(/[.#$/[\]]/g, "_");
}

function getLeagueUserKey(user) {
  return (
    user?.linkedPlayerKey ||
    user?.playerKey ||
    user?.userId ||
    safeFirebaseKey(user?.email) ||
    ""
  );
}

function getPlayerKey(player) {
  return getLeagueUserKey(player);
}

function formatMovement(oldValue, newValue, inverse = false) {
  const diff = inverse
    ? oldValue - newValue
    : newValue - oldValue;

  if (diff === 0) {
    return {
      text: "",
      className: ""
    };
  }

  const up = diff > 0;

  return {
    text: `${up ? "↑" : "↓"}${Math.abs(diff)}`,
    className: up ? "rankUp" : "rankDown"
  };
}

function getProjectedRankData(playerKey, newRating) {
  const oldPlayers = window.currentLeaderboardPlayers || [];

  const oldRankIndex = oldPlayers.findIndex(p => p.playerKey === playerKey);
  const oldRank = oldRankIndex >= 0 ? oldRankIndex + 1 : "-";

  const projectedPlayers = oldPlayers.map(player => ({
    ...player,
    rating: player.playerKey === playerKey
      ? Number(newRating || player.rating || 1000)
      : Number(player.rating || 1000)
  })).sort((a, b) => Number(b.rating || 1000) - Number(a.rating || 1000));

  const newRankIndex = projectedPlayers.findIndex(p => p.playerKey === playerKey);
  const newRank = newRankIndex >= 0 ? newRankIndex + 1 : oldRank;

  const rankMove = typeof oldRank === "number" && typeof newRank === "number"
    ? formatMovement(oldRank, newRank, true)
    : { text: "", className: "" };

  return {
    oldRank,
    newRank,
    rankMove
  };
}

let molStatsPage = 0;

function setMolStatsPage(index) {
  molStatsPage = index;

  els.molStatsTrack.style.transform =
    `translateX(-${index * 50}%)`;

  document
    .querySelectorAll(".molStatsDot")
    .forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
}

function closeOpponentModal() {
  els.opponentOverlay.classList.add("hidden");
  els.opponentOverlay.setAttribute("aria-hidden", "true");
}

function showInviteWaiting(playerName) {
  els.linkedPlayersList.innerHTML = `
    <div class="inviteWaitingBox">
      <span class="inlineSpinner"></span>
      <strong>Waiting for ${playerName} to accept match invitation...</strong>
    </div>
  `;
}

function listenForInviteResponse(inviteId, playerName) {
  const { db, ref, onValue, update } = window.ONMLiveDarts;

  const timeoutId = setTimeout(async () => {
    await update(ref(db, `dartInvites/${inviteId}`), {
      status: "expired",
      expiredAt: Date.now()
    });
  }, 120000);

  const inviteRef = ref(db, `dartInvites/${inviteId}`);

  onValue(inviteRef, async snapshot => {
    if (!snapshot.exists()) return;

    const invite = snapshot.val();

    if (invite.status === "accepted") {
      clearTimeout(timeoutId);

      onlineInviteAccepted = true;
      onlineInviteId = inviteId;
      onlineMatchId = invite.matchId;
      onlineRole = "host";

      els.setupPlayerTwoName.value = playerName;

      saveOnlineSession();
      closeOpponentModal();

      if (invite.matchId) {
        listenToOnlineMatch(invite.matchId);

        await update(ref(db, `onlineMatches/${invite.matchId}`), {
          status: "readyLobby",
          [`ready/${getCurrentPlayerKey()}`]: false
        });
      }

      return;
    }

    if (invite.status === "declined") {
      clearTimeout(timeoutId);

      els.linkedPlayersList.innerHTML = `
        <div class="inviteResultBox error">
          <div class="linkErrorIcon">×</div>
          <strong>${playerName} declined</strong>
        </div>
      `;
      return;
    }

    if (invite.status === "expired") {
      clearTimeout(timeoutId);

      els.linkedPlayersList.innerHTML = `
        <div class="inviteResultBox error">
          <div class="linkErrorIcon">×</div>
          <strong>${playerName} did not respond in time</strong>
        </div>
      `;
    }
  });
}

function startLobbyCountdown(seconds) {
  clearInterval(lobbyCountdownInterval);

  lobbyCountdownEndsAt = Date.now() + seconds * 1000;

  lobbyCountdownInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((lobbyCountdownEndsAt - Date.now()) / 1000));

    const hostTimer = document.getElementById("hostLobbyTimer");
    if (hostTimer) hostTimer.textContent = `${remaining}s`;

    if (onlineRole === "guest") {
      els.startScorerGameBtn.textContent = `Waiting for opponent ${remaining}s`;
    }

    if (onlineRole === "host" && !document.getElementById("hostLobbyTimer")) {
      els.startScorerGameBtn.textContent = `Start game ${remaining}s`;
    }

    if (remaining <= 0) {
      clearInterval(lobbyCountdownInterval);
    }
  }, 250);
}

els.addOpponentBtn?.addEventListener("click", openOpponentModal);
els.closeOpponentBtn.addEventListener("click", closeOpponentModal);
els.inviteOpponentSetupBtn?.addEventListener("click", openOpponentModal);
els.refreshPlayersBtn?.addEventListener("click", openOpponentModal);

els.guestPlayerTwoName?.addEventListener("input", () => {
  els.setupPlayerErrorMsg?.classList.add("hidden");
});

els.guestPlayerOneName?.addEventListener("input", renderSetupPlayers);
els.guestPlayerTwoName?.addEventListener("input", renderSetupPlayers);

els.inviteOpponentSetupBtn?.addEventListener("click", () => {
  els.playerTwoNameField.classList.remove("hasError");
  els.setupPlayerErrorMsg?.classList.add("hidden");
});

els.guestPlayerBtn?.addEventListener("click", () => {
  els.guestPlayerOverlay.classList.remove("hidden");
  els.guestPlayerOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => els.guestPlayerNameInput.focus(), 50);
});

els.closeGuestPlayerBtn?.addEventListener("click", () => {
  els.guestPlayerOverlay.classList.add("hidden");
});

els.confirmGuestPlayerBtn?.addEventListener("click", () => {
  const name = els.guestPlayerNameInput.value.trim();
  if (!name) return;
  els.guestPlayerOverlay.classList.add("hidden");
  setOpponent(name);
});


function playerName(index) {
  return els.names[index].value.trim() || `Player ${index + 1}`;
}

function setVisiblePlayerNames(p1, p2, firstNameOnlyInGame = false) {
  els.names[0].value = firstNameOnlyInGame ? firstNameOnly(p1) : p1;
  els.names[1].value = firstNameOnlyInGame ? firstNameOnly(p2) : p2;
}

function isCheckout(scoreBeforeVisit, visitScore) {
  return scoreBeforeVisit - visitScore === 0 && POSSIBLE_CHECKOUTS.has(scoreBeforeVisit);
}

function applyMatchSettings(settings = {}) {
  STARTING_SCORE = Number(settings.startScore || STARTING_SCORE || 501);
  GAME_TYPE = settings.gameType || GAME_TYPE || "bestOf";
  IN_MODE = settings.inMode || IN_MODE || "straight";

  const legsCount = Number(settings.legsCount || els.legsCount?.textContent || 3);

  if (els.legsCount) {
    els.legsCount.textContent = legsCount;
  }

  updateLegTarget();

  state.players.forEach(player => {
    if (!player.legs && !player.dartsThrown) {
      player.score = STARTING_SCORE;
    }
  });

  if (els.gameTitleText) {
    els.gameTitleText.textContent = getGameTitle();
  }
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

function leaveMolVictoryScreenLocally() {
  onlineInviteAccepted = false;
  onlineInviteId = null;
  onlineMatchId = null;
  onlineRole = null;
  lastOnlineStatus = null;
  onlineDeciderOpened = false;
  onlineCoinStarted = false;
  onlineBullSubmitted = false;
  onlineResultSaved = false;
  molVictoryShownForMatchId = null;
  rematchStarting = false;

  clearOnlineSession();
  window.currentOnlineMatch = null;

  MATCH_MODE = "online";
  STATS_MODE = "competitive";
  window.STATS_MODE = STATS_MODE;

  newGame();

  els.molVictoryOverlay?.classList.add("hidden");
  els.scorerCard?.classList.add("hidden");
  els.startDeciderScreen?.classList.add("hidden");
  els.competitiveReadyOverlay?.classList.add("hidden");
  els.setupCard?.classList.add("hidden");

  fullyStopDartAudio();
  syncMainViews("leaderboard");
  loadLeaderboard();

  if (window.innerWidth < 500) {
    exitScorerFullscreen();
  }
}

els.molVictoryCloseBtn?.addEventListener("click", async () => {
  fullyStopDartAudio();
  const matchId = getOnlineMatchId();
  const myKey = getCurrentPlayerKey();
  const match = window.currentOnlineMatch || {};

  if (!matchId || !myKey || !window.ONMLiveDarts) return;

  const { db, ref, update } = window.ONMLiveDarts;

  await update(ref(db, `onlineMatches/${matchId}`), {
    [`resultPresence/${myKey}`]: "left",
    [`resultPresenceUpdatedAt/${myKey}`]: Date.now(),
    [`rematch/${myKey}`]: null
  });

  if (window.ONMLiveDarts?.setPresenceStatus) {
    await window.ONMLiveDarts.setPresenceStatus(myKey, "online");
  }

  leaveMolVictoryScreenLocally();
});

els.molVictoryRematchBtn?.addEventListener("click", async () => {
  const matchId = getOnlineMatchId();
  const myKey = getCurrentPlayerKey();
  const match = window.currentOnlineMatch || {};

  if (!matchId || !myKey || !window.ONMLiveDarts) return;

  const opponentKey =
    myKey === match.hostPlayerKey
      ? match.guestPlayerKey
      : match.hostPlayerKey;

  if (match.resultPresence?.[opponentKey] === "left") return;

  const currentlyRematching = Boolean(match.rematch?.[myKey]);
  const nextRematch = !currentlyRematching;

  const { db, ref, update, get } = window.ONMLiveDarts;

  await update(ref(db, `onlineMatches/${matchId}`), {
    [`rematch/${myKey}`]: nextRematch ? true : null,
    [`resultPresence/${myKey}`]: nextRematch ? "rematch" : "viewing",
    [`resultPresenceUpdatedAt/${myKey}`]: Date.now()
  });

  if (!nextRematch) return;

  const latestSnap = await get(ref(db, `onlineMatches/${matchId}`));
  if (!latestSnap.exists()) return;

  const latest = latestSnap.val();

  const hostRematch = Boolean(latest.rematch?.[latest.hostPlayerKey]);
  const guestRematch = Boolean(latest.rematch?.[latest.guestPlayerKey]);

  const alreadyStarted =
    latest.rematchStartedForCompletedAt &&
    latest.rematchStartedForCompletedAt === latest.completedAt;

  if (hostRematch && guestRematch && !alreadyStarted && !rematchStarting) {
    rematchStarting = true;
    await startOnlineRematch(latest);
  }
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

document.addEventListener("pointerdown", () => {
  unlockDartAudio();
}, { once: true });

window.addEventListener("pagehide", fullyStopDartAudio);

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

els.confirmQuitBtn.addEventListener("click", async () => {
  fullyStopDartAudio();
  const wasMOLGame =
    MATCH_MODE === "online" ||
    STATS_MODE === "competitive" ||
    onlineMatchId;

  if (MATCH_MODE === "online" && onlineMatchId) {
    await leaveOnlineMatch("left");
  }

  closeQuitConfirm();

  if (wasMOLGame) {
    showLeaderboardTab();
  } else {
    showPlayTab();
  }

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
  const p1Input = document.getElementById("guestPlayerOneName");
  const p2Input = document.getElementById("guestPlayerTwoName");

  if (!loggedInUser && (MATCH_MODE === "online" || STATS_MODE === "competitive")) {
    window.location.href = "auth.html?redirect=dart-scorer.html";
    return;
  }

  if (p1Input && !p1Input.value.trim()) {
    p1Input.focus();
    return;
  }

  els.setupPlayerErrorMsg?.classList.add("hidden");

  if (MATCH_MODE === "local" && p2Input && !p2Input.value.trim()) {
    els.setupPlayerErrorMsg.textContent = "Please enter Player 2's name.";
    els.setupPlayerErrorMsg.classList.remove("hidden");
    p2Input.focus();
    return;
  }

  if (MATCH_MODE === "online" && (!onlineInviteAccepted || !els.setupPlayerTwoName.value.trim())) {
    els.setupPlayerErrorMsg.textContent = "You must invite an opponent and wait for them to accept.";
    els.setupPlayerErrorMsg.classList.remove("hidden");
    return;
  }

  if (MATCH_MODE === "online" && onlineRole === "guest") {
    return;
  }

  if (MATCH_MODE === "online" && onlineRole === "host") {
    startOnlineMatchDecider();
    return;
  }

  const playerOneStartName =
    p1Input?.value?.trim() ||
    els.setupPlayerOneName?.value?.trim() ||
    getLoggedInFullName(loggedInUser) ||
    "Player 1";

  const playerTwoStartName =
    MATCH_MODE === "online"
      ? els.setupPlayerTwoName?.value?.trim() || "Player 2"
      : p2Input?.value?.trim() || els.setupPlayerTwoName?.value?.trim() || "Player 2";

  els.names[0].value = firstNameOnly(playerOneStartName) || "Player 1";
  els.names[1].value = firstNameOnly(playerTwoStartName) || "Player 2";

  newGame();
  els.setupCard.classList.add("hidden");
  openStartDecider();
  onlineDeciderOpened = true;

  if (window.innerWidth < 500) {
    enterScorerFullscreen();
  }
});

let pendingGameReady = false;
let bullThrows = [];
let selectedDeciderChoice = "bull";
let deciderResolved = false;
let pendingBullThrow = null;
let deciderStartTimer = null;
let coinFlipTimer = null;
let coinAutoTimer = null;

function openStartDecider() {
  pendingGameReady = true;
  deciderResolved = false;
  selectedDeciderChoice = "bull";

  els.startDeciderScreen.classList.remove("hidden");
  els.deciderChoiceView.classList.remove("hidden");
  els.bullDeciderView.classList.add("hidden");
  els.coinDeciderView.classList.add("hidden");

  els.chooseBullBtn.classList.add("selected");
  els.chooseCoinBtn.classList.remove("selected");

  bullThrows = [];
}

function closeStartDecider() {
  clearTimeout(deciderStartTimer);
  clearTimeout(coinFlipTimer);
  clearTimeout(coinAutoTimer);

  pendingGameReady = false;
  deciderResolved = true;

  els.startDeciderScreen.classList.add("hidden");
  els.deciderChoiceView.classList.add("hidden");
  els.bullDeciderView.classList.add("hidden");
  els.coinDeciderView.classList.add("hidden");
}

function startActualGame() {
  closeStartDecider();
  els.scorerCard.classList.remove("hidden");
  render();
}

function setStartingPlayer(index) {
  state.currentPlayer = index;
  startActualGame();
}

function updateDeciderNames() {
  els.bullPlayerOneName.textContent = playerName(0);
  els.bullPlayerTwoName.textContent = playerName(1);
  els.coinPlayerOneName.textContent = playerName(0);
  els.coinPlayerTwoName.textContent = playerName(1);
}

function chooseDecider(type) {
  selectedDeciderChoice = type;

  els.chooseBullBtn.classList.toggle("selected", type === "bull");
  els.chooseCoinBtn.classList.toggle("selected", type === "coin");
}

els.chooseBullBtn.addEventListener("click", () => {
  chooseDecider("bull");
});

els.chooseCoinBtn.addEventListener("click", () => {
  chooseDecider("coin");
});

els.startDeciderBtn.addEventListener("click", async () => {
  updateDeciderNames();

  // LOCAL MATCH
  if (!onlineMatchId || MATCH_MODE !== "online") {
    els.deciderChoiceView.classList.add("hidden");

    if (selectedDeciderChoice === "bull") {
      openBullDecider();
    } else {
      openCoinDecider();
    }

    return;
  }

  // ONLINE HOST MATCH
  if (onlineRole === "host") {
    const { db, ref, update } = window.ONMLiveDarts;

    const updates = {
      "decider/type": selectedDeciderChoice,
      "decider/status": "chosen"
    };

    if (selectedDeciderChoice === "coin") {
      const coinWinnerIndex = Math.random() < 0.5 ? 0 : 1;
      const matchSnap = await window.ONMLiveDarts.get(ref(db, `onlineMatches/${onlineMatchId}`));
      const match = matchSnap.val();
      const keys = onlinePlayerKeys(match);

      updates["decider/coinWinnerKey"] = keys[coinWinnerIndex];
      updates["decider/coinWinnerIndex"] = coinWinnerIndex;
    }

    await update(ref(db, `onlineMatches/${onlineMatchId}`), updates);
  }
});

els.skipDeciderBtn.addEventListener("click", async () => {
  if (onlineMatchId && onlineRole === "host") {
    await startOnlinePlaying(0);
    return;
  }

  setStartingPlayer(0);
});

els.deciderQuitBtn.addEventListener("click", () => {
  fullyStopDartAudio();
  closeStartDecider();
  els.setupCard.classList.remove("hidden");

  if (window.innerWidth < 500) {
    exitScorerFullscreen();
  }
});

function openBullDecider() {
  deciderResolved = false;
  bullThrows = [];

  els.bullBoard.innerHTML = "";
  els.bullDeciderView.classList.remove("hidden");
  els.coinDeciderView.classList.add("hidden");

  els.bullPlayerOneBox.classList.add("active");
  els.bullPlayerTwoBox.classList.remove("active", "won", "lost");
  els.bullPlayerOneBox.classList.remove("won", "lost");

  els.bullPlayerOneStatus.textContent = "Throw your dart";
  els.bullPlayerTwoStatus.textContent = "Waiting";
  els.bullDeciderPrompt.textContent = "Tap where your dart landed";
  els.bullWinnerText.textContent = "";
  pendingBullThrow = null;
  els.confirmBullThrowBtn.classList.add("hidden");
}

els.bullBoard.addEventListener("click", event => {
  if (deciderResolved) return;

  if (onlineMatchId && MATCH_MODE === "online") {
    const myKey = getCurrentPlayerKey();
    const currentMatch = window.currentOnlineMatch;

    if (currentMatch?.decider?.bullThrows?.[myKey]) return;
  } else if (bullThrows.length >= 2) {
    return;
  }

  const rect = els.bullBoard.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const centreX = rect.width / 2;
  const centreY = rect.height / 2;
  const distance = Math.hypot(x - centreX, y - centreY);

  const playerIndex = onlineMatchId && MATCH_MODE === "online"
    ? getMyOnlineIndex(window.currentOnlineMatch)
    : bullThrows.length;

  pendingBullThrow = {
    playerIndex,
    distance,
    x,
    y
  };

  els.bullBoard
    .querySelectorAll(`.bullMarker.pending[data-player-index="${playerIndex}"]`)
    .forEach(marker => marker.remove());

  const marker = document.createElement("span");
  marker.className = "bullMarker pending";
  marker.dataset.playerIndex = playerIndex;
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.textContent = getInitial(playerName(playerIndex));

  els.bullBoard.appendChild(marker);
  playDartCallout("dart-arrow.mp3");
  els.confirmBullThrowBtn.classList.remove("hidden");
  els.confirmBullThrowBtn.disabled = false;
  els.confirmBullThrowBtn.textContent = "Confirm throw";
});

els.confirmBullThrowBtn.addEventListener("click", async () => {
  if (!pendingBullThrow || deciderResolved) return;

  const marker = els.bullBoard.querySelector(
    `.bullMarker.pending[data-player-index="${pendingBullThrow.playerIndex}"]`
  );
  marker?.classList.remove("pending");

  if (onlineMatchId && MATCH_MODE === "online") {
    const { db, ref, update } = window.ONMLiveDarts;
    const myKey = getCurrentPlayerKey();

    await update(ref(db, `onlineMatches/${onlineMatchId}/decider/bullThrows/${myKey}`), {
      distance: pendingBullThrow.distance,
      x: pendingBullThrow.x,
      y: pendingBullThrow.y,
      thrownAt: Date.now()
    });

    pendingBullThrow = null;
    onlineBullSubmitted = true;

    els.confirmBullThrowBtn.textContent = "Throw confirmed";
    els.confirmBullThrowBtn.disabled = true;
    els.confirmBullThrowBtn.classList.remove("hidden");

    return;
  }

  bullThrows.push(pendingBullThrow);
  pendingBullThrow = null;
  els.confirmBullThrowBtn.classList.add("hidden");

  if (bullThrows.length === 1) {
    els.bullPlayerOneBox.classList.remove("active");
    els.bullPlayerTwoBox.classList.add("active");
    els.bullPlayerOneStatus.textContent = "Thrown";
    els.bullPlayerTwoStatus.textContent = "Throw your dart";
    els.bullDeciderPrompt.textContent = "Tap where your dart landed";
    return;
  }

  deciderResolved = true;

  const winner = bullThrows[0].distance <= bullThrows[1].distance ? 0 : 1;
  const loser = winner === 0 ? 1 : 0;

  els.bullPlayerOneBox.classList.remove("active");
  els.bullPlayerTwoBox.classList.remove("active");

  els.bullPlayerOneBox.classList.toggle("won", winner === 0);
  els.bullPlayerOneBox.classList.toggle("lost", loser === 0);
  els.bullPlayerTwoBox.classList.toggle("won", winner === 1);
  els.bullPlayerTwoBox.classList.toggle("lost", loser === 1);

  els.bullPlayerOneStatus.textContent = winner === 0 ? "Won" : "Lost";
  els.bullPlayerTwoStatus.textContent = winner === 1 ? "Won" : "Lost";

  els.bullDeciderPrompt.textContent = "Closest to the bull wins";
  els.bullWinnerText.textContent = `${playerName(winner)} throws first`;
  launchDeciderFireworks(winner === 0 ? els.bullPlayerOneBox : els.bullPlayerTwoBox);

  playDartCallout(winner === 0 ? "you-throw.mp3" : "oppo-throw.mp3");
  playDartCallout("game-on.mp3");

  setTimeout(() => {
    setStartingPlayer(winner);
  }, 3000);
});

function showOnlineBullResult(match, winnerIndex) {
  const loserIndex = winnerIndex === 0 ? 1 : 0;
  const winnerName = winnerIndex === 0 ? match.hostName : match.guestName;

  els.bullPlayerOneBox.classList.toggle("won", winnerIndex === 0);
  els.bullPlayerOneBox.classList.toggle("lost", loserIndex === 0);
  els.bullPlayerTwoBox.classList.toggle("won", winnerIndex === 1);
  els.bullPlayerTwoBox.classList.toggle("lost", loserIndex === 1);

  els.bullPlayerOneStatus.textContent = winnerIndex === 0 ? "Won" : "Lost";
  els.bullPlayerTwoStatus.textContent = winnerIndex === 1 ? "Won" : "Lost";

  els.bullDeciderPrompt.textContent = "Closest to the bull wins";
  els.bullWinnerText.textContent = `${winnerName} throws first`;
}

function getInitial(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

function getCoinMarkup(finalWinner = null) {
  const p1 = getInitial(playerName(0));
  const p2 = getInitial(playerName(1));

  return `
    <span class="coinFace coinFront">${finalWinner === 1 ? p2 : p1}</span>
    <span class="coinFace coinBack">${finalWinner === 0 ? p1 : p2}</span>
  `;
}

function openCoinDecider() {
  deciderResolved = false;

  els.coinDeciderView.classList.remove("hidden");
  els.bullDeciderView.classList.add("hidden");

  els.coinBtn.disabled = false;
  els.coinBtn.classList.remove("coinFlipping", "coinLandsBack");
  els.coinBtn.innerHTML = getCoinMarkup();

  els.coinPlayerOneBox.classList.remove("active", "won", "lost");
  els.coinPlayerTwoBox.classList.remove("active", "won", "lost");
  els.coinPlayerOneStatus.textContent = "Waiting";
  els.coinPlayerTwoStatus.textContent = "Waiting";

  els.coinResultText.textContent = "Coin toss starting...";
  coinAutoTimer = setTimeout(runCoinToss, 1000);
  els.coinWinnerText.textContent = "";
}

function runCoinToss() {
  if (deciderResolved || !pendingGameReady) return;

  deciderResolved = true;
  els.coinBtn.disabled = true;
  els.coinBtn.classList.remove("coinLandsBack");
  els.coinBtn.classList.add("coinFlipping");
  els.coinResultText.textContent = "Tossing...";
  playLayeredDartAudio("coin-flip.mp3", 0.6);

  coinFlipTimer = setTimeout(() => {
    if (!pendingGameReady) return;

    const winner = Math.random() < 0.5 ? 0 : 1;
    const loser = winner === 0 ? 1 : 0;

    els.coinBtn.classList.remove("coinFlipping");
    els.coinBtn.innerHTML = getCoinMarkup(winner);

    if (winner === 1) {
      els.coinBtn.classList.add("coinLandsBack");
    }

    els.coinPlayerOneBox.classList.toggle("won", winner === 0);
    els.coinPlayerOneBox.classList.toggle("lost", loser === 0);
    els.coinPlayerTwoBox.classList.toggle("won", winner === 1);
    els.coinPlayerTwoBox.classList.toggle("lost", loser === 1);

    els.coinPlayerOneStatus.textContent = winner === 0 ? "Won" : "Lost";
    els.coinPlayerTwoStatus.textContent = winner === 1 ? "Won" : "Lost";

    els.coinResultText.textContent = "Coin toss complete";
    els.coinWinnerText.textContent =
      `${playerName(winner)} throws first`;
    const myLocalIndex = 0;
    playDartCallout(winner === myLocalIndex ? "you-throw.mp3" : "oppo-throw.mp3");
    playDartCallout("game-on.mp3");
    launchDeciderFireworks(winner === 0 ? els.coinPlayerOneBox : els.coinPlayerTwoBox);

    deciderStartTimer = setTimeout(() => {
      setStartingPlayer(winner);
    }, 3000);
  }, 2200);
}

function firstNameOnly(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function getLoggedInFullName(user) {
  return (
    `${user.firstName || ""} ${user.surname || user.lastName || ""}`.trim() ||
    user.fullName ||
    user.name ||
    user.linkedPlayerName ||
    "Player 1"
  );
}

function getCurrentPlayerKey() {
  const user = window.ONMSession?.getUser?.() || loggedInUser;
  return getLeagueUserKey(user);
}

function getMyOnlineIndex(match) {
  const myKey = getCurrentPlayerKey();
  return myKey === match.hostPlayerKey ? 0 : 1;
}

function getOpponentOnlineIndex(match) {
  return getMyOnlineIndex(match) === 0 ? 1 : 0;
}

function onlinePlayerKeys(match) {
  return [match.hostPlayerKey, match.guestPlayerKey];
}

function render() {
  state.players.forEach((player, index) => {
    const checkout = CHECKOUTS[player.score];

    els.checkouts[index].textContent = checkout || "";
    els.checkouts[index].classList.toggle("show", Boolean(checkout));
    els.scores[index].textContent = player.score;
    els.legs[index].textContent = player.legs;
    els.lasts[index].textContent = player.lastScore ?? "-";
    els.darts[index].textContent = player.currentLegDarts;

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
  if (onlineMatchId && MATCH_MODE === "online") {
    submitOnlineScore();
    return;
  }

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

async function submitOnlineScore() {
  unlockDartAudio();
  const value = Number(els.input.value);

  if (!Number.isInteger(value) || value < 0 || value > MAX_VISIT) {
    els.input.select();
    return;
  }

  const { db, ref, get } = window.ONMLiveDarts;
  const matchSnap = await get(ref(db, `onlineMatches/${onlineMatchId}`));
  if (!matchSnap.exists()) return;

  const match = matchSnap.val();
  const myKey = getCurrentPlayerKey();

  if (match.game.currentPlayerKey !== myKey) return;

  const player = match.game.players[myKey];
  const previousScore = player.score;
  const newScore = previousScore - value;

  if (value > previousScore) {
    showImpossibleMessage(`${value} is impossible`);
    els.input.value = "";
    return;
  }

  if (newScore === 1) {
    showImpossibleMessage("1 is impossible");
    els.input.value = "";
    return;
  }

  if (newScore === 0 && !CHECKOUTS[previousScore]) {
    showImpossibleMessage(`${previousScore} is impossible`);
    els.input.value = "";
    return;
  }

  const legWon = newScore === 0;

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
        bullOutDefault,
        online: true
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
        bullOutDefault,
        online: true
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
        bullOutDefault,
        online: true
      });
      return;
    }
  }

  if (!legWon) {
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
        checkoutOptions: null,
        online: true
      });
      return;
    }
  }

  await applyOnlineVisit({
    match,
    myKey,
    visitScore: value,
    previousScore,
    legWon,
    dartsUsed: 3,
    doublesAttempted: 0,
    bullOut: false
  });
}

async function getFirebasePlayerRating(playerKey, fallbackName = "") {
  const { db, ref, get } = window.ONMLiveDarts;

  const snapshot = await get(ref(db, `ratings/${playerKey}`));

  if (!snapshot.exists()) {
    return {
      rating: 1000,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      streak: 0,
      form: [],
      lastResult: "",
      lastRatingChange: "",
      playerName: fallbackName
    };
  }

  const data = snapshot.val();

  return {
    rating: Number(data.rating || 1000),
    gamesPlayed: Number(data.gamesPlayed || 0),
    wins: Number(data.wins || 0),
    losses: Number(data.losses || 0),
    streak: Number(data.streak || 0),

    form: Array.isArray(data.form)
      ? data.form
      : [],

    lastResult: data.lastResult || "",
    lastRatingChange: data.lastRatingChange || "",

    playerName: data.playerName || fallbackName
  };
}

function calculateDartRatingChange({
  winnerRating = 1000,
  loserRating = 1000,
  winnerLegs = 0,
  loserLegs = 0
}) {
  const K = 34;

  const expectedWinner =
    1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));

  const baseChange = K * (1 - expectedWinner);

  const totalLegs = winnerLegs + loserLegs;
  const legDifference = winnerLegs - loserLegs;

  const legMultiplier = totalLegs
    ? 0.85 + (legDifference / totalLegs) * 0.35
    : 1;

  const participationBonus = 3;

  const winnerChange = Math.round(baseChange * legMultiplier + participationBonus);
  const loserChange = Math.max(1, Math.round(baseChange * legMultiplier - participationBonus));

  return {
    winnerChange,
    loserChange,
    winnerNewRating: winnerRating + winnerChange,
    loserNewRating: Math.max(0, loserRating - loserChange)
  };
}

function buildDartMatchPayloadFromOnlineMatch(match, winnerKey) {
  const keys = onlinePlayerKeys(match);
  const p1Key = keys[0];
  const p2Key = keys[1];

  const p1 = match.game.players[p1Key];
  const p2 = match.game.players[p2Key];

  const s1 = getPlayerStats({
    ...state.players[0],
    ...p1,
    legDarts: p1.legDarts || [],
    firstNineScored: p1.firstNineScored || 0,
    firstNineDarts: p1.firstNineDarts || 0
  });

  const s2 = getPlayerStats({
    ...state.players[1],
    ...p2,
    legDarts: p2.legDarts || [],
    firstNineScored: p2.firstNineScored || 0,
    firstNineDarts: p2.firstNineDarts || 0
  });

  return {
    matchId: match.matchId,
    dateTime: new Date().toISOString(),
    startScore: match.settings?.startScore || STARTING_SCORE,
    gameType: match.settings?.gameType || GAME_TYPE,
    legsCount: match.settings?.legsCount || Number(els.legsCount.textContent),
    legsToWin: LEGS_TO_WIN,
    inMode: match.settings?.inMode || IN_MODE,
    matchMode: "online",

    playerOneName: p1.name,
    playerOneId: p1Key,
    playerOneLegs: p1.legs || 0,
    playerOneWon: winnerKey === p1Key,
    playerOne3DartAvg: s1.average,
    playerOneFirst9Avg: s1.firstNineAvg,
    playerOneDartsThrown: p1.dartsThrown || 0,
    playerOneTotalScored: p1.totalScored || 0,
    playerOneCheckoutsHit: p1.checkoutHits || 0,
    playerOneCheckoutAttempts: p1.checkoutAttempts || 0,
    playerOneCheckoutRate: cleanStatNumber(s1.checkoutRate),
    playerOneHighestOut: cleanStatNumber(s1.highestOut),
    playerOneHighScore: cleanStatNumber(s1.highScore),
    playerOneBestLeg: cleanStatNumber(s1.bestLeg),
    playerOneWorstLeg: cleanStatNumber(s1.worstLeg),
    playerOne180s: p1.oneEightys || 0,
    playerOneBullOuts: p1.bullOuts || 0,

    playerTwoName: p2.name,
    playerTwoId: p2Key,
    playerTwoLegs: p2.legs || 0,
    playerTwoWon: winnerKey === p2Key,
    playerTwo3DartAvg: s2.average,
    playerTwoFirst9Avg: s2.firstNineAvg,
    playerTwoDartsThrown: p2.dartsThrown || 0,
    playerTwoTotalScored: p2.totalScored || 0,
    playerTwoCheckoutsHit: p2.checkoutHits || 0,
    playerTwoCheckoutAttempts: p2.checkoutAttempts || 0,
    playerTwoCheckoutRate: cleanStatNumber(s2.checkoutRate),
    playerTwoHighestOut: cleanStatNumber(s2.highestOut),
    playerTwoHighScore: cleanStatNumber(s2.highScore),
    playerTwoBestLeg: cleanStatNumber(s2.bestLeg),
    playerTwoWorstLeg: cleanStatNumber(s2.worstLeg),
    playerTwo180s: p2.oneEightys || 0,
    playerTwoBullOuts: p2.bullOuts || 0
  };
}

async function applyOnlineVisit({ match, myKey, visitScore, previousScore, legWon, dartsUsed, doublesAttempted, bullOut }) {
  const { db, ref, update } = window.ONMLiveDarts;
  let ratingUpdates = null;

  const keys = onlinePlayerKeys(match);
  const opponentKey = keys.find(key => key !== myKey);
  const player = match.game.players[myKey];
  const calloutId = `${Date.now()}-${myKey}-${Math.random().toString(36).slice(2)}`;

  const currentDarts = player.dartsThrown || 0;
  const currentTotal = player.totalScored || 0;
  const currentLegDarts = player.currentLegDarts || 0;
  const currentHighScore = player.highScore || 0;
  const currentFirstNineScored = player.firstNineScored || 0;
  const currentFirstNineDarts = player.firstNineDarts || 0;
  const currentLegFirstNineScored = player.currentLegFirstNineScored || 0;
  const currentLegFirstNineDarts = player.currentLegFirstNineDarts || 0;

  const firstNineDartsAvailable = Math.max(0, 9 - currentLegDarts);
  const firstNineDartsUsed = Math.min(dartsUsed, firstNineDartsAvailable);

  let firstNineScore = 0;

  if (firstNineDartsUsed > 0) {
    firstNineScore =
      firstNineDartsUsed === dartsUsed
        ? visitScore
        : Math.round((visitScore / dartsUsed) * firstNineDartsUsed);
  }

  const updates = {
    [`game/players/${myKey}/lastScore`]: visitScore,
    [`game/players/${myKey}/dartsThrown`]: currentDarts + dartsUsed,
    [`game/players/${myKey}/currentLegDarts`]: currentLegDarts + dartsUsed,
    [`game/players/${myKey}/totalScored`]: currentTotal + visitScore,
    [`game/players/${myKey}/highScore`]: Math.max(currentHighScore, visitScore),
    [`game/currentPlayerKey`]: opponentKey,
    [`game/players/${myKey}/firstNineScored`]: currentFirstNineScored + firstNineScore,
    [`game/players/${myKey}/firstNineDarts`]: currentFirstNineDarts + firstNineDartsUsed,
    [`game/players/${myKey}/currentLegFirstNineScored`]: currentLegFirstNineScored + firstNineScore,
    [`game/players/${myKey}/currentLegFirstNineDarts`]: currentLegFirstNineDarts + firstNineDartsUsed,
    [`game/lastCallout/id`]: calloutId,
    [`game/lastCallout/type`]: "score",
    [`game/lastCallout/visitScore`]: visitScore,
    [`game/lastCallout/requiredScore`]: legWon ? 0 : match.game.players[opponentKey].score,
    [`game/lastCallout/bullOut`]: Boolean(bullOut),
    [`game/lastCallout/byKey`]: myKey,
    [`game/lastCallout/createdAt`]: Date.now(),
    [`game/lastCallout/finishHim`]: Boolean(
      match.game.players[opponentKey]?.score === 2 &&
      Number(match.game.players[opponentKey]?.checkoutAttempts || 0) >= 3
    ),
  };

  if (visitScore === 180) {
    updates[`game/players/${myKey}/oneEightys`] = (player.oneEightys || 0) + 1;
  }

  if (legWon) {
    const newLegs = (player.legs || 0) + 1;

    const legsCount = Number(match.settings?.legsCount || els.legsCount.textContent || 3);
    const gameType = match.settings?.gameType || GAME_TYPE;

    const legsToWin =
      gameType === "bestOf"
        ? Math.floor(legsCount / 2) + 1
        : legsCount;

    const isMatchShot = newLegs >= legsToWin;

    updates[`game/lastCallout/type`] = isMatchShot ? "matchShot" : "gameShot";
    updates[`game/lastCallout/winnerKey`] = myKey;

    updates[`game/players/${myKey}/legs`] = newLegs;
    updates[`game/players/${myKey}/checkoutHits`] = (player.checkoutHits || 0) + 1;
    updates[`game/players/${myKey}/checkoutAttempts`] =
      (player.checkoutAttempts || 0) + Math.max(1, doublesAttempted);
    updates[`game/players/${myKey}/highestOut`] = Math.max(player.highestOut || 0, previousScore);

    const finishedLegDarts = currentLegDarts + dartsUsed;
    const previousLegDarts = player.legDarts || [];

    updates[`game/players/${myKey}/legDarts`] = [...previousLegDarts, finishedLegDarts];

    if (bullOut) {
      updates[`game/players/${myKey}/bullOuts`] = (player.bullOuts || 0) + 1;
    }

    updates[`game/players/${myKey}/score`] = STARTING_SCORE;
    updates[`game/players/${opponentKey}/score`] = STARTING_SCORE;
    updates[`game/players/${myKey}/currentLegDarts`] = 0;
    updates[`game/players/${opponentKey}/currentLegDarts`] = 0;
    updates[`game/players/${myKey}/currentLegFirstNineScored`] = 0;
    updates[`game/players/${myKey}/currentLegFirstNineDarts`] = 0;
    updates[`game/players/${opponentKey}/currentLegFirstNineScored`] = 0;
    updates[`game/players/${opponentKey}/currentLegFirstNineDarts`] = 0;

    if (newLegs >= legsToWin) {
      const opponent = match.game.players[opponentKey];

      const winnerProfile = await getFirebasePlayerRating(myKey, player.name || "");
      const loserProfile = await getFirebasePlayerRating(opponentKey, opponent.name || "");

      const elo = calculateDartRatingChange({
        winnerRating: winnerProfile.rating,
        loserRating: loserProfile.rating,
        winnerLegs: newLegs,
        loserLegs: opponent.legs || 0
      });

      updates.status = "complete";
      updates.winnerKey = myKey;
      updates.winnerName = player.name || "";
      updates.loserKey = opponentKey;
      updates.loserName = opponent.name || "";
      updates.completedAt = Date.now();
      updates.sheetSaved = false;

      updates[`game/players/${myKey}/rating`] = elo.winnerNewRating;
      updates[`game/players/${opponentKey}/rating`] = elo.loserNewRating;

      updates.ratingChange = {
        winnerKey: myKey,
        loserKey: opponentKey,
        winnerOldRating: winnerProfile.rating,
        winnerNewRating: elo.winnerNewRating,
        loserOldRating: loserProfile.rating,
        loserNewRating: elo.loserNewRating
      };

      const winnerStreak = Number(winnerProfile.streak || 0) + 1;

      ratingUpdates = {
        [`ratings/${myKey}`]: {
          playerKey: myKey,
          playerName: player.name || winnerProfile.playerName || "",
          photo: myKey === match.hostPlayerKey ? match.hostPhoto || "" : match.guestPhoto || "",
          nationality: myKey === match.hostPlayerKey ? match.hostNationality || "" : match.guestNationality || "",
          rating: elo.winnerNewRating,
          gamesPlayed: winnerProfile.gamesPlayed + 1,
          wins: winnerProfile.wins + 1,
          streak: winnerStreak,
          updatedAt: Date.now(),
          lastResult: `${newLegs}-${opponent.legs || 0} Victory!`,
          lastRatingChange: `+${elo.winnerChange} rating`,
          form: [...(winnerProfile.form || []), "W"].slice(-5),
        },
        [`ratings/${opponentKey}`]: {
          playerKey: opponentKey,
          playerName: opponent.name || loserProfile.playerName || "",
          photo: opponentKey === match.hostPlayerKey ? match.hostPhoto || "" : match.guestPhoto || "",
          nationality: opponentKey === match.hostPlayerKey ? match.hostNationality || "" : match.guestNationality || "",
          rating: elo.loserNewRating,
          gamesPlayed: loserProfile.gamesPlayed + 1,
          wins: loserProfile.wins,
          streak: 0,
          updatedAt: Date.now(),
          lastResult: `${opponent.legs || 0}-${newLegs} Defeat!`,
          lastRatingChange: `-${elo.loserChange} rating`,
          form: [...(loserProfile.form || []), "L"].slice(-5),
        }
      };
    }

  } else {
    updates[`game/players/${myKey}/score`] = previousScore - visitScore;
  }

  if (!legWon && doublesAttempted) {
    updates[`game/players/${myKey}/checkoutAttempts`] =
      (player.checkoutAttempts || 0) + doublesAttempted;
  }

  await update(ref(db, `onlineMatches/${onlineMatchId}`), updates);

  if (ratingUpdates) {
    await update(ref(db), ratingUpdates);
  }

  if (updates.status === "complete") {
    const finalMatchSnap = await window.ONMLiveDarts.get(ref(db, `onlineMatches/${onlineMatchId}`));
    const finalMatch = finalMatchSnap.val();

    if (!finalMatch.sheetSaved) {
      const saveResult = await postDartMatch({
        action: "saveDartMatch",
        match: buildDartMatchPayloadFromOnlineMatch(finalMatch, myKey)
      });

      if (saveResult.success) {
        await update(ref(db, `onlineMatches/${onlineMatchId}`), {
          sheetSaved: true,
          sheetSavedAt: Date.now(),
          status: "closed"
        });

        setTimeout(async () => {
          await window.ONMLiveDarts.remove(
            ref(db, `onlineMatches/${onlineMatchId}`)
          );
        }, 3000);
      }
    }
  }

  els.input.value = "";
}

function setTogglePosition(toggleEl, activeBtn) {
  if (!toggleEl || !activeBtn) return;

  const buttons = [...toggleEl.querySelectorAll(".toggleBtn")];
  const slider = toggleEl.querySelector(".toggleSlider");
  if (!slider) return;

  const index = buttons.indexOf(activeBtn);
  const count = buttons.length;
  if (index < 0 || !count) return;

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

function launchDeciderFireworks(card) {
  if (!card) return;

  const colors = ["#FFD740", "#44d17a", "#ffffff", "#ff4d4d", "#2f8cff"];

  for (let i = 0; i < 28; i++) {
    const particle = document.createElement("span");
    particle.className = "fireworkParticle";

    const angle = Math.random() * Math.PI * 2;
    const distance = 45 + Math.random() * 80;

    particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];

    card.appendChild(particle);

    setTimeout(() => particle.remove(), 900);
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
    previousCurrentLegDarts: player.currentLegDarts,
    previousFirstNineScored: player.firstNineScored,
    previousFirstNineDarts: player.firstNineDarts,
    previousCurrentLegFirstNineScored: player.currentLegFirstNineScored,
    previousCurrentLegFirstNineDarts: player.currentLegFirstNineDarts,
    previousHighScore: player.highScore,
    previousCheckoutHits: player.checkoutHits,
    previousCheckoutAttempts: player.checkoutAttempts,
    previousHighestOut: player.highestOut,
    previousOneEightys: player.oneEightys,
    previousBullOuts: player.bullOuts,
    previousLegDarts: [...(player.legDarts || [])],
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
    const firstNineDartsAvailable = Math.max(0, 9 - (player.currentLegDarts - dartsUsed));
    const firstNineDartsUsed = Math.min(dartsUsed, firstNineDartsAvailable);

    if (firstNineDartsUsed > 0) {
      const firstNineScore =
        firstNineDartsUsed === dartsUsed
          ? visitScore
          : Math.round((visitScore / dartsUsed) * firstNineDartsUsed);

      player.firstNineScored += firstNineScore;
      player.firstNineDarts += firstNineDartsUsed;
      player.currentLegFirstNineScored += firstNineScore;
      player.currentLegFirstNineDarts += firstNineDartsUsed;
    }
  }

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

    updateLegTarget();

    if (player.legs >= LEGS_TO_WIN) {
      announceLegWon(true, bullOut);

      state.winnerIndex = playerIndex;
      els.submit.disabled = true;

      setTimeout(() => {
        openMolVictoryScreen(buildMatchStatsData());
      }, 700);
    } else {
      announceLegWon(false, bullOut);
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

    if (!legWon && !bust) {
      const nextPlayer = state.players[state.currentPlayer];

      announceDartVisit(visitScore);
      announceRequiredScore(nextPlayer.score);

      if (shouldPlayFinishHim(nextPlayer)) {
        nextPlayer.finishHimPlayed = true;
        playDartCallout("finish-him.mp3");
      }
    }
  }

  render();
}

function resetLeg() {
  state.players.forEach(player => {
    player.score = STARTING_SCORE;
    player.lastScore = null;
    player.currentLegDarts = 0;
    player.currentLegFirstNineScored = 0;
    player.currentLegFirstNineDarts = 0;
    player.finishHimPlayed = false;
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
  player.currentLegDarts = last.previousCurrentLegDarts;
  player.firstNineScored = last.previousFirstNineScored;
  player.firstNineDarts = last.previousFirstNineDarts;
  player.currentLegFirstNineScored = last.previousCurrentLegFirstNineScored;
  player.currentLegFirstNineDarts = last.previousCurrentLegFirstNineDarts;
  player.highScore = last.previousHighScore;
  player.checkoutHits = last.previousCheckoutHits;
  player.checkoutAttempts = last.previousCheckoutAttempts;
  player.highestOut = last.previousHighestOut;
  player.oneEightys = last.previousOneEightys;
  player.bullOuts = last.previousBullOuts;
  player.legDarts = [...(last.previousLegDarts || [])];
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

  const firstNineAvg = player.firstNineDarts
    ? ((player.firstNineScored / player.firstNineDarts) * 3).toFixed(2)
    : "0.00";

  return {
    average,
    firstNineAvg,
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
    showOnlineNotice("Could not submit result. Please try again.");
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

  if (isMatchComplete && MATCH_MODE === "online" && window.currentOnlineMatch?.winnerKey) {
    announceMatchResultForMe(window.currentOnlineMatch.winnerKey);
  }

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
      MATCH_MODE === "online"
        ? `<button id="continueAfterMatchBtn" type="button" class="btn btnPrimary">Continue</button>`
        : STATS_MODE === "competitive"
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

    document.getElementById("continueAfterMatchBtn")?.addEventListener("click", async () => {
      fullyStopDartAudio();
      closeStatsModal();

      if (MATCH_MODE === "online" && onlineMatchId) {
        exitCompletedOnlineMatch();
      } else {
        newGame();
        els.scorerCard.classList.add("hidden");
        els.setupCard.classList.remove("hidden");
      }

      if (window.innerWidth < 500) {
        exitScorerFullscreen();
      }
    });
  }

  const rows = [
    ["3-dart avg.", s1.average, s2.average],
    ["First 9 avg.", s1.firstNineAvg, s2.firstNineAvg],
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
  onlineDeciderOpened = false;
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
    player.firstNineScored = 0;
    player.firstNineDarts = 0;
    player.currentLegFirstNineScored = 0;
    player.currentLegFirstNineDarts = 0;
    player.finishHimPlayed = false;
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

  const text = await response.text();

  console.log("[APPS SCRIPT RAW RESPONSE]", text);

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("[APPS SCRIPT JSON PARSE FAILED]", err, text);
    return {
      success: false,
      error: text || "Invalid Apps Script response"
    };
  }
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
    playerOneId: window.currentOnlineMatch?.hostPlayerKey || user?.linkedPlayerKey || user?.userId || "",
    playerOneLegs: p1.legs,
    playerOneWon: state.winnerIndex === 0,
    playerOne3DartAvg: s1.average,
    playerOneFirst9Avg: s1.firstNineAvg,
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
    playerTwoId: window.currentOnlineMatch?.guestPlayerKey || "",
    playerTwoLegs: p2.legs,
    playerTwoWon: state.winnerIndex === 1,
    playerTwo3DartAvg: s2.average,
    playerTwoFirst9Avg: s2.firstNineAvg,
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
  if (MATCH_MODE !== "online") return true;
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

els.confirmCheckoutPromptBtn.addEventListener("click", async () => {
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

  if (promptData.online && onlineMatchId) {
    const { db, ref, get } = window.ONMLiveDarts;
    const matchSnap = await get(ref(db, `onlineMatches/${onlineMatchId}`));
    if (!matchSnap.exists()) return;

    await applyOnlineVisit({
      match: matchSnap.val(),
      myKey: getCurrentPlayerKey(),
      visitScore: promptData.visitScore,
      previousScore: promptData.previousScore,
      legWon: promptData.legWon,
      dartsUsed,
      doublesAttempted,
      bullOut
    });

    return;
  }

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

els.markReadyBtn?.addEventListener("click", async () => {
  unlockDartAudio();
  if (window.innerWidth < 500) {
    enterScorerFullscreen();
    document.documentElement.requestFullscreen?.().catch(() => { });
  }

  if (!onlineMatchId) return;
  const { db, ref, update } = window.ONMLiveDarts;
  const myKey = getCurrentPlayerKey();

  await update(ref(db, `onlineMatches/${onlineMatchId}/ready`), {
    [myKey]: true
  });
});

els.leaveReadyLobbyBtn?.addEventListener("click", () => {
  fullyStopDartAudio();
  leaveOnlineMatch("cancelled");
  els.competitiveReadyOverlay?.classList.add("hidden");
});

els.cancelReadyLobbyBtn?.addEventListener("click", () => {
  fullyStopDartAudio();
  leaveOnlineMatch("cancelled");
  els.competitiveReadyOverlay?.classList.add("hidden");
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

els.setupPlayerOneSlot?.addEventListener("click", () => {
  if (competitiveLobbyMode) return;
  if (!loggedInUser) return;
  openProfilePopup();
});

els.closeProfileBtn?.addEventListener("click", () => {
  els.profileOverlay.classList.add("hidden");
  els.profileOverlay.setAttribute("aria-hidden", "true");
});

els.profileOverlay?.addEventListener("click", event => {
  if (event.target !== els.profileOverlay) return;

  els.profileOverlay.classList.add("hidden");
  els.profileOverlay.setAttribute("aria-hidden", "true");
});

els.statsOverlay.addEventListener("click", event => {
  if (event.target !== els.statsOverlay) return;
  if (state.winnerIndex !== null) return;
  closeStatsModal();
});

document.querySelectorAll("#matchModeSwitch .toggleBtn").forEach(button => {
  button.addEventListener("click", () => {
    const nextMode = button.dataset.matchMode;

    if (onlineInviteAccepted) {
      showSetupMessage("You cannot change Local/Online once an opponent has joined your lobby.");
      return;
    }

    MATCH_MODE = nextMode;

    // Online always stores stats/rating. Local never does.
    STATS_MODE = MATCH_MODE === "online" ? "competitive" : "casual";
    window.STATS_MODE = STATS_MODE;

    setTogglePosition(els.matchModeSwitch, button);
    updateSetupPlayerMode();
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
    els.fullscreenBtn.textContent = "⛶";
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

function openProfilePopup() {
  const savedUser = localStorage.getItem("onmUser");
  const user = savedUser ? JSON.parse(savedUser) : loggedInUser;

  if (!user) return;

  const overlay = document.getElementById("profileOverlay");
  const body = document.getElementById("profileModalContent");

  if (!overlay || !body) {
    console.warn("Missing profileOverlay or profileBody");
    return;
  }

  body.innerHTML = `
    <div class="profileTabs">
      <button type="button" class="profileTab active" data-tab="info">Info</button>
      <button type="button" class="profileTab" data-tab="details">Details</button>
      <button type="button" class="profileTab" data-tab="stats">Stats</button>
    </div>

    <div id="profileTabContent"></div>

    <button type="button" class="btn btnGhost" id="profileLogoutBtn">Log out</button>
  `;

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");

  renderProfileInfoTab(user);

  document.querySelectorAll(".profileTab").forEach(button => {
    button.addEventListener("click", async () => {
      document.querySelectorAll(".profileTab").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      if (button.dataset.tab === "info") {
        renderProfileInfoTab(user);
      }

      if (button.dataset.tab === "details") {
        renderProfileDetailsTab(user);
      }

      if (button.dataset.tab === "stats") {
        await loadProfileStats();
      }
    });
  });

  document.getElementById("profileLogoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("onmUser");
    window.location.href = "auth.html";
  });
}

function renderProfileInfoTab(user) {
  const content = document.getElementById("profileTabContent");
  if (!content) return;

  content.innerHTML = `
    <div class="profileInfo">
      <img class="profilePhoto" src="${getPlayerPhoto(user)}" alt="${getLoggedInFullName(user)}">

      <p><strong>Name:</strong> ${getLoggedInFullName(user)}</p>
      <p><strong>Email:</strong> ${user.email || ""}</p>
      <p><strong>Team:</strong> ${user.team || ""}</p>
      <p><strong>Nationality:</strong> ${user.nationality || ""}</p>
    </div>
  `;
}

function renderProfileDetailsTab(user) {
  const content = document.getElementById("profileTabContent");
  if (!content) return;

  content.innerHTML = `
    <div class="profileInfo">
      <p><strong>Nickname:</strong> ${user.nickname || ""}</p>
      <p><strong>Bio:</strong> ${user.bio || ""}</p>
      <p><strong>Walkout song:</strong> ${user.walkoutSong || ""}</p>
      <p><strong>Linked player:</strong> ${user.linkedPlayerName || ""}</p>
    </div>
  `;
}

function renderProfileStatsTab(stats) {
  const content = document.getElementById("profileTabContent");
  if (!content) return;

  content.innerHTML = `
    <div class="profileInfo">
      <p><strong>Games:</strong> ${stats.gamesPlayed || 0}</p>
      <p><strong>Wins:</strong> ${stats.wins || 0}</p>
      <p><strong>Losses:</strong> ${stats.losses || 0}</p>
      <p><strong>Average:</strong> ${stats.average || ""}</p>
      <p><strong>180s:</strong> ${stats.oneEightys || 0}</p>
      <p><strong>High score:</strong> ${stats.highScore || ""}</p>
      <p><strong>Highest out:</strong> ${stats.highestOut || ""}</p>
    </div>
  `;
}

async function loadProfileStats() {
  const user = window.ONMSession?.getUser?.() || loggedInUser;
  if (!user) return;

  const playerName =
    user.linkedPlayerName ||
    getLoggedInFullName(user);

  const playerKey =
    user.linkedPlayerKey ||
    getLeagueUserKey(user);

  const result = await postDartMatch({
    action: "getUserStats",
    linkedPlayerName: playerName,
    linkedPlayerKey: playerKey
  });

  if (!result.success) return;
  renderProfileStatsTab(result.stats);
}

function renderSetupPlayers() {
  const p1Name = els.guestPlayerOneName?.value?.trim() || "";
  const p2Name = els.guestPlayerTwoName?.value?.trim() || "";

  els.setupPlayerOneName.value = p1Name || "Player 1";
  els.setupPlayerTwoName.value = p2Name || "Player 2";
}

function leaderboardFlag(nationality) {
  return countryToFlag(nationality || "");
}

function countryToFlag(country) {
  const value = String(country || "").trim().toLowerCase();

  const flags = {
    england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    ireland: "🇮🇪",
    "united kingdom": "🇬🇧",
    france: "🇫🇷",
    germany: "🇩🇪",
    spain: "🇪🇸",
    portugal: "🇵🇹",
    italy: "🇮🇹",
    netherlands: "🇳🇱",
    belgium: "🇧🇪",
    luxembourg: "🇱🇺",
    switzerland: "🇨🇭",
    austria: "🇦🇹",
    denmark: "🇩🇰",
    norway: "🇳🇴",
    sweden: "🇸🇪",
    finland: "🇫🇮",
    iceland: "🇮🇸",

    poland: "🇵🇱",
    "czech republic": "🇨🇿",
    slovakia: "🇸🇰",
    hungary: "🇭🇺",
    romania: "🇷🇴",
    bulgaria: "🇧🇬",
    croatia: "🇭🇷",
    serbia: "🇷🇸",
    slovenia: "🇸🇮",
    "bosnia and herzegovina": "🇧🇦",
    montenegro: "🇲🇪",
    "north macedonia": "🇲🇰",
    albania: "🇦🇱",
    kosovo: "🇽🇰",
    greece: "🇬🇷",

    ukraine: "🇺🇦",
    lithuania: "🇱🇹",
    latvia: "🇱🇻",
    estonia: "🇪🇪",
    belarus: "🇧🇾",
    moldova: "🇲🇩",

    turkey: "🇹🇷",

    "united states": "🇺🇸",
    usa: "🇺🇸",
    canada: "🇨🇦",
    mexico: "🇲🇽",

    brazil: "🇧🇷",
    argentina: "🇦🇷",
    chile: "🇨🇱",
    colombia: "🇨🇴",
    peru: "🇵🇪",
    uruguay: "🇺🇾",
    paraguay: "🇵🇾",
    venezuela: "🇻🇪",

    australia: "🇦🇺",
    "new zealand": "🇳🇿",

    "south africa": "🇿🇦",
    nigeria: "🇳🇬",
    kenya: "🇰🇪",
    egypt: "🇪🇬",
    morocco: "🇲🇦",

    india: "🇮🇳",
    pakistan: "🇵🇰",
    bangladesh: "🇧🇩",
    "sri lanka": "🇱🇰",

    china: "🇨🇳",
    japan: "🇯🇵",
    "south korea": "🇰🇷",
    "north korea": "🇰🇵",
    taiwan: "🇹🇼",
    "hong kong": "🇭🇰",

    thailand: "🇹🇭",
    vietnam: "🇻🇳",
    malaysia: "🇲🇾",
    singapore: "🇸🇬",
    indonesia: "🇮🇩",
    philippines: "🇵🇭",

    "united arab emirates": "🇦🇪",
    "saudi arabia": "🇸🇦",
    qatar: "🇶🇦",
    kuwait: "🇰🇼",
    bahrain: "🇧🇭",
    oman: "🇴🇲",
    israel: "🇮🇱"
  };

  return flags[value] || "🌍";
}

function preloadImage(src) {
  if (!src) return;
  const img = new Image();
  img.src = src;
}

function getPlayerFlag(userOrPlayer) {
  return (
    userOrPlayer?.flag ||
    userOrPlayer?.countryFlag ||
    countryToFlag(userOrPlayer?.nationality || userOrPlayer?.country)
  );
}

function getPlayerPhoto(userOrPlayer) {
  return getPlayerPhotoField(userOrPlayer) || "graphics/logoWoText.png";
}

function renderKnownPlayerCard({ side, name, flag, photo }) {
  const slot = side === 1 ? els.setupPlayerOneSlot : els.setupPlayerTwoSlot;
  const imageSrc = photo || "graphics/logoWoText.png";
  const flagText = flag || "🌍";

  slot.className = `setupPlayerSlot selectedPlayerSlot playerSide${side}`;

  slot.innerHTML = side === 1
    ? `
      <span class="setupPlayerFlag">${flagText}</span>
      <strong class="setupSelectedName">${name}</strong>
      <img class="setupSelectedPhoto" src="${imageSrc}" alt="${name}">
    `
    : `
      <img class="setupSelectedPhoto" src="${imageSrc}" alt="${name}">
      <strong class="setupSelectedName">${name}</strong>
      <span class="setupPlayerFlag">${flagText}</span>
    `;
}

function renderInputPlayerSlot(side, value = "") {
  const slot = side === 1 ? els.setupPlayerOneSlot : els.setupPlayerTwoSlot;
  const inputId = side === 1 ? "guestPlayerOneName" : "guestPlayerTwoName";

  slot.className = "setupPlayerSlot inputPlayerSlot";
  slot.innerHTML = `
    <input id="${inputId}" type="text" placeholder="Enter name" value="${value}">
  `;

  els.guestPlayerOneName = document.getElementById("guestPlayerOneName");
  els.guestPlayerTwoName = document.getElementById("guestPlayerTwoName");

  els.guestPlayerOneName?.addEventListener("input", renderSetupPlayers);
  els.guestPlayerTwoName?.addEventListener("input", renderSetupPlayers);
}

function renderInvitePlayerSlot() {
  els.setupPlayerTwoSlot.className = "setupPlayerSlot invitePlayerSlot playerSide2";
  els.setupPlayerTwoSlot.innerHTML = `
    <button id="inviteOpponentSetupBtn" type="button" class="inviteOpponentSetupBtn">
      Invite +
    </button>
  `;

  els.guestPlayerTwoName = null;
  els.inviteOpponentSetupBtn = document.getElementById("inviteOpponentSetupBtn");

  els.inviteOpponentSetupBtn?.addEventListener("click", () => {
    els.setupPlayerErrorMsg?.classList.add("hidden");
    openOpponentModal();
  });
}

function pickField(obj, keys) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null && String(obj[key]).trim()) {
      return String(obj[key]).trim();
    }
  }
  return "";
}

function getPlayerNationality(player) {
  return pickField(player, ["nationality", "Nationality"]);
}

function normalisePhotoUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  const match = value.match(/\/file\/d\/([^/]+)/);
  if (match?.[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w300`;
  }

  return value;
}

function getPlayerPhotoField(player) {
  return normalisePhotoUrl(
    pickField(player, [
      "photo",
      "photoUrl",
      "PhotoUrl",
      "photoURL",
      "imageUrl",
      "Photo",
      "Photo URL"
    ])
  );
}

function renderSetupPlayerCards() {
  const isOnline = MATCH_MODE === "online";
  const isLoggedIn = Boolean(loggedInUser);
  const match = window.currentOnlineMatch;

  if (!isLoggedIn) {
    renderInputPlayerSlot(1, els.setupPlayerOneName.value === "Player 1" ? "" : els.setupPlayerOneName.value);
    renderInputPlayerSlot(2, els.setupPlayerTwoName.value === "Player 2" ? "" : els.setupPlayerTwoName.value);
    els.removeSetupPlayerOneBtn?.classList.add("hidden");
    els.removeSetupPlayerTwoBtn?.classList.add("hidden");
    return;
  }

  if (isOnline && match) {
    console.log("[RENDER ONLINE PLAYER CARDS MATCH]", {
      hostName: match.hostName,
      hostPhoto: match.hostPhoto,
      hostNationality: match.hostNationality,
      guestName: match.guestName,
      guestPhoto: match.guestPhoto,
      guestNationality: match.guestNationality,
      fullMatch: match
    });
    MATCH_MODE = "online";

    renderKnownPlayerCard({
      side: 1,
      name: match.hostName || "Player 1",
      flag: countryToFlag(match.hostNationality),
      photo: match.hostPhoto || "graphics/logoWoText.png"
    });

    renderKnownPlayerCard({
      side: 2,
      name: match.guestName || "Player 2",
      flag: countryToFlag(match.guestNationality),
      photo: match.guestPhoto || "graphics/logoWoText.png"
    });

    els.removeSetupPlayerOneBtn?.classList.add("hidden");
    els.removeSetupPlayerTwoBtn?.classList.remove("hidden");
    return;
  }

  renderKnownPlayerCard({
    side: 1,
    name: getLoggedInFullName(loggedInUser),
    flag: getPlayerFlag(loggedInUser),
    photo: getPlayerPhoto(loggedInUser)
  });

  els.removeSetupPlayerOneBtn?.classList.toggle("hidden", isOnline);

  if (isOnline) {
    renderInvitePlayerSlot();
    els.removeSetupPlayerTwoBtn?.classList.add("hidden");
    return;
  }

  renderInputPlayerSlot(2, els.guestPlayerTwoName?.value || "");
  els.removeSetupPlayerTwoBtn?.classList.remove("hidden");
}

els.removeSetupPlayerOneBtn?.addEventListener("click", () => {
  if (MATCH_MODE === "online") return;

  els.setupPlayerOneName.value = "Player 1";
  renderSetupPlayerCards();
});

els.removeSetupPlayerTwoBtn?.addEventListener("click", () => {
  if (MATCH_MODE === "online" && onlineMatchId) {
    leaveOnlineMatch("cancelled");
    return;
  }

  els.setupPlayerTwoName.value = "Player 2";
  renderSetupPlayerCards();
});

function getPresenceKey(userOrPlayer) {
  return getLeagueUserKey(userOrPlayer);
}

function toggleScorerFullscreen() {
  unlockDartAudio();

  if (document.body.classList.contains("scorer-fullscreen")) {
    exitScorerFullscreen();
  } else {
    enterScorerFullscreen();
  }
}

els.fullscreenBtn?.addEventListener("click", toggleScorerFullscreen);



async function initDartScorerAuth() {
  console.log("[DART DEBUG] initDartScorerAuth started");
  console.log("[DART DEBUG] ONMLiveDarts available:", !!window.ONMLiveDarts);
  console.log("[DART DEBUG] ONMSession available:", !!window.ONMSession);

  els.setupCard?.classList.remove("hidden");

  let user = null;

  if (window.ONMSession?.init) {
    user = await window.ONMSession.init();
  } else {
    const savedUser = localStorage.getItem("onmUser");
    user = savedUser ? JSON.parse(savedUser) : null;
  }

  console.log("[DART DEBUG] session user:", user);

  if (!user) {
    loggedInUser = null;

    updateLeaguePlayButton();
    updateSetupPlayerMode();

    console.warn("[DART DEBUG] No user, invite listener NOT started");
    return;
  }

  loggedInUser = user;

  updateLeaguePlayButton();

  const myKey = getCurrentPlayerKey();

  console.log("[DART DEBUG] setting presence for:", myKey);

  window.ONMLiveDarts?.setPlayerPresence?.({
    ...user,
    linkedPlayerKey: myKey,
    playerKey: myKey,
    fullName: getLoggedInFullName(user),
    playerName: getLoggedInFullName(user)
  });

  updateSetupPlayerMode();

  await loadLoggedInPlayer(user);

  console.log("[DART DEBUG] starting invite listener now");
  listenForDartInvites();

  console.log("[DART DEBUG] restoring session now");
  const restoredOnlineGame = await restoreOnlineSession();

  if (!restoredOnlineGame) {
    initialisePageModeView();
  }

  console.log("[DART DEBUG] initDartScorerAuth complete");
}

let activeDartInvite = null;

function listenForDartInvites() {
  const user = window.ONMSession?.getUser?.() || loggedInUser;

  console.log("[DART DEBUG] listenForDartInvites called");
  console.log("[DART DEBUG] listener user:", user);
  const myKey = getCurrentPlayerKey();

  console.log("[DART DEBUG] listener key:", myKey);

  if (!myKey || !window.ONMLiveDarts) {
    console.error("[DART DEBUG] Cannot start invite listener", {
      linkedPlayerKey: user?.linkedPlayerKey,
      hasONMLiveDarts: !!window.ONMLiveDarts
    });
    return;
  }

  const { db, ref, onValue, query, orderByChild, equalTo } = window.ONMLiveDarts;

  const invitesQuery = query(
    ref(db, "dartInvites"),
    orderByChild("toPlayerKey"),
    equalTo(myKey)
  );

  console.log("[DART DEBUG] Firebase invite listener attached for toPlayerKey:", myKey);

  onValue(invitesQuery, snapshot => {
    console.log("[DART DEBUG] invite listener fired. exists:", snapshot.exists());
    console.log("[DART DEBUG] invite snapshot value:", snapshot.val());

    if (!snapshot.exists()) return;

    snapshot.forEach(child => {
      const invite = child.val();

      console.log("[DART DEBUG] invite child:", child.key, invite);

      if (invite.status !== "pending") return;
      if (activeDartInvite?.inviteId === invite.inviteId) return;

      activeDartInvite = invite;

      const inviteText =
        invite.inviteText ||
        `${invite.fromName} has invited you to a ${invite.statsMode === "competitive" ? "competitive leaderboard" : "casual"} BO${invite.legsCount || 3} game.`;

      els.dartInviteText.textContent = inviteText;

      els.dartInviteOverlay.classList.remove("hidden");
      els.dartInviteOverlay.setAttribute("aria-hidden", "false");
      playInstantDartSfx("notification.mp3");

      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }

      console.log("[DART DEBUG] invite overlay shown");
    });
  }, error => {
    console.error("[DART DEBUG] invite listener Firebase error:", error);
  });
}

async function acceptDartInvite(invite) {
  const matchId = await window.ONMLiveDarts.createOnlineMatchFromInvite(invite, {
    startScore: Number(invite.startScore || invite.settings?.startScore || 501),
    gameType: invite.gameType || invite.settings?.gameType || "bestOf",
    legsCount: Number(invite.legsCount || invite.settings?.legsCount || 3),
    inMode: invite.inMode || invite.settings?.inMode || "straight"
  });

  onlineInviteAccepted = true;
  onlineInviteId = invite.inviteId;
  onlineMatchId = matchId;
  onlineRole = "guest";
  saveOnlineSession();

  MATCH_MODE = "online";
  STATS_MODE = invite.statsMode || "casual";
  window.STATS_MODE = STATS_MODE;

  competitiveLobbyMode = invite.statsMode === "competitive";
  competitiveLegsCount = Number(invite.legsCount || 3);

  STARTING_SCORE = Number(invite.startScore || 501);
  GAME_TYPE = invite.gameType || "bestOf";
  IN_MODE = invite.inMode || "straight";

  els.setupPlayerTwoName.value = invite.fromName || "Player 2";

  if (els.guestPlayerTwoName) {
    els.guestPlayerTwoName.value = invite.fromName || "Player 2";
  }

  listenToOnlineMatch(matchId);

  const { db, ref, update } = window.ONMLiveDarts;

  await update(ref(db, `onlineMatches/${matchId}`), {
    status: "readyLobby",
    [`ready/${getCurrentPlayerKey()}`]: false
  });

  updateSetupPlayerMode();

  console.log("Invite accepted, match created:", matchId);
}

async function declineDartInvite(invite) {
  const { db, ref, update } = window.ONMLiveDarts;

  await update(ref(db, `dartInvites/${invite.inviteId}`), {
    status: "declined",
    declinedAt: Date.now()
  });

  console.log("Invite declined:", invite.inviteId);
}

els.acceptDartInviteBtn?.addEventListener("click", async () => {
  unlockDartAudio();
  if (!activeDartInvite) return;

  await acceptDartInvite(activeDartInvite);

  els.dartInviteOverlay.classList.add("hidden");
  els.dartInviteOverlay.setAttribute("aria-hidden", "true");

  activeDartInvite = null;
});

els.declineDartInviteBtn?.addEventListener("click", async () => {
  if (!activeDartInvite) return;

  await declineDartInvite(activeDartInvite);

  els.dartInviteOverlay.classList.add("hidden");
  els.dartInviteOverlay.setAttribute("aria-hidden", "true");

  activeDartInvite = null;
});

async function startOnlineMatchDecider() {
  if (!onlineMatchId || onlineRole !== "host") return;

  const { db, ref, update, get } = window.ONMLiveDarts;

  const matchSnap = await get(ref(db, `onlineMatches/${onlineMatchId}`));
  if (!matchSnap.exists()) return;

  const match = matchSnap.val();
  const isCompetitive = match.statsMode === "competitive";

  const settings = {
    status: "decider",
    "settings/startScore": isCompetitive ? 501 : STARTING_SCORE,
    "settings/gameType": "bestOf",
    "settings/legsCount": isCompetitive ? Number(match.settings?.legsCount || competitiveLegsCount || 3) : Number(els.legsCount.textContent),
    "settings/inMode": isCompetitive ? "straight" : IN_MODE,
    startedDeciderAt: Date.now()
  };

  if (isCompetitive) {
    const coinWinnerIndex = Math.random() < 0.5 ? 0 : 1;
    const keys = onlinePlayerKeys(match);

    settings["decider/type"] = "coin";
    settings["decider/status"] = "chosen";
    settings["decider/coinWinnerKey"] = keys[coinWinnerIndex];
    settings["decider/coinWinnerIndex"] = coinWinnerIndex;
  }

  await update(ref(db, `onlineMatches/${onlineMatchId}`), settings);
}

async function startOnlinePlaying(startingIndex) {
  if (!onlineMatchId) return;

  const { db, ref, update, get, setPresenceStatus } = window.ONMLiveDarts;

  const matchSnap = await get(ref(db, `onlineMatches/${onlineMatchId}`));
  if (!matchSnap.exists()) return;

  const match = matchSnap.val();
  const keys = onlinePlayerKeys(match);
  const startingKey = keys[startingIndex];

  const startScore = Number(match.settings?.startScore || 501);

  await update(ref(db, `onlineMatches/${onlineMatchId}`), {
    status: "playing",
    "game/currentPlayerKey": startingKey,
    [`game/players/${keys[0]}/score`]: startScore,
    [`game/players/${keys[1]}/score`]: startScore,
    startedAt: Date.now()
  });

  await setPresenceStatus?.(match.hostPlayerKey, "playing");
  await setPresenceStatus?.(match.guestPlayerKey, "playing");
}

function resetOnlineLobbyState() {
  onlineInviteAccepted = false;
  onlineInviteId = null;
  onlineMatchId = null;
  onlineRole = null;
  lastOnlineStatus = null;
  onlineDeciderOpened = false;
  onlineCoinStarted = false;
  onlineBullSubmitted = false;

  MATCH_MODE = "local";
  STATS_MODE = "casual";
  window.STATS_MODE = STATS_MODE;

  els.setupPlayerTwoName.value = "Player 2";
  if (els.guestPlayerTwoName) {
    els.guestPlayerTwoName.value = "";
    els.guestPlayerTwoName.disabled = false;
  }

  setTogglePosition(
    els.matchModeSwitch,
    document.querySelector('#matchModeSwitch .toggleBtn[data-match-mode="local"]')
  );

  setTogglePosition(
    els.statsModeSwitch,
    document.querySelector('#statsModeSwitch .toggleBtn[data-stats-mode="casual"]')
  );

  window.currentOnlineMatch = null;
  updateSetupPlayerMode();
  clearOnlineSession();
}

async function exitCompletedOnlineMatch() {
  const completedMatchId = onlineMatchId;

  const myKey = getCurrentPlayerKey();

  if (myKey && window.ONMLiveDarts?.setPresenceStatus) {
    await window.ONMLiveDarts.setPresenceStatus(myKey, "online");
  }

  if (completedMatchId && window.ONMLiveDarts) {
    const { db, ref, update } = window.ONMLiveDarts;

    await update(ref(db, `onlineMatches/${completedMatchId}`), {
      status: "closed",
      closedAt: Date.now()
    });
  }

  onlineInviteAccepted = false;
  onlineInviteId = null;
  onlineMatchId = null;
  onlineRole = null;
  lastOnlineStatus = null;
  onlineDeciderOpened = false;
  onlineCoinStarted = false;
  onlineBullSubmitted = false;
  onlineResultSaved = false;

  clearOnlineSession();

  window.currentOnlineMatch = null;

  MATCH_MODE = "local";
  STATS_MODE = "casual";
  window.STATS_MODE = STATS_MODE;

  els.setupPlayerTwoName.value = "Player 2";

  if (els.guestPlayerTwoName) {
    els.guestPlayerTwoName.value = "";
    els.guestPlayerTwoName.disabled = false;
  }

  newGame();

  els.scorerCard.classList.add("hidden");
  els.startDeciderScreen.classList.add("hidden");
  els.setupCard.classList.remove("hidden");

  setTogglePosition(
    els.matchModeSwitch,
    document.querySelector('#matchModeSwitch .toggleBtn[data-match-mode="local"]')
  );

  updateSetupPlayerMode();

  if (window.innerWidth < 500) {
    exitScorerFullscreen();
  }
}

function listenToOnlineMatch(matchId) {
  const { db, ref, onValue } = window.ONMLiveDarts;
  const myKey = getCurrentPlayerKey();
  if (!myKey) return;

  const matchRef = ref(db, `onlineMatches/${matchId}`);

  onValue(matchRef, snapshot => {
    if (!snapshot.exists()) return;

    const match = snapshot.val();
    window.currentOnlineMatch = match;

    if (["left", "cancelled", "closed"].includes(match.status)) {
      const myKey = getCurrentPlayerKey();

      if (match.leftByKey && match.leftByKey !== myKey) {
        const leftName =
          match.leftByKey === match.hostPlayerKey
            ? match.hostName
            : match.guestName;

        showOnlineNotice(`${leftName} has left the game.`);
      }

      onlineInviteAccepted = false;
      onlineInviteId = null;
      onlineMatchId = null;
      onlineRole = null;
      lastOnlineStatus = null;
      onlineDeciderOpened = false;
      onlineCoinStarted = false;
      onlineBullSubmitted = false;

      clearOnlineSession();
      window.currentOnlineMatch = null;

      MATCH_MODE = "online";
      STATS_MODE = "competitive";
      window.STATS_MODE = STATS_MODE;

      newGame();

      els.scorerCard?.classList.add("hidden");
      els.startDeciderScreen?.classList.add("hidden");
      els.competitiveReadyOverlay?.classList.add("hidden");
      els.setupCard?.classList.add("hidden");

      fullyStopDartAudio();
      syncMainViews("leaderboard");
      loadLeaderboard();

      if (window.innerWidth < 500) {
        exitScorerFullscreen();
      }

      return;
    }

    if (lastOnlineStatus !== match.status) {
      lastOnlineStatus = match.status;

      if (match.status === "decider") {
        onlineDeciderOpened = false;
        onlineCoinStarted = false;
        onlineBullSubmitted = false;
      }

      if (match.status === "playing") {
        closeStartDecider();
      }
    }

    if (match.status === "complete") {
      applyOnlineGame(match);

      const keys = onlinePlayerKeys(match);
      state.winnerIndex = match.winnerKey === keys[0] ? 0 : 1;

      els.submit.disabled = true;
      els.keypad.classList.add("disabled");
      els.onlineTurnOverlay?.classList.add("hidden");

      if (molVictoryShownForMatchId !== match.matchId) {
        molVictoryShownForMatchId = match.matchId;

        setTimeout(() => {
          openMolVictoryScreen(buildMatchStatsData());
          applyMolRematchState(match);
        }, 700);
      } else {
        applyMolRematchState(match);
      }

      const hostRematch = Boolean(match.rematch?.[match.hostPlayerKey]);
      const guestRematch = Boolean(match.rematch?.[match.guestPlayerKey]);

      const rematchAlreadyStartedForThisResult =
        match.rematchStartedForCompletedAt &&
        match.rematchStartedForCompletedAt === match.completedAt;

      if (
        hostRematch &&
        guestRematch &&
        !rematchAlreadyStartedForThisResult &&
        !rematchStarting
      ) {
        rematchStarting = true;
        startOnlineRematch(match);
      }

      return;
    }

    if (match.status === "readyLobby") {
      rematchStarting = false;
      molVictoryShownForMatchId = null;

      els.molVictoryOverlay?.classList.add("hidden");
      els.scorerCard?.classList.add("hidden");
      els.setupCard?.classList.add("hidden");

      applyReadyLobby(match);
    }

    if (match.status === "lobby") {
      applyOnlineLobby(match);
    }

    if (match.status === "decider") {
      applyOnlineDecider(match);
    }

    if (match.status === "playing") {
      applyOnlineGame(match);
    }

    const opponentKey =
      myKey === match.hostPlayerKey
        ? match.guestPlayerKey
        : match.hostPlayerKey;

    if (match.presence && match.presence[opponentKey] === false) {
      showOnlineNotice(`${match.game?.players?.[opponentKey]?.name || "Your opponent"} has left the match.`);
    }
  });
}

function getReadyPlayerRating(playerKey) {
  return window.currentLeaderboardPlayers?.find(p => p.playerKey === playerKey) || {};
}

function getReadyPlayerRank(playerKey) {
  const index = window.currentLeaderboardPlayers?.findIndex(p => p.playerKey === playerKey);
  return index >= 0 ? index + 1 : "-";
}

function applyReadyLobby(match) {
  syncMainViews("readyLobby");

  applyMatchSettings(match.settings);

  const legsCount = Number(match.settings?.legsCount || 3);

  els.readyMatchTitle.textContent = `501 · Best of ${legsCount}`;

  els.readyHostName.innerHTML = `${match.hostName || "Player 1"} <span class="readyNameFlag">${countryToFlag(match.hostNationality)}</span>`;
  els.readyGuestName.innerHTML = `${match.guestName || "Player 2"} <span class="readyNameFlag">${countryToFlag(match.guestNationality)}</span>`;

  els.readyHostPhoto.src = match.hostPhoto || "graphics/logoWoText.png";
  els.readyGuestPhoto.src = match.guestPhoto || "graphics/logoWoText.png";

  els.readyHostFlag.textContent = "";
  els.readyGuestFlag.textContent = "";

  const hostRating = getReadyPlayerRating(match.hostPlayerKey);
  const guestRating = getReadyPlayerRating(match.guestPlayerKey);

  els.readyHostRank.textContent = `Rank ${getReadyPlayerRank(match.hostPlayerKey)}`;
  els.readyGuestRank.textContent = `Rank ${getReadyPlayerRank(match.guestPlayerKey)}`;

  els.readyHostRating.textContent = hostRating.gamesPlayed ? `Rating ${hostRating.rating}` : "Rating -";
  els.readyGuestRating.textContent = guestRating.gamesPlayed ? `Rating ${guestRating.rating}` : "Rating -";

  const ready = match.ready || {};
  const hostReady = Boolean(ready[match.hostPlayerKey]);
  const guestReady = Boolean(ready[match.guestPlayerKey]);

  els.readyHostStatus.textContent = hostReady ? "Ready ✓" : "Pending";
  els.readyGuestStatus.textContent = guestReady ? "Ready ✓" : "Pending";

  els.readyHostStatus.classList.toggle("ready", hostReady);
  els.readyGuestStatus.classList.toggle("ready", guestReady);
  els.readyHostStatus.classList.toggle("pending", !hostReady);
  els.readyGuestStatus.classList.toggle("pending", !guestReady);

  const myKey = getCurrentPlayerKey();
  const amReady = Boolean(ready[myKey]);

  els.markReadyBtn.textContent = amReady ? "Ready ✓" : "Ready";
  els.markReadyBtn.disabled = amReady;

  if (hostReady && guestReady && onlineRole === "host") {
    startOnlineCoinOnlyDecider();
  }
}

async function startOnlineRematch(match) {
  const matchId = getOnlineMatchId();

  if (!matchId || !window.ONMLiveDarts) return;

  const { db, ref, update } = window.ONMLiveDarts;
  const keys = onlinePlayerKeys(match);
  const startScore = Number(match.settings?.startScore || 501);

  await update(ref(db, `onlineMatches/${matchId}`), {
    status: "readyLobby",
    rematchStartedAt: Date.now(),
    rematchStartedForCompletedAt: match.completedAt || Date.now(),

    winnerKey: null,
    winnerName: null,
    loserKey: null,
    loserName: null,
    completedAt: null,

    rematch: null,
    resultPresence: null,
    resultPresenceUpdatedAt: null,

    ready: {
      [match.hostPlayerKey]: false,
      [match.guestPlayerKey]: false
    },

    decider: null,

    [`game/currentPlayerKey`]: null,
    [`game/lastCallout`]: null,

    [`game/players/${keys[0]}/score`]: startScore,
    [`game/players/${keys[0]}/legs`]: 0,
    [`game/players/${keys[0]}/totalScored`]: 0,
    [`game/players/${keys[0]}/dartsThrown`]: 0,
    [`game/players/${keys[0]}/lastScore`]: null,
    [`game/players/${keys[0]}/checkoutHits`]: 0,
    [`game/players/${keys[0]}/checkoutAttempts`]: 0,
    [`game/players/${keys[0]}/highestOut`]: 0,
    [`game/players/${keys[0]}/highScore`]: 0,
    [`game/players/${keys[0]}/oneEightys`]: 0,
    [`game/players/${keys[0]}/bullOuts`]: 0,
    [`game/players/${keys[0]}/legDarts`]: [],
    [`game/players/${keys[0]}/currentLegDarts`]: 0,
    [`game/players/${keys[0]}/firstNineScored`]: 0,
    [`game/players/${keys[0]}/firstNineDarts`]: 0,
    [`game/players/${keys[0]}/currentLegFirstNineScored`]: 0,
    [`game/players/${keys[0]}/currentLegFirstNineDarts`]: 0,

    [`game/players/${keys[1]}/score`]: startScore,
    [`game/players/${keys[1]}/legs`]: 0,
    [`game/players/${keys[1]}/totalScored`]: 0,
    [`game/players/${keys[1]}/dartsThrown`]: 0,
    [`game/players/${keys[1]}/lastScore`]: null,
    [`game/players/${keys[1]}/checkoutHits`]: 0,
    [`game/players/${keys[1]}/checkoutAttempts`]: 0,
    [`game/players/${keys[1]}/highestOut`]: 0,
    [`game/players/${keys[1]}/highScore`]: 0,
    [`game/players/${keys[1]}/oneEightys`]: 0,
    [`game/players/${keys[1]}/bullOuts`]: 0,
    [`game/players/${keys[1]}/legDarts`]: [],
    [`game/players/${keys[1]}/currentLegDarts`]: 0,
    [`game/players/${keys[1]}/firstNineScored`]: 0,
    [`game/players/${keys[1]}/firstNineDarts`]: 0,
    [`game/players/${keys[1]}/currentLegFirstNineScored`]: 0,
    [`game/players/${keys[1]}/currentLegFirstNineDarts`]: 0
  });

  molVictoryShownForMatchId = null;
  rematchStarting = false;
  onlineCoinStarted = false;
  onlineDeciderOpened = false;

  els.molVictoryOverlay?.classList.add("hidden");
}

async function startOnlineCoinOnlyDecider() {
  if (!onlineMatchId || onlineRole !== "host") return;

  const { db, ref, get, update } = window.ONMLiveDarts;
  const matchSnap = await get(ref(db, `onlineMatches/${onlineMatchId}`));
  if (!matchSnap.exists()) return;

  const match = matchSnap.val();
  if (match.status !== "readyLobby") return;

  const coinWinnerIndex = Math.random() < 0.5 ? 0 : 1;
  const keys = onlinePlayerKeys(match);

  await update(ref(db, `onlineMatches/${onlineMatchId}`), {
    status: "decider",
    "decider/type": "coin",
    "decider/status": "chosen",
    "decider/coinWinnerKey": keys[coinWinnerIndex],
    "decider/coinWinnerIndex": coinWinnerIndex,
    startedDeciderAt: Date.now()
  });
}

function openOnlineCoinDecider(match) {
  if (onlineCoinStarted) return;
  onlineCoinStarted = true;

  els.coinDeciderView.classList.remove("hidden");
  els.bullDeciderView.classList.add("hidden");

  const winnerIndex = match.decider.coinWinnerIndex ?? 0;
  const loserIndex = winnerIndex === 0 ? 1 : 0;

  els.coinBtn.disabled = true;
  els.coinBtn.classList.remove("coinLandsBack");
  els.coinBtn.classList.add("coinFlipping");
  els.coinResultText.textContent = "Tossing...";
  playDartCallout("coin-flip.mp3");

  setTimeout(async () => {
    els.coinBtn.classList.remove("coinFlipping");
    els.coinBtn.innerHTML = getCoinMarkup(winnerIndex);

    if (winnerIndex === 1) {
      els.coinBtn.classList.add("coinLandsBack");
    }

    els.coinPlayerOneBox.classList.toggle("won", winnerIndex === 0);
    els.coinPlayerOneBox.classList.toggle("lost", loserIndex === 0);
    els.coinPlayerTwoBox.classList.toggle("won", winnerIndex === 1);
    els.coinPlayerTwoBox.classList.toggle("lost", loserIndex === 1);

    els.coinPlayerOneStatus.textContent = winnerIndex === 0 ? "Won" : "Lost";
    els.coinPlayerTwoStatus.textContent = winnerIndex === 1 ? "Won" : "Lost";

    els.coinResultText.textContent = "Coin toss complete";
    els.coinWinnerText.textContent = `${winnerIndex === 0 ? match.hostName : match.guestName} throws first`;
    const keys = onlinePlayerKeys(match);
    announceGameOn();

    if (onlineRole === "host") {
      setTimeout(() => {
        startOnlinePlaying(winnerIndex);
      }, 2500);
    }
  }, 2200);
}

async function restoreOnlineSession() {
  const saved = localStorage.getItem(ONLINE_SESSION_KEY);
  if (!saved || !window.ONMLiveDarts) return;

  let session = null;

  try {
    session = JSON.parse(saved);
  } catch {
    clearOnlineSession();
    return false;
  }

  if (!session?.matchId || !session?.role) {
    clearOnlineSession();
    return false;
  }

  const { db, ref, get, update } = window.ONMLiveDarts;
  const matchSnap = await get(ref(db, `onlineMatches/${session.matchId}`));

  if (!matchSnap.exists()) {
    clearOnlineSession();
    return false;
  }

  const match = matchSnap.val();

  if (["left", "cancelled"].includes(match.status)) {
    clearOnlineSession();
    return false;
  }

  onlineInviteAccepted = true;
  onlineInviteId = session.inviteId || null;
  onlineMatchId = session.matchId;
  onlineRole = session.role;
  MATCH_MODE = "online";
  STATS_MODE = match.statsMode || "casual";

  const myKey = getCurrentPlayerKey();

  await update(ref(db, `onlineMatches/${onlineMatchId}`), {
    [`presence/${myKey}`]: true
  });

  listenToOnlineMatch(onlineMatchId);
  updateSetupPlayerMode();

  return true;
}

async function leaveOnlineMatch(reason = "left") {
  fullyStopDartAudio();
  if (!onlineMatchId || !window.ONMLiveDarts) return;

  const { db, ref, update, remove, setPresenceStatus } = window.ONMLiveDarts;
  const myKey = getCurrentPlayerKey();

  if (myKey && window.ONMLiveDarts?.setPresenceStatus) {
    await window.ONMLiveDarts.setPresenceStatus(myKey, "online");
  }

  const matchToRemove = onlineMatchId;

  await update(ref(db, `onlineMatches/${onlineMatchId}`), {
    status: reason,
    leftByKey: myKey,
    leftAt: Date.now(),
    [`presence/${myKey}`]: false
  });

  await setPresenceStatus?.(myKey, "online");

  setTimeout(async () => {
    await remove(ref(db, `onlineMatches/${matchToRemove}`));
  }, 5000);

  resetOnlineLobbyState();
}

async function openOnlineBullDecider(match) {
  els.bullDeciderView.classList.remove("hidden");
  els.coinDeciderView.classList.add("hidden");

  const myKey = getCurrentPlayerKey();
  const myIndex = getMyOnlineIndex(match);
  const throws = match.decider?.bullThrows || {};

  const hostThrown = Boolean(throws[match.hostPlayerKey]);
  const guestThrown = Boolean(throws[match.guestPlayerKey]);
  const myThrown = Boolean(throws[myKey]);
  const bothThrown = hostThrown && guestThrown;

  els.bullPlayerOneName.textContent = match.hostName;
  els.bullPlayerTwoName.textContent = match.guestName;

  els.bullPlayerOneStatus.textContent = hostThrown ? "Throw complete" : "Throwing";
  els.bullPlayerTwoStatus.textContent = guestThrown ? "Throw complete" : "Throwing";

  els.bullPlayerOneBox.classList.toggle("active", myIndex === 0 && !myThrown);
  els.bullPlayerTwoBox.classList.toggle("active", myIndex === 1 && !myThrown);

  const myPendingThrow = pendingBullThrow && pendingBullThrow.playerIndex === myIndex
    ? pendingBullThrow
    : null;

  els.bullBoard.innerHTML = "";

  if (myThrown && !bothThrown) {
    const myThrow = throws[myKey];
    const marker = document.createElement("span");
    marker.className = "bullMarker";
    marker.style.left = `${myThrow.x}px`;
    marker.style.top = `${myThrow.y}px`;
    marker.textContent = getInitial(myIndex === 0 ? match.hostName : match.guestName);
    els.bullBoard.appendChild(marker);
  }

  if (bothThrown) {
    const hostMarker = document.createElement("span");
    hostMarker.className = "bullMarker";
    hostMarker.style.left = `${throws[match.hostPlayerKey].x}px`;
    hostMarker.style.top = `${throws[match.hostPlayerKey].y}px`;
    hostMarker.textContent = getInitial(match.hostName);
    els.bullBoard.appendChild(hostMarker);

    const guestMarker = document.createElement("span");
    guestMarker.className = "bullMarker";
    guestMarker.style.left = `${throws[match.guestPlayerKey].x}px`;
    guestMarker.style.top = `${throws[match.guestPlayerKey].y}px`;
    guestMarker.textContent = getInitial(match.guestName);
    els.bullBoard.appendChild(guestMarker);
  }

  if (!myThrown && myPendingThrow) {
    const pendingMarker = document.createElement("span");
    pendingMarker.className = "bullMarker pending";
    pendingMarker.dataset.playerIndex = myIndex;
    pendingMarker.style.left = `${myPendingThrow.x}px`;
    pendingMarker.style.top = `${myPendingThrow.y}px`;
    pendingMarker.textContent = getInitial(
      myIndex === 0 ? match.hostName : match.guestName
    );

    els.bullBoard.appendChild(pendingMarker);
  }

  if (myThrown && !bothThrown) {
    els.bullDeciderPrompt.textContent = "Waiting for opponent...";
    els.confirmBullThrowBtn.textContent = "Throw confirmed";
    els.confirmBullThrowBtn.disabled = true;
    els.confirmBullThrowBtn.classList.remove("hidden");
  } else if (!myThrown) {
    els.bullDeciderPrompt.textContent = "Tap where your dart landed";
    els.confirmBullThrowBtn.classList.toggle("hidden", !pendingBullThrow);
    els.confirmBullThrowBtn.disabled = false;
    els.confirmBullThrowBtn.textContent = "Confirm throw";
  }

  if (bothThrown) {
    els.confirmBullThrowBtn.classList.add("hidden");

    const hostDistance = throws[match.hostPlayerKey].distance;
    const guestDistance = throws[match.guestPlayerKey].distance;
    const winnerIndex = hostDistance <= guestDistance ? 0 : 1;

    showOnlineBullResult(match, winnerIndex);

    if (match.decider.status !== "complete") {
      launchDeciderFireworks(winnerIndex === 0 ? els.bullPlayerOneBox : els.bullPlayerTwoBox);
    }

    if (onlineRole === "host" && match.decider.status !== "complete") {
      const { db, ref, update } = window.ONMLiveDarts;

      await update(ref(db, `onlineMatches/${onlineMatchId}`), {
        "decider/status": "complete",
        "decider/winnerIndex": winnerIndex,
        "decider/winnerKey": winnerIndex === 0 ? match.hostPlayerKey : match.guestPlayerKey
      });

      setTimeout(() => {
        startOnlinePlaying(winnerIndex);
      }, 3000);
    }
  }
}

function applyOnlineDecider(match) {
  syncMainViews("decider");
  applyMatchSettings(match.settings);

  els.competitiveReadyOverlay?.classList.add("hidden");
  els.competitiveReadyOverlay?.setAttribute("aria-hidden", "true");

  els.names[0].value = firstNameOnly(match.hostName) || "Player 1";
  els.names[1].value = firstNameOnly(match.guestName) || "Player 2";

  els.bullPlayerOneName.textContent = match.hostName;
  els.bullPlayerTwoName.textContent = match.guestName;
  els.coinPlayerOneName.textContent = match.hostName;
  els.coinPlayerTwoName.textContent = match.guestName;

  updateLegTarget();
  els.gameTitleText.textContent = getGameTitle();
  state.matchStartedAt = new Date();

  if (!onlineDeciderOpened) {
    newGame();
    els.setupCard.classList.add("hidden");
    els.scorerCard.classList.add("hidden");
    openStartDecider();
    onlineDeciderOpened = true;
  }

  if (!match.decider?.type) {
    if (onlineRole === "guest") {
      showDeciderWaitingOverlay("Waiting for opponent to choose game...");
    }
    return;
  }

  hideDeciderWaitingOverlay();
  els.deciderChoiceView.classList.add("hidden");

  if (match.decider.type === "coin") {
    openOnlineCoinDecider(match);
    return;
  }

  if (match.decider.type === "bull") {
    openOnlineBullDecider(match).catch(err => {
      console.error("Could not open online bull decider:", err);
    });
  }
}

function getLinkedPlayerFullName(player) {
  return (
    player.fullName ||
    `${player.firstName || ""} ${player.surname || player.lastName || ""}`.trim() ||
    player.playerName ||
    "Player 2"
  );
}

function showDeciderWaitingOverlay(message) {
  let overlay = document.getElementById("deciderWaitingOverlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "deciderWaitingOverlay";
    overlay.className = "onlineTurnOverlay deciderWaitingOverlay";
    overlay.innerHTML = `
      <div class="onlineTurnBox">
        <span class="inlineSpinner"></span>
        <strong id="deciderWaitingText"></strong>
      </div>
    `;
    els.startDeciderScreen.querySelector(".deciderShell").appendChild(overlay);
  }

  document.getElementById("deciderWaitingText").textContent = message;
  overlay.classList.remove("hidden");
}

function hideDeciderWaitingOverlay() {
  document.getElementById("deciderWaitingOverlay")?.classList.add("hidden");
}

function applyOnlineLobby(match) {
  STARTING_SCORE = match.settings.startScore;
  GAME_TYPE = match.settings.gameType;
  IN_MODE = match.settings.inMode;
  STATS_MODE = match.statsMode;
  MATCH_MODE = "online";

  setTogglePosition(
    els.matchModeSwitch,
    document.querySelector('#matchModeSwitch .toggleBtn[data-match-mode="online"]')
  );

  els.setupPlayerOneName.value = match.hostName || "Player 1";
  els.setupPlayerTwoName.value = match.guestName || "Player 2";

  if (els.guestPlayerOneName) {
    els.guestPlayerOneName.value = match.hostName || "Player 1";
  }

  if (els.guestPlayerTwoName) {
    els.guestPlayerTwoName.value = match.guestName || "Player 2";
    els.guestPlayerTwoName.disabled = true;
  }

  if (els.inviteOpponentSetupBtn) {
    els.inviteOpponentSetupBtn.classList.add("hidden");
  }

  els.statsModeText.textContent =
    STATS_MODE === "competitive"
      ? "Stats/Data will be stored for this game."
      : "Stats/Data won't be stored for this game.";

  onlineInviteAccepted = true;

  preloadImage(match.hostPhoto);
  preloadImage(match.guestPhoto);
  renderSetupPlayerCards();

  if (onlineRole === "guest") {
    els.startScorerGameBtn.textContent = "Waiting for opponent";
    els.startScorerGameBtn.disabled = true;
    els.startScorerGameBtn.classList.add("btnWaiting");
    lockLobbySettings(true);
  } else {
    els.startScorerGameBtn.textContent = "Start game";
    els.startScorerGameBtn.disabled = false;
    els.startScorerGameBtn.classList.remove("btnWaiting");
    lockLobbySettings(false);
  }

  if (!lobbyCountdownInterval) {
    startLobbyCountdown(60);
  }
}

function applyOnlineGame(match) {
  applyMatchSettings(match.settings);
  syncMainViews("game");

  if (window.innerWidth < 500) {
    enterScorerFullscreen();
  }

  MATCH_MODE = "online";
  onlineMatchId = match.matchId || onlineMatchId;

  const keys = onlinePlayerKeys(match);
  const p1Key = keys[0];
  const p2Key = keys[1];

  const p1 = match.game.players[p1Key];
  const p2 = match.game.players[p2Key];

  setVisiblePlayerNames(p1.name, p2.name, true);

  state.players[0].score = p1.score;
  state.players[1].score = p2.score;

  state.players[0].legs = p1.legs || 0;
  state.players[1].legs = p2.legs || 0;

  state.players[0].lastScore = p1.lastScore ?? "-";
  state.players[1].lastScore = p2.lastScore ?? "-";

  state.players[0].dartsThrown = p1.dartsThrown || 0;
  state.players[1].dartsThrown = p2.dartsThrown || 0;

  state.players[0].totalScored = p1.totalScored || 0;
  state.players[1].totalScored = p2.totalScored || 0;

  state.players[0].highScore = p1.highScore || 0;
  state.players[1].highScore = p2.highScore || 0;

  state.players[0].currentLegDarts = p1.currentLegDarts || 0;
  state.players[1].currentLegDarts = p2.currentLegDarts || 0;

  state.players[0].checkoutHits = p1.checkoutHits || 0;
  state.players[1].checkoutHits = p2.checkoutHits || 0;

  state.players[0].checkoutAttempts = p1.checkoutAttempts || 0;
  state.players[1].checkoutAttempts = p2.checkoutAttempts || 0;

  state.players[0].highestOut = p1.highestOut || 0;
  state.players[1].highestOut = p2.highestOut || 0;

  state.players[0].oneEightys = p1.oneEightys || 0;
  state.players[1].oneEightys = p2.oneEightys || 0;

  state.players[0].bullOuts = p1.bullOuts || 0;
  state.players[1].bullOuts = p2.bullOuts || 0;

  state.players[0].legDarts = p1.legDarts || [];
  state.players[1].legDarts = p2.legDarts || [];

  state.currentPlayer = match.game.currentPlayerKey === p2Key ? 1 : 0;

  els.setupCard.classList.add("hidden");
  els.startDeciderScreen.classList.add("hidden");
  els.scorerCard.classList.remove("hidden");

  const myKey = getCurrentPlayerKey();
  const isMyTurn = match.game.currentPlayerKey === myKey;
  const throwingName = playerName(state.currentPlayer);

  els.turnMessage.textContent = `${throwingName}'s turn`;

  if (els.onlineTurnOverlay) {
    els.onlineTurnOverlay.innerHTML = `
    <div class="onlineTurnBox">
      <span class="inlineSpinner"></span>
      <strong>${throwingName} is throwing...</strong>
    </div>
  `;

    els.onlineTurnOverlay.classList.toggle("hidden", isMyTurn);
  }

  els.submit.disabled = !isMyTurn;
  els.keypad.classList.toggle("disabled", !isMyTurn);

  const lastCallout = match.game?.lastCallout;

  if (lastCallout?.id && lastCallout.id !== lastOnlineCalloutId) {
    lastOnlineCalloutId = lastCallout.id;
    lastOnlineCalloutAt = lastCallout.createdAt || null;
    playOnlineCallout(lastCallout);
  }
  render();
}

function playOnlineCallout(lastCallout) {
  clearDartAudioQueue();

  if (isDartAudioSuppressed()) return;

  if (lastCallout.type === "gameShot") {
    announceLegWon(false, Boolean(lastCallout.bullOut));
  } else if (lastCallout.type === "matchShot") {
    announceLegWon(true, Boolean(lastCallout.bullOut));

    if (lastCallout.winnerKey) {
      announceMatchResultForMe(lastCallout.winnerKey);
    }
  } else {
    announceVisitAndRequire(
      lastCallout.visitScore,
      lastCallout.requiredScore
    );

    if (lastCallout.finishHim) {
      playDartCallout("finish-him.mp3");
    }
  }
}

function lockLobbySettings(locked) {
  document
    .querySelectorAll("#matchModeSwitch button, #statsModeSwitch button, #bestFirstToggle button, #legsUpBtn, #legsDownBtn, #startScoreSwitch button, #inModeSwitch button")
    .forEach(btn => {
      btn.disabled = locked;
    });
}

function showOnlineNotice(message) {
  let overlay = document.getElementById("onlineNoticeOverlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "onlineNoticeOverlay";
    overlay.className = "modalOverlay";
    overlay.innerHTML = `
      <div class="modalCard">
        <div class="modalHeader">
          <div class="modalTitle">Online match</div>
        </div>
        <div class="modalBody">
          <p id="onlineNoticeText"></p>
          <button id="onlineNoticeOkBtn" type="button" class="btn btnPrimary">
            OK
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("onlineNoticeOkBtn").addEventListener("click", () => {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
    });
  }

  document.getElementById("onlineNoticeText").textContent = message;
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function showSetupMessage(message) {
  els.setupPlayerErrorMsg.textContent = message;
  els.setupPlayerErrorMsg.classList.remove("hidden");

  setTimeout(() => {
    els.setupPlayerErrorMsg.classList.add("hidden");
    els.playerTwoNameField.classList.remove("hasError");
  }, 2500);
}

function updateSetupPlayerMode() {
  const requiresLogin = MATCH_MODE === "online";

  if (requiresLogin && !loggedInUser) {
    els.guestPlayersSetup?.classList.add("hidden");
    els.loginRequiredSetup?.classList.remove("hidden");
    els.startScorerGameBtn.textContent = "Log in / Register";
    els.startScorerGameBtn.disabled = false;
    return;
  }

  els.loginRequiredSetup?.classList.add("hidden");
  els.guestPlayersSetup?.classList.remove("hidden");

  if (loggedInUser && onlineRole !== "guest") {
    els.setupPlayerOneName.value = getLoggedInFullName(loggedInUser);
  }

  if (onlineRole === "guest") {
    els.startScorerGameBtn.textContent = "Waiting for opponent";
    els.startScorerGameBtn.disabled = true;
    els.startScorerGameBtn.classList.add("waitingBtn");
    lockLobbySettings(true);
    renderSetupPlayerCards();
    return;
  }

  els.startScorerGameBtn.disabled = false;
  els.startScorerGameBtn.classList.remove("waitingBtn");
  els.startScorerGameBtn.textContent = "Start game";
  lockLobbySettings(false);

  renderSetupPlayerCards();
}

function preventFullscreenScroll(event) {
  if (!document.body.classList.contains("scorer-fullscreen")) return;

  if (
    event.target.closest(".keypad") ||
    event.target.closest("button") ||
    event.target.closest(".modalOverlay") ||
    event.target.closest(".checkoutOverlay")
  ) {
    return;
  }

  event.preventDefault();
}

document.addEventListener("touchmove", preventFullscreenScroll, { passive: false });

async function loadLoggedInPlayer(user) {
  console.log("[DART DEBUG] loadLoggedInPlayer user:", user);
  console.log("[DART DEBUG] guestPlayerOneName:", els.guestPlayerOneName);
  console.log("[DART DEBUG] setupPlayerOneName:", els.setupPlayerOneName);

  const displayName = getLoggedInFullName(user);

  if (PAGE_MODE === "casual") {
    els.setupCard?.classList.remove("hidden");
  } else {
    els.setupCard?.classList.add("hidden");
  }

  if (els.setupPlayerOneName) {
    els.setupPlayerOneName.value = displayName;
  } else {
    console.error("[DART DEBUG] Missing #setupPlayerOneName");
  }

  if (els.guestPlayerOneName) {
    els.guestPlayerOneName.value = displayName;
  } else {
    console.warn("[DART DEBUG] #guestPlayerOneName not currently in DOM yet. Skipping.");
  }

  if (PAGE_MODE === "casual") {
    MATCH_MODE = "local";
    STATS_MODE = "casual";
  } else {
    MATCH_MODE = "online";
    STATS_MODE = "competitive";
  }

  window.STATS_MODE = STATS_MODE;

  const localBtn = document.querySelector('#matchModeSwitch .toggleBtn[data-match-mode="local"]');
  const casualBtn = document.querySelector('#statsModeSwitch .toggleBtn[data-stats-mode="casual"]');

  console.log("[DART DEBUG] localBtn:", localBtn);
  console.log("[DART DEBUG] casualBtn:", casualBtn);

  const onlineBtn = document.querySelector('#matchModeSwitch .toggleBtn[data-match-mode="online"]');
  const competitiveBtn = document.querySelector('#statsModeSwitch .toggleBtn[data-stats-mode="competitive"]');

  if (PAGE_MODE === "casual") {
    if (localBtn) setTogglePosition(els.matchModeSwitch, localBtn);
    if (casualBtn) setTogglePosition(els.statsModeSwitch, casualBtn);
  } else {
    if (onlineBtn) setTogglePosition(els.matchModeSwitch, onlineBtn);
    if (competitiveBtn) setTogglePosition(els.statsModeSwitch, competitiveBtn);
  }

  if (els.statsModeText) {
    els.statsModeText.textContent = "Stats/Data won't be stored for this game.";
  }

  updateSetupPlayerMode();

  console.log("[DART DEBUG] loadLoggedInPlayer complete");
}

if (window.ONMLiveDarts) {
  initDartScorerAuth();
} else {
  window.addEventListener("onmLiveDartsReady", initDartScorerAuth, { once: true });
}

function syncMainViews(activeView) {
  const leaderboardView = document.getElementById("leaderboardView");

  els.setupCard?.classList.toggle("hidden", activeView !== "setup");
  els.scorerCard?.classList.toggle("hidden", activeView !== "game");
  els.startDeciderScreen?.classList.toggle("hidden", activeView !== "decider");
  leaderboardView?.classList.toggle("hidden", activeView !== "leaderboard");

  els.competitiveReadyOverlay?.classList.toggle("hidden", activeView !== "readyLobby");
  els.competitiveReadyOverlay?.setAttribute(
    "aria-hidden",
    activeView === "readyLobby" ? "false" : "true"
  );
}

function returnToCorrectDartHome() {
  const isMOLGame =
    MATCH_MODE === "online" ||
    STATS_MODE === "competitive" ||
    onlineMatchId;

  newGame();

  els.scorerCard?.classList.add("hidden");
  els.startDeciderScreen?.classList.add("hidden");
  els.competitiveReadyOverlay?.classList.add("hidden");

  if (isMOLGame) {
    els.setupCard?.classList.add("hidden");
    document.getElementById("leaderboardView")?.classList.remove("hidden");

    document.getElementById("leaderboardTabBtn")?.classList.add("active");
    document.getElementById("playTabBtn")?.classList.remove("active");

    loadLeaderboard();
  } else {
    document.getElementById("leaderboardView")?.classList.add("hidden");
    els.setupCard?.classList.remove("hidden");

    document.getElementById("playTabBtn")?.classList.add("active");
    document.getElementById("leaderboardTabBtn")?.classList.remove("active");
  }

  if (window.innerWidth < 500) {
    exitScorerFullscreen();
  }
}

function showPlayTab() {

  els.playTabBtn?.classList.add("active");
  els.leaderboardTabBtn?.classList.remove("active");

  if (!els.scorerCard?.classList.contains("hidden")) {
    syncMainViews("game");
    return;
  }

  if (!els.startDeciderScreen?.classList.contains("hidden")) {
    syncMainViews("decider");
    return;
  }

  fullyStopDartAudio();
  syncMainViews("setup");
}


function showLeaderboardTab() {
  document.getElementById("leaderboardView")
    ?.classList.remove("hidden");

  els.setupCard?.classList.add("hidden");
  els.scorerCard?.classList.add("hidden");
  els.startDeciderScreen?.classList.add("hidden");
  els.competitiveReadyOverlay?.classList.add("hidden");
  els.molVictoryOverlay?.classList.add("hidden");

  loadLeaderboard();
}

els.molVictoryCloseBtn?.addEventListener("click", () => {

  els.molVictoryOverlay?.classList.add("hidden");

  MATCH_MODE = "online";
  STATS_MODE = "competitive";

  fullyStopDartAudio();
  syncMainViews("leaderboard");

  loadLeaderboard();

  newGame();
});

document.getElementById("leaderboardPlayDockBtn")?.addEventListener("click", () => {
  const currentUser =
    window.ONMSession?.getUser?.() || loggedInUser;

  if (!currentUser) {
    window.location.href = "auth.html?mode=login&redirect=dart-scorer.html";
    return;
  }

  openCompetitiveInviteFlow();
});

document.querySelectorAll(".molStatsDot").forEach((dot, index) => {
  dot.addEventListener("click", () => {
    setMolStatsPage(index);
  });
});

function initialisePageModeView() {
  const title = document.getElementById("screenTitleText");

  if (PAGE_MODE === "casual") {
    if (title) title.textContent = "Casual Dart Scorer";

    MATCH_MODE = "local";
    STATS_MODE = "casual";
    window.STATS_MODE = STATS_MODE;

    fullyStopDartAudio();
    syncMainViews("setup");
    document.getElementById("leaderboardLoginPrompt")?.classList.add("hidden");

    updateSetupPlayerMode();
    return;
  }

  if (title) title.textContent = "Monsters Online League";

  MATCH_MODE = "online";
  STATS_MODE = "competitive";
  window.STATS_MODE = STATS_MODE;

  fullyStopDartAudio();
  syncMainViews("leaderboard");
  document.getElementById("leaderboardLoginPrompt")?.classList.add("hidden");

  loadLeaderboard();
}

function getLeaderboardPlayerName(player) {
  return (
    player.name ||
    player.fullName ||
    player.playerName ||
    player.linkedPlayerName ||
    "Player"
  );
}

function formatStreak(streak) {
  const value = Number(streak || 0);
  return value > 0 ? `🔥 ${value}` : "";
}

function renderLeaderboard(players = []) {
  const rowsEl = document.getElementById("leaderboardRows");
  if (!rowsEl) return;

  const currentUser = window.ONMSession?.getUser?.() || loggedInUser;
  const myKey = getCurrentPlayerKey();

  const myIndex = players.findIndex(player => player.playerKey === myKey);
  const me = myIndex >= 0 ? players[myIndex] : null;

  const heroMeta = document.querySelector(".leagueHeroMeta");
  const heroResult = document.getElementById("leagueLastResult");
  const heroRating = document.getElementById("leagueRatingChange");
  const heroOpponent = document.getElementById("leagueLastOpponent");
  const statsBtn = document.getElementById("openLastGameStatsBtn");
  const historyBtn = document.getElementById("openGameHistoryBtn");
  const myRankEl = document.getElementById("myLeaderboardRank");
  const myRatingEl = document.getElementById("myLeaderboardRating");
  const formDotsEl = document.getElementById("leagueLastFiveDots");

  if (!currentUser) {
    heroMeta?.classList.add("hidden");
    if (heroResult) {
      heroResult.textContent = "Join the league";
      heroResult.className = "leagueResultText win";
    }
    if (heroRating) heroRating.textContent = "Log in and play to enter";
    if (heroOpponent) heroOpponent.textContent = "Enter the leaderboard";
    if (statsBtn) statsBtn.textContent = "Log in";
    if (historyBtn) {
      historyBtn.textContent = "Register";
      historyBtn.classList.remove("hidden");
    }
  } else if (!me) {
    heroMeta?.classList.add("hidden");
    if (heroResult) {
      heroResult.textContent = "Play a game";
      heroResult.className = "leagueResultText win";
    }
    if (heroRating) heroRating.textContent = "Enter the league";
    if (heroOpponent) heroOpponent.textContent = "Start your first online match";
    if (statsBtn) statsBtn.textContent = "Play";
    if (historyBtn) historyBtn.classList.add("hidden");
  } else {
    heroMeta?.classList.remove("hidden");
    if (myRankEl) myRankEl.textContent = myIndex + 1;
    if (myRatingEl) myRatingEl.textContent = me.rating;

    if (heroResult) {
      heroResult.textContent = me.lastResult || "Last game";
      heroResult.className = `leagueResultText ${String(me.lastResult || "").toLowerCase().includes("defeat") ? "loss" : "win"
        }`;
    }

    if (heroRating) heroRating.textContent = me.lastRatingChange || "+0 rating";
    if (heroOpponent) heroOpponent.textContent = "Last game";
    if (statsBtn) statsBtn.textContent = "Stats";
    if (historyBtn) {
      historyBtn.textContent = "History";
      historyBtn.classList.remove("hidden");
    }

    if (formDotsEl) {
      const form = me.form || [];
      formDotsEl.innerHTML = Array.from({ length: 5 }).map((_, index) => {
        const result = form[index];
        if (result === "W") return `<i class="win"></i>`;
        if (result === "L") return `<i class="loss"></i>`;
        return `<i></i>`;
      }).join("");
    }
  }

  if (!players.length) {
    rowsEl.innerHTML = `<div class="leaderboardEmpty">No ratings yet.</div>`;
    return;
  }

  rowsEl.innerHTML = players.map((player, index) => {
    const rank = index + 1;
    const name = player.playerName || "Player";
    const played = Number(player.gamesPlayed || 0);
    const wins = Number(player.wins || 0);
    const rating = Number(player.rating || 1000);
    const streak = Number(player.streak || 0) > 0 ? formatStreak(player.streak) : "";
    const photo = player.photo || "graphics/logoWoText.png";
    const flag = player.nationality ? leaderboardFlag(player.nationality) : "";
    const isMe = player.playerKey === myKey;

    return `
      <div class="leaderboardRow ${isMe ? "me" : ""}" data-player-key="${player.playerKey}" data-player-name="${name}">
        <div class="leaderboardRank">${rank}</div>
        <div class="leaderboardPlayer">
          <img class="leaderboardAvatar" src="${photo}" alt="${name}">
          <div class="leaderboardNameWrap">
            <span class="leaderboardName">${name}</span>
            ${flag ? `<span class="leaderboardFlag">${flag}</span>` : ""}
          </div>
        </div>
        <div class="leaderboardStat streak ${streak ? "" : "noStreak"}">${streak}</div>
        <div class="leaderboardStat">${played}</div>
        <div class="leaderboardStat">${wins}</div>
        <div class="leaderboardRating">${rating}</div>
        <button type="button" class="leaderboardExpandBtn">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="leaderboardDetails"></div>
      </div>
    `;
  }).join("");

  rowsEl.querySelectorAll(".leaderboardExpandBtn").forEach(button => {
    button.addEventListener("click", async event => {
      event.stopPropagation();

      const row = button.closest(".leaderboardRow");
      const alreadyOpen = row.classList.contains("open");

      if (alreadyOpen) {
        row.classList.remove("open");
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        return;
      }

      row.classList.add("open");

      if (!row.dataset.loadedStats) {
        button.innerHTML = `<span class="inlineSpinner"></span>`;
        row.dataset.loadedStats = "true";
        await loadExpandedPlayerStats(row);
      }

      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" style="transform:rotate(180deg)"><path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    });
  });
}

async function loadExpandedPlayerStats(row) {
  const details = row.querySelector(".leaderboardDetails");
  const playerKey = row.dataset.playerKey;
  const playerName = row.dataset.playerName;

  details.innerHTML = `
    ${Array.from({ length: 8 }).map(() => `
      <div class="leaderboardDetailStat leaderboardStatSkeleton">
        <strong>&nbsp;</strong>
        <span>&nbsp;</span>
      </div>
    `).join("")}
  `;

  try {
    const result = await postDartMatch({
      action: "getUserStats",
      linkedPlayerName: playerName,
      linkedPlayerKey: playerKey
    });

    if (!result.success) {
      details.innerHTML = `<div class="leaderboardEmpty">Could not load stats.</div>`;
      return;
    }

    const stats = result.stats || {};

    details.innerHTML = `
      <div class="leaderboardDetailStat">
        <strong>${stats.winRate || "0%"}</strong>
        <span>Win %</span>
      </div>
      <div class="leaderboardDetailStat">
        <strong>${stats.legsFA || "0/0"}</strong>
        <span>Legs F/A</span>
      </div>
      <div class="leaderboardDetailStat">
        <strong>${stats.average || "0.00"}</strong>
        <span>Average</span>
      </div>
      <div class="leaderboardDetailStat">
        <strong>${stats.checkoutRate || "0.00%"}</strong>
        <span>Checkout %</span>
      </div>
      <div class="leaderboardDetailStat">
        <strong>${stats.oneEightys || 0}</strong>
        <span>180s</span>
      </div>
      <div class="leaderboardDetailStat">
        <strong>${stats.bullOuts || 0}</strong>
        <span>Bulls</span>
      </div>
      <div class="leaderboardDetailStat">
        <strong>${stats.highestOut || "-"}</strong>
        <span>Highest out</span>
      </div>
      <div class="leaderboardDetailStat">
        <strong>${stats.bestLeg || "-"}</strong>
        <span>Best leg</span>
      </div>
    `;
  } catch (err) {
    console.warn("Could not load expanded player stats:", err);
    details.innerHTML = `<div class="leaderboardEmpty">Could not connect to stats.</div>`;
  }
}

async function loadLeaderboard() {
  const rowsEl = document.getElementById("leaderboardRows");
  if (!rowsEl) return;

  rowsEl.innerHTML = `
    <div class="leaderboardLoading">
      <span class="inlineSpinner"></span>
      Loading leaderboard...
    </div>
  `;

  try {
    if (!window.ONMLiveDarts) {
      rowsEl.innerHTML = `<div class="leaderboardEmpty">Leaderboard unavailable.</div>`;
      return;
    }

    const { db, ref, get } = window.ONMLiveDarts;
    const snapshot = await get(ref(db, "ratings"));

    if (!snapshot.exists()) {
      renderLeaderboard([]);
      return;
    }

    const players = Object.values(snapshot.val())
      .map(player => ({
        playerKey: player.playerKey || "",
        playerName: player.playerName || "Player",
        photo: player.photo || "",
        nationality: player.nationality || "",
        rating: Number(player.rating || 1000),
        gamesPlayed: Number(player.gamesPlayed || 0),
        wins: Number(player.wins || 0),
        losses: Number(player.losses || 0),
        streak: Number(player.streak || 0),
        form: Array.isArray(player.form) ? player.form : [],
        lastResult: player.lastResult || "",
        lastRatingChange: player.lastRatingChange || ""
      }))
      .filter(player => player.gamesPlayed > 0)
      .sort((a, b) => Number(b.rating || 1000) - Number(a.rating || 1000));

    window.currentLeaderboardPlayers = players;
    renderLeaderboard(players);

  } catch (err) {
    console.warn("Could not load leaderboard:", err);
    rowsEl.innerHTML = `<div class="leaderboardEmpty">Could not connect to leaderboard.</div>`;
  }
}


document.getElementById("openLastGameStatsBtn")?.addEventListener("click", event => {
  event.preventDefault();
  event.stopPropagation();

  const user = window.ONMSession?.getUser?.() || loggedInUser;
  const buttonText = document.getElementById("openLastGameStatsBtn")?.textContent.trim();

  if (!user) {
    window.location.href = "auth.html?mode=login&redirect=dart-scorer.html";
    return;
  }

  if (buttonText === "Play") {
    openCompetitiveInviteFlow();
    return;
  }

  loadProfileStats();
  openProfilePopup();
});

document.getElementById("openGameHistoryBtn")?.addEventListener("click", () => {
  const user = window.ONMSession?.getUser?.() || loggedInUser;

  if (!user) {
    window.location.href = "auth.html?mode=register&redirect=dart-scorer.html";
    return;
  }

  showOnlineNotice("Game history coming soon.");
});

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