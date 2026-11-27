import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  onValue,
  push,
  serverTimestamp,
  onDisconnect,
  query,
  orderByChild,
  equalTo,
  get,
  remove,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBn87XaH6f7MHC6EZZskBJF_4kJYNG1j2c",
  authDomain: "oche-ness-monsters.firebaseapp.com",
  projectId: "oche-ness-monsters",
  storageBucket: "oche-ness-monsters.firebasestorage.app",
  messagingSenderId: "765901984167",
  appId: "1:765901984167:web:59912422549f4a22f16682",
  measurementId: "G-HGH252D73C",
  databaseURL: "https://oche-ness-monsters-default-rtdb.europe-west1.firebasedatabase.app/",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

const INVITE_DURATION_MS = 30_000;
let serverTimeOffset = 0;
onValue(ref(db, ".info/serverTimeOffset"), snapshot => {
  serverTimeOffset = Number(snapshot.val()) || 0;
});

function inviteTimeLeft(invite) {
  const createdAt = Number(invite?.createdAt);
  if (!createdAt) return 0;
  return Math.max(0, createdAt + (Number(invite.durationMs) || INVITE_DURATION_MS) - (Date.now() + serverTimeOffset));
}

async function transitionPendingInvite(inviteId, status, changes = {}) {
  const inviteRef = ref(db, `dartInvites/${inviteId}`);
  await get(inviteRef);
  return runTransaction(inviteRef, invite => {
    if (invite?.status !== "pending") return;
    if ((inviteTimeLeft(invite) === 0) !== (status === "expired")) return;
    return { ...invite, ...changes, status };
  }, { applyLocally: false });
}

async function createOnlineInvite({ fromUser, toPlayer, settings = {} }) {
  const inviteRef = push(ref(db, "dartInvites"));

  const fromPlayerKey = getStablePlayerKey(fromUser);
  const toPlayerKey = getStablePlayerKey(toPlayer);

  const fromName =
    `${fromUser.firstName || ""} ${fromUser.surname || fromUser.lastName || ""}`.trim() ||
    fromUser.fullName ||
    fromUser.name ||
    fromUser.linkedPlayerName ||
    "Player 1";

  const toName =
    toPlayer.playerName ||
    toPlayer.fullName ||
    `${toPlayer.firstName || ""} ${toPlayer.surname || toPlayer.lastName || ""}`.trim() ||
    toPlayer.name ||
    "Player 2";

  const invitePayload = {
    inviteId: inviteRef.key,
    status: "pending",
    createdAt: serverTimestamp(),
    durationMs: INVITE_DURATION_MS,

    fromUserId: fromUser.userId || "",
    fromPlayerKey,
    fromName,
    fromPhoto: getPhotoField(fromUser),
    fromNationality: getNationalityField(fromUser),

    toPlayerKey,
    toUserId: toPlayer.userId || "",
    toName,
    toPhoto: getPhotoField(toPlayer),
    toNationality: getNationalityField(toPlayer),

    statsMode: settings.statsMode || window.STATS_MODE || "casual",
    startScore: settings.startScore || 501,
    gameType: settings.gameType || "bestOf",
    legsCount: settings.legsCount || 3,
    inMode: settings.inMode || "straight",
    competitive: Boolean(settings.competitive),
    deciderType: settings.deciderType === "bull" ? "bull" : "coin",
    inviteText: settings.inviteText || ""
  };

  await set(inviteRef, invitePayload);

  return inviteRef.key;
}

