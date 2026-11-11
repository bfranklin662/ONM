"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createTournamentScoring } = require("./tournament-scoring");

async function setup(playMode, testMode = false) {
  const engine = await import("./tournament-engine.mjs");
  const tournament = {
    status: "live", settings: { playMode, structure: "knockout", capacity: playMode === "online" ? 4 : null,
      gameType: "bestOf", legsCount: 1, startScore: 301, inMode: "straight", drawMode: "random" },
    entries: { p1: "One", p2: "Two", p3: "Three", p4: "Four" }, results: {}
  };
  tournament.draw = engine.makeDraw(tournament, () => 0.5);
  const fixture = engine.fixtureSchedule(engine.tournamentView(tournament), tournament.settings).find(item => item.available);
  const matchId = fixture.match.id;
  const [a, b] = [fixture.match.a, fixture.match.b];
  const root = testMode ? "testTournaments" : "tournaments";
  const cupPath = root + "/cup";
  const records = new Map([[cupPath, tournament]]);
  for (const uid of [...Object.keys(tournament.entries), "marker", "spectator"]) {
    records.set("users/" + uid, { status: "Active", linkedPlayerKey: "profile-" + uid, role: testMode ? "admin" : "member" });
  }
  const ref = path => ({
    path,
    collection: name => ({ doc: id => ref(path + "/" + name + "/" + id) })
  });
  const db = {
    collection: name => ({ doc: id => ref(name + "/" + id) }),
    runTransaction: async work => {
      const writes = [];
      const result = await work({
        get: async doc => ({ data: () => structuredClone(records.get(doc.path)) }),
        set: (doc, value) => writes.push(() => records.set(doc.path, value)),
        update: (doc, patch) => writes.push(() => records.set(doc.path, { ...records.get(doc.path), ...patch })),
        delete: doc => writes.push(() => records.delete(doc.path))
      });
      writes.forEach(write => write());
      return result;
    }
  };
  const score = createTournamentScoring({ db, timestamp: Date.now, fail: (code, message) => Object.assign(new Error(message), { code }) });
  const call = (uid, action, data) => score({ auth: { uid }, data: { tournamentId: "cup", matchId, testMode, action, ...data } });
  const player = (score, extra = {}) => ({
    ...Object.fromEntries(engine.statFields.map(key => [key, 0])), score, ...extra
  });
  const write = (uid, session, players, currentPlayer, winnerIndex = null) => call(uid, "write", {
    revision: session.revision, requestId: "visit-" + session.revision, starter: 0, state: { players, currentPlayer, winnerIndex }
  });
  return { records, cupPath, call, matchId, a, b, player, write };
}

test("online fixtures require both players, acceptance and scoring on the correct turn", async () => {
  const { call, a, b, player, write } = await setup("online");
  await assert.rejects(call(a, "open", { mode: "chalk" }), { code: "permission-denied" });
  await assert.rejects(call("spectator", "open", { mode: "shared" }), { code: "permission-denied" });
  const invite = await call(a, "open", { mode: "shared" });
  assert.equal(invite.status, "invited");
  await assert.rejects(write(a, invite, [player(301), player(301)], 0), { code: "permission-denied" });
  const accepted = await call(b, "open", { mode: "shared" });
  assert.equal(accepted.status, "playing");
  const start = await write(a, accepted, [player(301), player(301)], 0);
  await assert.rejects(write(b, start, [player(301), player(301)], 0), { code: "permission-denied" });
  const turn = await write(a, start, [player(241, { dartsThrown: 3, totalScored: 60 }), player(301)], 1);
  assert.equal(turn.state.currentPlayer, 1);
  const retry = await write(a, start, turn.state.players, 1);
  assert.equal(retry.revision, turn.revision);
  await assert.rejects(write(b, turn, [player(240), player(261, { dartsThrown: 3, totalScored: 40 })], 0),
    { code: "invalid-argument" });
});

test("a marker can score immediately and both profiles receive the result once", async () => {
  const { call, records, cupPath, matchId, a, b, player, write } = await setup("inPerson");
  await assert.rejects(call("marker", "open", { mode: "chalk" }), { code: "permission-denied" });
  await call("marker", "marker");
  const claimed = await call("marker", "open", { mode: "chalk" });
  assert.equal(claimed.status, "playing");
  await assert.rejects(call(a, "open", { mode: "shared" }), { code: "permission-denied" });
  const started = await write("marker", claimed, [player(301), player(301)], 0);
  const players = [player(0, { legs: 1, totalScored: 301, dartsThrown: 12 }), player(160)];
  await write("marker", started, players, 0, 0);
  await write("marker", started, players, 0, 0);
  assert.equal(records.get(cupPath).results[matchId].winnerIndex, 0);
  assert.equal(records.get(cupPath).matchSessions[matchId], undefined);
  const match = records.get("dartMatches/TOURNAMENT-cup-" + matchId);
  assert.equal(match.playerOneId, "profile-" + a);
  assert.equal(match.playerTwoId, "profile-" + b);
  assert.equal(match.submittedBy, "marker");
});

test("test matches update the private tournament without writing profile statistics", async () => {
  const { call, records, cupPath, matchId, a, player, write } = await setup("inPerson", true);
  const claimed = await call(a, "open", { mode: "chalk" });
  const started = await write(a, claimed, [player(301), player(301)], 0);
  await write(a, started, [player(0, { legs: 1 }), player(301)], 0, 0);
  assert.equal(records.get(cupPath).results[matchId].winnerIndex, 0);
  assert.equal(records.has("dartMatches/TOURNAMENT-cup-" + matchId), false);
});
