import { makeDraw, makeResult, tournamentView, validateSettings } from "./tournament-engine.mjs";

export function canManage(user) {
  return user?.status === "Active" && ["owner", "admin"].includes(user.role);
}

export function entryName(user) {
  return user.linkedPlayerName || user.firstName;
}

export function tournamentUrl(id) {
  return id ? `tournament.html?id=${encodeURIComponent(id)}` : "tournament.html";
}

export function scorerUrl(id, matchId) {
  const params = new URLSearchParams({ mode: "tournament", tournament: id, match: matchId });
  return `dart-scorer.html?${params}`;
}

export function tournamentError(error) {
  return error.code === "permission-denied"
    ? "You don't have permission for this action, or the tournament is no longer open for entries."
    : error.message || "The tournament could not be updated. Please try again.";
}

export async function tournamentStore() {
  const { db, firestoreSdk: sdk } = await window.ONMFirebase.ready;
  const collection = sdk.collection(db, "tournaments");
  const reference = id => sdk.doc(collection, id);
  const update = (id, change) => sdk.runTransaction(db, async transaction => {
    const ref = reference(id);
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Tournament not found.");
    const patch = change(snap.data());
    if (patch) transaction.update(ref, patch);
  });

  return {
    watchLobby(next, error) {
      return sdk.onSnapshot(sdk.query(collection, sdk.orderBy("createdAt", "desc")), snapshot =>
        next(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))), error);
    },
    watchTournament(id, next, error) {
      return sdk.onSnapshot(reference(id), snapshot => next(snapshot.exists() ? snapshot.data() : null), error);
    },
    async load(id) {
      const snapshot = await sdk.getDocFromServer(reference(id));
      if (!snapshot.exists()) throw new Error("Tournament not found.");
      return snapshot.data();
    },
    async create(title, settings, user) {
      validateSettings(settings);
      if (!title || title.length > 100) throw new Error("Enter a tournament name of up to 100 characters.");
      const doc = await sdk.addDoc(collection, {
        title, settings, createdBy: user.uid, createdAt: sdk.serverTimestamp(),
        status: "open", entries: {}, seeds: {}, results: {}
      });
      return doc.id;
    },
    joinOrLeave(id, user, join) {
      return update(id, tournament => {
        if (tournament.status !== "open") throw new Error("Entries are closed.");
        const entries = { ...tournament.entries };
        if (join) {
          if (Object.hasOwn(entries, user.uid)) return;
          if (Object.keys(entries).length >= tournament.settings.capacity) throw new Error("This tournament is full.");
          const name = entryName(user);
          if (!name || name.length > 100) throw new Error("Add a player name to your site account first.");
          entries[user.uid] = name;
        } else {
          if (!Object.hasOwn(entries, user.uid)) return;
          delete entries[user.uid];
        }
        return { entries };
      });
    },
    start(id, seeds) {
      return update(id, tournament => {
        if (tournament.status !== "open") throw new Error("This tournament has already started.");
        if (tournament.settings.drawMode === "ability" &&
            Object.keys(tournament.entries).some(uid => !Number.isInteger(seeds[uid]) || seeds[uid] < 1 || seeds[uid] > 128)) {
          throw new Error("Set an ability seed for every entrant before starting.");
        }
        const currentSeeds = tournament.settings.drawMode === "ability"
          ? Object.fromEntries(Object.keys(tournament.entries).map(uid => [uid, seeds[uid]]))
          : {};
        const draw = makeDraw({ ...tournament, seeds: currentSeeds });
        return { draw, seeds: currentSeeds, status: "live", startedAt: sdk.serverTimestamp() };
      });
    },
    saveResult(id, matchId, entrants, winnerIndex, players, submissionId) {
      return update(id, tournament => {
        const existing = tournament.results[matchId];
        if (existing?.submissionId === submissionId) return;
        if (existing) throw new Error("A result has already been saved for this match.");
        const match = tournamentView(tournament)?.matches.find(item => item.id === matchId);
        if (tournament.status !== "live" || !match?.ready ||
            match.a !== entrants[0] || match.b !== entrants[1]) {
          throw new Error("This match is no longer available.");
        }
        const result = makeResult(tournament.settings, winnerIndex, players, submissionId);
        const results = { ...tournament.results, [matchId]: result };
        const complete = tournamentView({ ...tournament, results }).complete;
        return complete ? { results, status: "complete", completedAt: sdk.serverTimestamp() } : { results };
      });
    }
  };
}
