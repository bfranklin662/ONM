import { entryCapacity, fixtureSchedule, makeDraw, makeResult, matchSettings, maxDummyEntrants, tournamentStartTime, tournamentView, validateSettings } from "./tournament-engine.mjs";

export const editableLegFields = ["groupLegs", "quarterFinalLegs", "semiFinalLegs", "finalLegs"];
export const tournamentActivityTimeout = 90_000;

export function canManage(user) {
  return user?.status === "Active" && ["owner", "admin"].includes(user.role);
}

export function canDeleteTournament(tournament, user) {
  return Boolean(tournament && user?.uid && canManage(user) && tournament.createdBy === user.uid);
}

export function entryName(user) {
  return user.linkedPlayerName || user.firstName;
}

export function tournamentUrl(id, testMode = false, tab) {
  const params = new URLSearchParams();
  if (id) params.set("id", id);
  if (testMode) params.set("test", "1");
  if (tab) params.set("tab", tab);
  return params.size ? `tournament.html?${params}` : "tournament.html";
}

export function scorerUrl(id, matchId, testMode = false, scoring) {
  const params = new URLSearchParams({ mode: "tournament", tournament: id, match: matchId });
  if (testMode) params.set("test", "1");
  if (scoring) params.set("scoring", scoring);
  return `dart-scorer.html?${params}`;
}

export function tournamentDraftKey(uid, id, matchId, testMode = false) {
  return `${testMode ? "onmTestTournament" : "onmTournament"}:${uid}:${id}:${matchId}`;
}