function safeFirebaseKey(value) {
  return String(value || "")
    .trim()
    .replace(/[.#$/\[\]]/g, "_");
}

function getStablePlayerKey(user) {
  return safeFirebaseKey(
    user?.linkedPlayerKey ||
    user?.playerKey ||
    user?.userId ||
    user?.uid ||
    user?.email ||
    ""
  );
}

async function setPlayerPresence(user) {
  if (!user?.linkedPlayerKey) return;

  const playerKey = user.linkedPlayerKey;
  const presenceRef = ref(db, `presence/${playerKey}`);
  const connectedRef = ref(db, ".info/connected");

  onValue(connectedRef, async snapshot => {
    if (snapshot.val() !== true) return;

    try {
      await onDisconnect(presenceRef).update({
        online: false,
        status: "offline",
        lastSeen: serverTimestamp()
      });
      await update(presenceRef, {
        online: true,
        status: "online",
        playerKey,
        ...(user.versusAccount ? { versusAccount: true } : {}),
        playerName: user.fullName || user.playerName || user.linkedPlayerName ||
          `${user.firstName || ""} ${user.surname || ""}`.trim(),
        photo: user.photo || user.photoUrl || "",
        nationality: user.nationality || "",
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("Could not update Versus presence", error);
    }
  });
}

function trackMonsterBotGame(playerKey) {
  if (!playerKey) return;
  const gameRef = push(ref(db, `presence/${playerKey}/botGames`));
  let stopped = false;
  const unsubscribe = onValue(ref(db, ".info/connected"), async snapshot => {
    if (snapshot.val() !== true || stopped) return;
    try {
      await onDisconnect(gameRef).remove();
      if (!stopped) await set(gameRef, true);
    } catch (err) {
      console.warn("Could not publish Monster Bot activity:", err);
    }
  });
  return () => {
    stopped = true;
    unsubscribe();
    remove(gameRef).catch(err => console.warn("Could not clear Monster Bot activity:", err));
  };
}

async function setPresenceStatus(playerKey, status = "online") {
  if (!playerKey) return;

  await update(ref(db, `presence/${playerKey}`), {
    online: status !== "offline",
    status,
    updatedAt: serverTimestamp()
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

function normalisePhotoUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  const match = value.match(/\/file\/d\/([^/]+)/);
  if (match?.[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w300`;
  }

  return value;
}

function getPhotoField(player) {
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

function getNationalityField(player) {
  return pickField(player, ["nationality", "Nationality"]);
}

async function createOnlineMatchFromInvite(invite, settings = {}) {
  console.log("[MATCH CREATED FROM INVITE]", invite);
  const matchRef = push(ref(db, "onlineMatches"));

  const matchData = {
    matchId: matchRef.key,
    inviteId: invite.inviteId,
    status: "lobby",
    createdAt: serverTimestamp(),

    hostPlayerKey: invite.fromPlayerKey,
    guestPlayerKey: invite.toPlayerKey,

    hostName: invite.fromName,
    guestName: invite.toName,

    matchMode: "online",
    statsMode: invite.statsMode || "casual",

    hostPhoto: invite.fromPhoto || "",
    guestPhoto: invite.toPhoto || "",
    hostNationality: invite.fromNationality || "",
    guestNationality: invite.toNationality || "",

    settings: {
      startScore: settings.startScore || 501,
      gameType: settings.gameType || "bestOf",
      legsCount: settings.legsCount || 3,
      inMode: settings.inMode || "straight",
      deciderType: (invite.deciderType || invite.settings?.deciderType) === "bull" ? "bull" : "coin"
    },

    decider: {
      type: null,
      status: "waiting",
      winnerKey: null,
      bullThrows: {}
    },

    game: {
      currentPlayerKey: null,
      players: {
        [invite.fromPlayerKey]: {
          name: invite.fromName,
          score: settings.startScore || 501,
          legs: 0,
          lastScore: "-",
          dartsThrown: 0,
          tonPlusOuts: 0
        },
        [invite.toPlayerKey]: {
          name: invite.toName,
          score: settings.startScore || 501,
          legs: 0,
          lastScore: "-",
          dartsThrown: 0,
          tonPlusOuts: 0
        }
      }
    },

    presence: {
      [invite.fromPlayerKey]: true,
      [invite.toPlayerKey]: true
    }
  };

  const claim = await transitionPendingInvite(invite.inviteId, "accepting", { matchId: matchRef.key });
  if (!claim.committed) throw new Error("This challenge is no longer available.");

  try {
    await update(ref(db), {
      [`onlineMatches/${matchRef.key}`]: matchData,
      [`dartInvites/${invite.inviteId}/status`]: "accepted",
      [`dartInvites/${invite.inviteId}/acceptedAt`]: serverTimestamp()
    });
  } catch (error) {
    await runTransaction(ref(db, `dartInvites/${invite.inviteId}`), current => {
      if (current?.status !== "accepting" || current.matchId !== matchRef.key) return;
      const { matchId, ...pending } = current;
      return { ...pending, status: inviteTimeLeft(pending) ? "pending" : "expired" };
    }, { applyLocally: false }).catch(rollbackError => console.warn("Could not release challenge", rollbackError));
    throw error;
  }

  return matchRef.key;
}

window.ONMLiveDarts = {
  db,
  ref,
  set,
  update,
  remove,
  onValue,
  push,
  serverTimestamp,
  onDisconnect,
  query,
  orderByChild,
  equalTo,
  get,
  runTransaction,
  trackMonsterBotGame,
  setPlayerPresence,
  setPresenceStatus, 
  serverNow: () => Date.now() + serverTimeOffset,
  inviteTimeLeft,
  transitionPendingInvite,
  createOnlineInvite,
  createOnlineMatchFromInvite,
};

window.dispatchEvent(new Event("onmLiveDartsReady"));

const testRef = ref(db, "testConnection");

set(testRef, {
  message: "Firebase connected",
  time: serverTimestamp()
}).then(() => {
  console.log("Firebase Realtime Database connected ✅");
}).catch(err => {
  console.error("Firebase connection failed:", err);
});

window.createOnlineMatch = async function ({
  hostUserId,
  hostName,
  opponentUserId,
  opponentName
}) {

  const matchRef = push(ref(db, "onlineMatches"));

  const matchData = {
    status: "waiting",
    createdAt: Date.now(),

    currentPlayer: 0,

    players: {
      playerOne: {
        userId: hostUserId,
        name: hostName,
        connected: true,
        score: 501,
        legs: 0
      },

      playerTwo: {
        userId: opponentUserId,
        name: opponentName,
        connected: true,
        score: 501,
        legs: 0
      }
    }
  };

  await set(matchRef, matchData);

  console.log("Online match created:", matchRef.key);

  return matchRef.key;
};
