"use strict";

function createTournamentScoring({ db, timestamp, fail }) {
  return async ({ auth, data }) => {
    if (!auth) throw fail("unauthenticated", "Sign in to score tournament matches.");
    const { tournamentId, matchId, action, testMode, mode, revision, state, starter, requestId } = data ?? {};
    if (typeof tournamentId !== "string" || !/^[\w-]{1,128}$/.test(tournamentId) ||
        (action !== "marker" && (typeof matchId !== "string" || !/^[\w-]{1,128}$/.test(matchId)))) {
      throw fail("invalid-argument", "Invalid tournament fixture.");
    }
    const engine = await import("./tournament-engine.mjs");
    const uid = auth.uid;
    const ref = db.collection(testMode === true ? "testTournaments" : "tournaments").doc(tournamentId);
    const userRef = uid => db.collection("users").doc(uid);
    return db.runTransaction(async tx => {
      const [account, snapshot] = await Promise.all([tx.get(userRef(uid)), tx.get(ref)]);
      const user = account.data();
      const tournament = snapshot.data();
      const admin = ["admin", "owner"].includes(user?.role);
      if (user?.status !== "Active" || (testMode === true && !admin)) {
        throw fail("permission-denied", "An active account with tournament access is required.");
      }
      if (!tournament) throw fail("not-found", "Tournament not found.");
      const online = tournament.settings.playMode === "online";
      if (action === "marker") {
        if (online || tournament.status === "complete" || Object.hasOwn(tournament.entries, uid)) {
          throw fail("failed-precondition", "Only non-playing members can join as a marker.");
        }
        const markers = { ...tournament.markers };
        if (data.leave) delete markers[uid];
        else markers[uid] = true;
        tx.update(ref, { markers });
        return {};
      }

      const sessionRef = ref.collection("scoring").doc(matchId);
      const session = (await tx.get(sessionRef)).data();
      const view = engine.tournamentView(tournament);
      const fixture = view && engine.fixtureSchedule(view, tournament.settings).find(item => item.match.id === matchId);
      const match = fixture?.match;
      if (session && (session.mode === "shared" ? session.players.includes(uid) : session.owner === uid) &&
          (action === "open" || action === "write") && tournament.results[matchId]?.submissionId === session.id) {
        return session;
      }
      if (tournament.status !== "live" || engine.tournamentStartTime(tournament) > Date.now() ||
          !match?.ready || match.result || (!session && !fixture.available)) {
        throw fail("failed-precondition", "This match is waiting for its board or is no longer available.");
      }
      const players = [match.a, match.b];
      const participant = players.includes(uid);
      const canChalk = !online && (admin || Object.hasOwn(tournament.entries, uid) || tournament.markers?.[uid] === true);
      function publish(updated) {
        tx.set(sessionRef, updated);
        tx.update(ref, { matchSessions: { ...tournament.matchSessions, [matchId]: {
          id: updated.id, owner: updated.owner, players, mode: updated.mode, status: updated.status
        } } });
      }
      if (action === "open") {
        if (session) {
          if (session.mode === "shared" ? !participant : session.owner !== uid) {
            throw fail("permission-denied", "This match already has a scorer.");
          }
          if (session.status === "invited" && session.owner !== uid) {
            const accepted = { ...session, status: "playing" };
            publish(accepted);
            return accepted;
          }
          return session;
        }
        if (mode === "shared" ? !participant || players.some(player => /^dummy-\d+$/.test(player)) :
            mode !== "chalk" || !canChalk) {
          throw fail("permission-denied", "This scoring option is unavailable for your account.");
        }
        const created = {
          id: require("node:crypto").randomUUID(), players, owner: uid, mode,
          status: mode === "shared" ? "invited" : "playing", revision: 0,
          settings: engine.matchSettings(tournament.settings, match), starter: null, state: null
        };
        const draft = data.draft;
        if (mode === "chalk" && admin && draft?.entrants?.[0] === players[0] &&
            draft.entrants[1] === players[1] && [0, 1].includes(draft.starter) &&
            draft.state?.winnerIndex === null && draft.state.players?.length === 2 &&
            draft.state.players.every(player => engine.statFields.every(field =>
              Number.isSafeInteger(player[field]) && player[field] >= 0)) &&
            JSON.stringify(draft.state).length <= 120000) {
          created.settings = engine.matchSettings(tournament.settings, match, draft.format);
          created.starter = draft.starter;
          created.state = draft.state;
        }
        publish(created);
        return created;
      }
      if (action === "cancel" && session?.status === "invited" && participant) {
        const matchSessions = { ...tournament.matchSessions };
        delete matchSessions[matchId];
        tx.delete(sessionRef);
        tx.update(ref, { matchSessions });
        return {};
      }
      if (action !== "write" || !session || session.status !== "playing" ||
          (session.mode === "shared" ? !participant : session.owner !== uid)) {
        throw fail("permission-denied", "This device cannot score the match.");
      }
      if (typeof requestId !== "string" || !/^[\w-]{1,64}$/.test(requestId)) {
        throw fail("invalid-argument", "Invalid score request.");
      }
      if (session.lastWrite === requestId) return session;
      if (revision !== session.revision) throw fail("aborted", "The score changed on another phone.");
      const previous = session.state;
      if (session.mode === "shared" && (previous ? players[previous.currentPlayer] !== uid : session.owner !== uid)) {
        throw fail("permission-denied", "Wait for your turn.");
      }
      if (![0, 1].includes(starter) || (previous && starter !== session.starter) ||
          !state || ![0, 1].includes(state.currentPlayer) || !Array.isArray(state.players) || state.players.length !== 2 ||
          !state.players.every(player => player && engine.statFields.every(field =>
            Number.isSafeInteger(player[field]) && player[field] >= 0) && player.legs <= 19 &&
            Number.isSafeInteger(player.score) && player.score >= 0 && player.score <= session.settings.startScore) ||
          (!previous && (state.currentPlayer !== starter || state.players.some(player => player.legs || player.score !== session.settings.startScore))) ||
          JSON.stringify(state).length > 120000) {
        throw fail("invalid-argument", "Invalid tournament score.");
      }
      const winner = engine.matchOutcome(session.settings, state.players);
      if (state.winnerIndex !== winner) throw fail("invalid-argument", "Invalid tournament result.");
      if (previous && session.mode === "shared") {
        const turn = previous.currentPlayer;
        const other = 1 - turn;
        const current = state.players[turn];
        const last = previous.players[turn];
        const darts = current.dartsThrown - last.dartsThrown;
        const scored = current.totalScored - last.totalScored;
        const legWon = current.legs === last.legs + 1;
        const next = legWon ? (starter + state.players[0].legs + state.players[1].legs) % 2 : other;
        const resetScore = legWon && winner === null ? session.settings.startScore : previous.players[other].score;
        if (darts < 1 || darts > 3 || scored < 0 || scored > 180 ||
            (!legWon && current.legs !== last.legs) || (legWon ? scored !== last.score : current.score !== last.score - scored) ||
            engine.statFields.some(field => state.players[other][field] !== previous.players[other][field]) ||
            state.players[other].score !== resetScore ||
            (winner === null && (state.currentPlayer !== next || (legWon && current.score !== session.settings.startScore)))) {
          throw fail("invalid-argument", "A phone can only submit one visit for its own player.");
        }
      }
      const profiles = winner !== null && testMode !== true
        ? await Promise.all(players.map(player => tx.get(userRef(player)))) : [];
      const updated = { ...session, starter, state, revision: revision + 1, lastWrite: requestId,
        status: winner === null ? "playing" : "complete" };
      if (winner === null) {
        tx.set(sessionRef, updated);
        return updated;
      }
      const { gameType, legsCount } = session.settings;
      let result;
      try {
        result = { ...engine.makeResult(session.settings, winner, state.players, session.id), format: { gameType, legsCount } };
      } catch (error) {
        throw fail("invalid-argument", error.message);
      }
      const results = { ...tournament.results, [matchId]: result };
      const complete = engine.tournamentView({ ...tournament, results }).complete;
      const matchSessions = { ...tournament.matchSessions };
      delete matchSessions[matchId];
      tx.set(sessionRef, updated);
      tx.update(ref, { results, matchSessions, ...(complete ? { status: "complete", completedAt: timestamp() } : {}) });
      if (profiles.length) {
        const matchRecord = {
          matchId: `TOURNAMENT-${tournamentId}-${matchId}`, matchMode: "tournament",
          tournamentId, dateTime: new Date().toISOString(), createdAt: timestamp(), submittedBy: uid,
          gameType, legsCount, startScore: session.settings.startScore, inMode: session.settings.inMode,
          draw: winner === -1
        };
        [result.left, result.right].forEach((stats, index) => {
          const prefix = index === 0 ? "playerOne" : "playerTwo";
          const legs = state.players[index].legDarts?.filter(value => Number.isSafeInteger(value) && value > 0) ?? [];
          const fields = {
            Id: profiles[index].data()?.linkedPlayerKey || players[index], Uid: players[index],
            Name: tournament.entries[players[index]], Won: winner === index, Legs: stats.legs,
            TotalScored: stats.totalScored, DartsThrown: stats.dartsThrown, CheckoutsHit: stats.checkoutHits,
            CheckoutAttempts: stats.checkoutAttempts, HighestOut: stats.highestOut, "180s": stats.oneEightys,
            BullOuts: stats.bullOuts, HighScore: Number(state.players[index].highScore) || 0,
            BestLeg: legs.length ? Math.min(...legs) : 0, WorstLeg: legs.length ? Math.max(...legs) : 0,
            "3DartAvg": stats.dartsThrown ? 3 * stats.totalScored / stats.dartsThrown : 0,
            First9Avg: stats.firstNineDarts ? 3 * stats.firstNineScored / stats.firstNineDarts : 0
          };
          for (const [key, value] of Object.entries(fields)) matchRecord[prefix + key] = value;
        });
        tx.set(db.collection("dartMatches").doc(matchRecord.matchId), matchRecord);
      }
      return updated;
    });
  };
}

module.exports = { createTournamentScoring };