export function readTournamentDraft(key) {
  try {
    const draft = sessionStorage.getItem(key);
    if (draft) return JSON.parse(draft);
  } catch {}
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

export function tournamentError(error) {
  return error.code === "permission-denied"
    ? "You don't have permission for this action, or the tournament is no longer open for entries."
    : error.message || "The tournament could not be updated. Please try again.";
}

export async function tournamentStore(testMode = false) {
  const { db, firestoreSdk: sdk } = await window.ONMFirebase.ready;
  const collection = sdk.collection(db, testMode ? "testTournaments" : "tournaments");
  const reference = id => sdk.doc(collection, id);
  const update = (id, change) => sdk.runTransaction(db, async transaction => {
    const ref = reference(id);
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Tournament not found.");
    const patch = change(snap.data());
    if (patch) transaction.update(ref, patch);
  });

  return {
    scoring(tournamentId, action, details = {}) {
      return window.ONMFirebase.tournamentScoring({ ...details, tournamentId, action, testMode });
    },
    watchScoring(id, matchId, next, error) {
      return sdk.onSnapshot(sdk.doc(reference(id), "scoring", matchId), snapshot =>
        next(snapshot.exists() ? snapshot.data() : null), error);
    },
    async checkCreateAccess() {
      // A server read checks the deployed rules even when the probe document is absent.
      await sdk.getDocFromServer(sdk.doc(db, "tournamentAccess", "create-v1"));
    },
    watchLobby(next, error) {
      return sdk.onSnapshot(sdk.query(collection, sdk.orderBy("createdAt", "desc")), snapshot =>
        next(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))), error);
    },
    watchLive(next, error) {
      return sdk.onSnapshot(sdk.query(collection, sdk.where("status", "==", "live")), snapshot =>
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
    deleteTournament(id, user) {
      return sdk.runTransaction(db, async transaction => {
        const ref = reference(id);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error("Tournament not found.");
        if (!canDeleteTournament(snapshot.data(), user)) throw new Error("Only the creator can delete this tournament.");
        transaction.delete(ref);
      });
    },
    async create(title, settings, user, dummyCount = 0) {
      if (!canManage(user)) throw new Error("A site administrator creates tournaments.");
      if (settings.playMode === undefined) throw new Error("Choose Online or In person.");
      validateSettings(settings);
      if (!title || title.length > 100) throw new Error("Enter a tournament name of up to 100 characters.");
      let entries = {};
      if (testMode) {
        const minimum = (settings.qualifiers ?? 4) + (settings.plate ? 2 : 0) - 1;
        const maximum = entryCapacity(settings) ?? maxDummyEntrants;
        if (!Number.isInteger(dummyCount) || dummyCount < minimum || dummyCount > maximum) {
          throw new Error(`Choose between ${minimum} and ${maximum} dummy entrants.`);
        }
        entries = Object.fromEntries(Array.from({ length: dummyCount }, (_, index) => {
          const number = String(index + 1).padStart(3, "0");
          return [`dummy-${number}`, `Dummy Player ${number}`];
        }));
      } else if (dummyCount !== 0) {
        throw new Error("Dummy entrants are available in test tournaments only.");
      }
      const doc = await sdk.addDoc(collection, {
        title, settings, createdBy: user.uid, createdAt: sdk.serverTimestamp(),
        status: "open", entries, seeds: {}, results: {}
      });
      return doc.id;
    },
    joinOrLeave(id, user, join) {
      return update(id, tournament => {
        if (user?.status !== "Active" || !user.uid) throw new Error("Sign in with an active site account to enter.");
        if (testMode && !canManage(user)) throw new Error("Only site administrators can join private tests.");
        if (tournament.status !== "open") throw new Error("Entries are closed.");
        const entries = { ...tournament.entries };
        if (join) {
          if (Object.hasOwn(entries, user.uid)) return;
          if (tournament.markers?.[user.uid]) throw new Error("Leave your marker role before joining as a player.");
          const capacity = entryCapacity(tournament.settings);
          if (capacity !== null && Object.keys(entries).length >= capacity) throw new Error("This tournament is full.");
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
            Object.keys(tournament.entries).some(uid => !Number.isSafeInteger(seeds[uid]) || seeds[uid] < 1)) {
          throw new Error("Set an ability seed for every entrant before starting.");
        }
        const currentSeeds = tournament.settings.drawMode === "ability"
          ? Object.fromEntries(Object.keys(tournament.entries).map(uid => [uid, seeds[uid]]))
          : {};
        const draw = makeDraw({ ...tournament, seeds: currentSeeds });
        return { draw, seeds: currentSeeds, status: "live", startedAt: sdk.serverTimestamp() };
      });
    },
    editRules(id, user, changes) {
      if (!canManage(user)) throw new Error("Only an administrator can edit tournament rules.");
      return update(id, tournament => {
        if (!["open", "live"].includes(tournament.status)) throw new Error("This tournament has finished.");
        const settings = { ...tournament.settings };
        if (Object.hasOwn(changes, "firstThrow") && tournament.status !== "open") {
          throw new Error("The first-throw method is locked once the tournament starts.");
        }
        for (const key of ["boardCount", "gameType", "legsCount", "firstThrow", ...editableLegFields]) {
          if (!Object.hasOwn(changes, key)) continue;
          if (changes[key] === null && editableLegFields.includes(key)) delete settings[key];
          else settings[key] = changes[key];
        }
        validateSettings(settings);
        return { settings };
      });
    },
    markMatchInPlay(id, matchId, submissionId, inPlay, parked = false) {
      return update(id, tournament => {
        if (tournament.status !== "live" || tournament.settings.playMode === "online" || tournament.results[matchId]) return;
        const activeMatches = { ...tournament.activeMatches };
        const current = activeMatches[matchId];
        if (inPlay) {
          if (current && current.submissionId !== submissionId &&
            Date.now() - (current.updatedAt?.toMillis?.() ?? 0) < tournamentActivityTimeout) return;
          activeMatches[matchId] = { submissionId, updatedAt: sdk.serverTimestamp(), parked };
        }
        else if (current?.submissionId === submissionId) delete activeMatches[matchId];
        else return;
        return { activeMatches };
      });
    },
    saveResult(id, matchId, entrants, winnerIndex, players, submissionId, playedFormat) {
      return update(id, tournament => {
        const existing = tournament.results[matchId];
        if (existing?.submissionId === submissionId) return;
        if (existing) throw new Error("A result has already been saved for this match.");
        if (tournamentStartTime(tournament) > Date.now()) throw new Error("The start countdown is still running.");
        const view = tournamentView(tournament);
        const match = view?.matches.find(item => item.id === matchId);
        if (tournament.status !== "live" || !match?.ready ||
            match.a !== entrants[0] || match.b !== entrants[1]) {
          throw new Error("This match is no longer available.");
        }
        if (!fixtureSchedule(view, tournament.settings).find(fixture => fixture.match.id === matchId)?.available) {
          throw new Error("This fixture is still waiting for its board or a previous match.");
        }
        const format = matchSettings(tournament.settings, match, playedFormat);
        const result = {
          ...makeResult(format, winnerIndex, players, submissionId),
          format: { gameType: format.gameType, legsCount: format.legsCount }
        };
        const results = { ...tournament.results, [matchId]: result };
        const complete = tournamentView({ ...tournament, results }).complete;
        return complete ? { results, status: "complete", completedAt: sdk.serverTimestamp() } : { results };
      });
    }
  };
}
