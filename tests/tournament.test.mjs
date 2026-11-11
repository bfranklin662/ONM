import test from "node:test";
import assert from "node:assert/strict";
import {
  countdownLabel, fixtureSchedule, groupPoints, makeDraw, makeResult, matchOutcome, matchSettings, simulateTournamentResults, tournamentStartTime, tournamentView, validateSettings, validDoubleInVisit, doubleInCheckout, statFields
} from "../scripts/tournament-engine.mjs";
import { scorerUrl, tournamentStore, tournamentUrl } from "../scripts/tournament-store.mjs";
import { pendingStarts } from "../scripts/tournament-notifications.mjs";

const settings = {
  structure: "combined", capacity: 16, groupSize: 4, qualifiers: 12, drawMode: "ability",
  gameType: "bestOf", legsCount: 3, startScore: 501, inMode: "straight"
};

function tournament(overrides = {}, count = 16) {
  const ids = Array.from({ length: count }, (_, i) => `p${i + 1}`);
  const data = {
    settings: { ...settings, ...overrides },
    entries: Object.fromEntries(ids.map(id => [id, id])),
    seeds: Object.fromEntries(ids.map((id, i) => [id, i + 1])),
    results: {},
    status: "live"
  };
  data.draw = makeDraw(data);
  return data;
}

function stats(legs) {
  return {
    ...Object.fromEntries(statFields.map(field => [field, 0])),
    legs, totalScored: 501 * legs, dartsThrown: 20 * legs + 12,
    checkoutHits: legs, checkoutAttempts: 3 * legs, highestOut: 50,
    oneEightys: legs, bullOuts: legs
  };
}

function finish(data, match) {
  data.results[match.id] = makeResult(data.settings, 0, [stats(2), stats(1)], match.id);
}

test("start notifications target entrants and apply the countdown only to online tournaments", () => {
  const now = 100_000_000;
  const live = {
    id: "cup", status: "live", startedAt: { toMillis: () => now }, entries: { nick: "Nick" },
    settings: { ...settings, playMode: "online", startDelayMinutes: 5 }
  };
  const event = { tournament: live, testMode: false };
  assert.equal(tournamentStartTime(live), now + 300_000);
  assert.equal(tournamentStartTime({ ...live, settings: { ...live.settings, playMode: "inPerson" } }), now);
  assert.equal(countdownLabel(tournamentStartTime(live) - now - 123_100), "2:57");
  assert.deepEqual(pendingStarts([event], "nick", () => false, now), [event]);
  assert.deepEqual(pendingStarts([event], "spectator", () => false, now), []);
  assert.deepEqual(pendingStarts([event], "nick", key => key === "public:cup:100000000", now), []);
  assert.deepEqual(pendingStarts([event], "nick", () => false, now + 86_400_001), []);
  assert.throws(() => validateSettings({ ...live.settings, startDelayMinutes: 61 }), /countdown/);
  assert.throws(() => validateSettings({ ...live.settings, playMode: "inPerson" }), /countdown/);
});

test("12 group qualifiers fill a 16-slot bracket with four byes and advance to a final", () => {
  const data = tournament();
  let view = tournamentView(data);
  assert.equal(view.groups.length, 4);
  assert.deepEqual(view.groups[0].rows.map(row => row.id), ["p1", "p2", "p3", "p4"]);
  assert.equal(view.rounds[0].length, 8);
  assert.ok(view.rounds.flat().every(match => !match.ready));
  for (const group of view.groups) for (const match of group.matches) finish(data, match);
  view = tournamentView(data);
  assert.equal(view.qualified.length, 12);
  assert.equal(view.rounds[0].filter(match => match.bye).length, 4);
  assert.equal(view.rounds[0].filter(match => match.ready).length, 4);
  while (!view.complete) {
    const ready = view.matches.filter(match => match.ready && !match.result);
    assert.ok(ready.length);
    ready.forEach(match => finish(data, match));
    view = tournamentView(data);
  }
  assert.equal(view.winners.length, 1);
  assert.equal(Object.keys(data.results).length, 24 + 11);
  assert.equal(view.players.reduce((sum, row) => sum + row.bullOuts, 0), 35 * 3);
});

test("standalone groups name a winner per pool and record each pairing once", () => {
  const data = tournament({ structure: "groups", groupSize: 8, capacity: 128 }, 128);
  let view = tournamentView(data);
  assert.equal(view.groups.length, 16);
  assert.equal(view.matches.length, 448);
  view.matches.forEach(match => finish(data, match));
  view = tournamentView(data);
  assert.equal(view.rounds.length, 0);
  assert.equal(view.winners.length, 16);
  assert.ok(view.players.every(row => row.played === 7));
  assert.ok(JSON.stringify(data).length < 500_000);
});

test("a sparse knockout resolves empty slots and plays only three matches with four entrants", () => {
  const data = tournament({ structure: "knockout", capacity: 128 }, 4);
  let view = tournamentView(data);
  assert.ok(view.rounds[0].every(match => match.bye));
  assert.ok(view.rounds[4].every(match => match.bye));
  assert.equal(view.rounds[5].filter(match => match.ready).length, 2);
  view.rounds[5].forEach(match => finish(data, match));
  view = tournamentView(data);
  assert.ok(view.rounds[6][0].ready);
  finish(data, view.rounds[6][0]);
  assert.equal(tournamentView(data).winners[0], "p1");
});

test("match rules reject invalid formats and validate double-in scoring and bull finishes", () => {
  assert.throws(() => validateSettings({ ...settings, legsCount: 4 }), /odd/);
  assert.throws(() => validateSettings({ ...settings, playMode: "hybrid" }), /Online or In person/);
  assert.doesNotThrow(() => validateSettings({ ...settings, gameType: "firstTo", legsCount: 4 }));
  assert.throws(() => makeResult(settings, 0, [stats(1), stats(1)], "result"), /completed/);
  assert.equal(validDoubleInVisit(0), true);
  assert.equal(validDoubleInVisit(1), false);
  assert.equal(validDoubleInVisit(170), true);
  assert.equal(validDoubleInVisit(180), false);
  assert.deepEqual(doubleInCheckout(2).darts, []);
  assert.deepEqual(doubleInCheckout(4).darts, [2, 3]);
  assert.equal(doubleInCheckout(100).bull(2), true);
  assert.equal(doubleInCheckout(100).other(2), false);
});

test("fixture waves assign distinct boards and players and stay stable through qualification", () => {
  const data = tournament({ playMode: "inPerson", boardCount: 3 });
  const schedule = fixtureSchedule(tournamentView(data), data.settings);
  const groups = schedule.filter(fixture => fixture.stage.startsWith("Group"));
  assert.equal(groups.length, 24);
  assert.equal(schedule.length, 35);
  assert.ok(groups.some(fixture => fixture.board === 3));
  const waves = new Map();
  for (const { match, wave, board } of groups) {
    const used = waves.get(wave) ?? new Set();
    for (const key of [board, match.a, match.b]) {
      assert.ok(!used.has(key), "Duplicate assignment in wave " + wave);
      used.add(key);
    }
    waves.set(wave, used);
    finish(data, match);
  }
  const view = tournamentView(data);
  const assignments = fixtures => fixtures.map(({ match, wave, board }) => [match.id, wave, board]);
  assert.deepEqual(assignments(fixtureSchedule(view, data.settings)), assignments(schedule));
  assert.ok(fixtureSchedule(view, { ...data.settings, playMode: "online" }).every(fixture => fixture.board === undefined));
  assert.throws(() => validateSettings({ ...data.settings, boardCount: 0 }), /boards/);
  assert.throws(() => validateSettings({ ...data.settings, playMode: "online" }), /boards/);
});

test("even Best of group matches can draw and later knockout rounds use their own settings", () => {
  const config = { ...settings, qualifiers: 8, groupLegs: 4, quarterFinalLegs: 5, semiFinalLegs: 7, finalLegs: 9 };
  const data = tournament(config);
  let view = tournamentView(data);
  const format = matchSettings(config, view.groups[0].matches[0]);
  assert.deepEqual(view.rounds[0][0].openingLabels, ["Winner G1", "Runner-up G2"]);
  assert.equal(view.rounds[1][0].openingLabels, undefined);
  assert.equal(format.allowDraw, true);
  assert.equal(matchSettings({ ...config, groupLegs: 3 }, view.groups[0].matches[0]).allowDraw, false);
  assert.equal(groupPoints({ wins: 2, draws: 1 }), 7);
  assert.equal(matchOutcome(format, [stats(2), stats(1)]), null);
  assert.equal(matchOutcome(format, [stats(3), stats(1)]), 0);
  assert.throws(() => makeResult(format, 0, [stats(3), stats(2)], "invalid"), /completed/);
  assert.doesNotThrow(() => validateSettings({ ...config, structure: "groups", legsCount: 4,
    quarterFinalLegs: undefined, semiFinalLegs: undefined, finalLegs: undefined }));
  assert.throws(() => validateSettings({ ...config, finalLegs: 8 }), /odd number/);
  const highestAverage = view.groups[0].rows.at(-1).id;
  const firstGroupMatch = view.groups[0].matches[0];
  data.results[firstGroupMatch.id] = makeResult(format, -1, [stats(2), stats(2)], firstGroupMatch.id);
  const projected = tournamentView(data);
  assert.equal(projected.projectedQualified.length, config.qualifiers);
  assert.deepEqual(projected.qualified, []);
  for (const match of view.groups.flatMap(group => group.matches)) {
    const players = [match.a, match.b].map(id => id === highestAverage ? { ...stats(2), dartsThrown: 30 } : stats(2));
    data.results[match.id] = makeResult(format, -1, players, match.id);
  }
  view = tournamentView(data);
  assert.deepEqual(view.projectedQualified, []);
  assert.ok(view.groups[0].rows.every(row => row.wins === 0 && row.draws === 3));
  assert.equal(view.groups[0].rows[0].id, highestAverage);
  assert.deepEqual(view.groupOrigins[highestAverage], { group: view.groups[0].name, place: 1 });
  const openingQuarterFinal = view.rounds[0][0];
  assert.deepEqual(view.groupOrigins[openingQuarterFinal.a], { group: "1", place: 1 });
  assert.deepEqual(view.groupOrigins[openingQuarterFinal.b], { group: "2", place: 2 });
  assert.deepEqual(openingQuarterFinal.openingLabels, [undefined, undefined]);
  assert.deepEqual(view.rounds.map(round => matchSettings(config, round[0]).legsCount), [5, 7, 9]);
  const final = matchSettings(config, view.rounds.at(-1)[0]);
  assert.equal(final.allowDraw, false);
  assert.equal(matchOutcome(final, [stats(4), stats(4)]), null);
  assert.equal(matchOutcome(final, [stats(5), stats(4)]), 0);
});

test("a board calls its next player after its own previous result, independently of other boards", () => {
  const data = tournament({ structure: "knockout", capacity: 8, boardCount: 2 }, 8);
  const schedule = () => fixtureSchedule(tournamentView(data), data.settings);
  const first = schedule().find(item => item.board === 1 && item.wave === 1);
  const next = schedule().find(item => item.board === 1 && item.wave === 2);
  const nextOnOtherBoard = schedule().find(item => item.board === 2 && item.wave === 2);
  assert.equal(first.available, true);
  assert.equal(next.waitingFor, "board");
  finish(data, first.match);
  assert.equal(schedule().find(item => item.match.id === next.match.id).available, true);
  assert.equal(schedule().find(item => item.match.id === nextOnOtherBoard.match.id).waitingFor, "board");
  assert.equal(schedule().find(item => item.wave === 3).waitingFor, "players");
});

test("an uncapped in-person knockout sizes its draw from more than 128 entrants", () => {
  const data = tournament({ structure: "knockout", playMode: "inPerson", capacity: null }, 129);
  const view = tournamentView(data);
  assert.equal(view.rounds[0].length, 128);
  assert.equal(view.rounds[0].filter(match => match.ready).length, 1);
  assert.equal(fixtureSchedule(view, data.settings).length, 128);
  assert.throws(() => makeDraw({ ...data, settings: { ...data.settings, playMode: "online", capacity: 128 } }), /player limit/);
});

test("test simulation includes signed-in entrants and fills both brackets locally", () => {
  const entries = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`dummy-${index + 1}`, `Player ${index + 1}`]));
  entries.nick = "Nick";
  const data = {
    status: "live", entries, results: {}, seeds: {},
    settings: { ...settings, playMode: "inPerson", capacity: null, boardCount: 3, qualifiers: 6, drawMode: "random", plate: true }
  };
  data.draw = makeDraw(data, () => 0.5);
  const initial = tournamentView(data);
  assert.equal(initial.plateRounds[0].length, 2);
  assert.ok(initial.plateRounds.flat().every(match => !match.ready));
  const next = simulateTournamentResults(data, () => 0.5, 1);
  assert.equal(Object.keys(next).length, 1);
  const following = simulateTournamentResults({ ...data, results: next }, () => 0.5, 1);
  assert.equal(Object.keys(following).length, 1);
  assert.notEqual(Object.keys(next)[0], Object.keys(following)[0]);
  const simulated = simulateTournamentResults(data, () => 0.5);
  assert.deepEqual(data.results, {});
  const view = tournamentView({ ...data, results: simulated });
  assert.ok(view.complete);
  assert.ok(view.matches.some(match => match.result && (match.a === "nick" || match.b === "nick")));
  assert.ok(!view.qualified.includes(view.plateWinner));
  assert.ok(view.qualified.includes(view.winners[0]));
  assert.ok(view.players.every(player => player.dartsThrown > 0 && player.firstNineScored > 0));
  const { "p2-1": plateFinal, ...withoutPlateFinal } = simulated;
  assert.ok(plateFinal);
  assert.equal(tournamentView({ ...data, results: withoutPlateFinal }).complete, false);
  assert.equal(fixtureSchedule(view, data.settings).filter(fixture => fixture.stage.startsWith("Plate")).length, 3);
});

test("transaction retries are idempotent and a second scorekeeper cannot replace a result", async () => {
  const data = tournament({ structure: "knockout", capacity: 4 }, 4);
  let writes = 0;
  globalThis.window = { ONMFirebase: { ready: Promise.resolve({
    db: {},
    firestoreSdk: {
      collection: () => "tournaments",
      doc: () => "test-tournament",
      runTransaction: (_db, change) => change({
        get: async () => ({ exists: () => true, data: () => data }),
        update: (_ref, patch) => { writes++; Object.assign(data, patch); }
      })
    }
  }) } };
  const store = await tournamentStore();
  const [match] = tournamentView(data).matches;
  const submit = id => store.saveResult("test", match.id, [match.a, match.b], 0, [stats(2), stats(1)], id);
  await submit("same");
  await submit("same");
  await assert.rejects(submit("different"), /already been saved/);
  assert.equal(writes, 1);
});

test("dummy entrants and completed test results stay in the private tournament collection", async t => {
  const records = { tournaments: {}, testTournaments: {} };
  const previousWindow = globalThis.window;
  t.after(() => { globalThis.window = previousWindow; });
  globalThis.window = { ONMFirebase: { ready: Promise.resolve({
    db: {},
    firestoreSdk: {
      collection: (_db, name) => records[name],
      doc: (collection, id) => collection[id],
      query: collection => collection,
      orderBy: () => null,
      onSnapshot: (collection, next) => next({
        docs: Object.entries(collection).map(([id, data]) => ({ id, data: () => data }))
      }),
      serverTimestamp: () => "timestamp",
      addDoc: async (collection, data) => {
        collection.sameId = data;
        return { id: "sameId" };
      },
      getDocFromServer: async data => ({ exists: () => Boolean(data), data: () => data }),
      runTransaction: (_db, change) => change({
        get: async data => ({ exists: () => Boolean(data), data: () => data }),
        update: (data, patch) => Object.assign(data, patch),
        delete: data => {
          const collection = Object.values(records).find(items => items.sameId === data);
          delete collection.sameId;
        }
      })
    }
  }) } };
  const admin = { uid: "admin", role: "admin", status: "Active" };
  const owner = { ...admin, uid: "owner", role: "owner", firstName: "Nick" };
  const config = { ...settings, structure: "knockout", capacity: 4, qualifiers: null, playMode: "inPerson" };
  const publicStore = await tournamentStore();
  const privateStore = await tournamentStore(true);
  await assert.rejects(publicStore.create("Public", settings, admin), /Online or In person/);
  await assert.rejects(privateStore.create("Test", config, { ...admin, role: "member" }, 4), /administrator/);
  await assert.rejects(privateStore.create("Test", config, admin, 513), /dummy entrants/);
  await assert.rejects(publicStore.create("Public", config, admin, 4), /test tournaments only/);
  await publicStore.create("Public", { ...config, playMode: "online" }, owner);
  const id = await privateStore.create("Test", { ...config, boardCount: 2 }, admin, 3);
  const data = await privateStore.load(id);
  assert.equal(data.settings.playMode, "inPerson");
  assert.equal(data.settings.boardCount, 2);
  assert.equal(Object.keys(data.entries).length, 3);
  assert.equal(data.entries["dummy-001"], "Dummy Player 001");
  const publicData = await publicStore.load(id);
  assert.equal(publicData.createdBy, owner.uid);
  assert.equal(publicData.settings.playMode, "online");
  assert.deepEqual(publicData.entries, {});
  await assert.rejects(publicStore.joinOrLeave(id, null, true), /active site account/);
  const entrant = { uid: "player", status: "Active", firstName: "Nick" };
  await publicStore.joinOrLeave(id, entrant, true);
  assert.deepEqual((await publicStore.load(id)).entries, { player: "Nick" });
  assert.equal(Object.keys(data.entries).length, 3);
  await assert.rejects(privateStore.joinOrLeave(id, entrant, true), /private tests/);
  await privateStore.joinOrLeave(id, owner, true);
  await privateStore.joinOrLeave(id, owner, true);
  assert.equal(data.entries[owner.uid], "Nick");
  assert.equal(Object.keys(data.entries).length, 4);
  await privateStore.joinOrLeave(id, owner, false);
  assert.equal(Object.keys(data.entries).length, 3);
  await privateStore.joinOrLeave(id, owner, true);
  await privateStore.start(id, Object.fromEntries(Object.keys(data.entries).map((uid, index) => [uid, index + 1])));
  await privateStore.markMatchInPlay(id, "k1-1", "scorer", true);
  assert.equal(data.activeMatches["k1-1"].submissionId, "scorer");
  await privateStore.markMatchInPlay(id, "k1-1", "scorer", true, true);
  assert.equal(data.activeMatches["k1-1"].parked, true);
  await privateStore.markMatchInPlay(id, "k1-1", "scorer", true);
  assert.equal(data.activeMatches["k1-1"].parked, false);
  await privateStore.markMatchInPlay(id, "k1-1", "other-scorer", false);
  assert.equal(data.activeMatches["k1-1"].submissionId, "scorer");
  await privateStore.markMatchInPlay(id, "k1-1", "scorer", false);
  assert.deepEqual(data.activeMatches, {});
  await assert.rejects(privateStore.joinOrLeave(id, owner, false), /Entries are closed/);
  await assert.rejects(async () => privateStore.editRules(id, entrant, { legsCount: 1 }), /administrator/);
  for (let played = 0; played < 3; played++) {
    const match = tournamentView(data).matches.find(item => item.ready && !item.result);
    const url = new URL(scorerUrl(id, match.id, true), "https://example.test");
    assert.equal(url.searchParams.get("test"), "1");
    const entrants = [match.a, match.b];
    if (played === 1) {
      await privateStore.editRules(id, owner, { boardCount: 1, legsCount: 1, capacity: 64 });
      assert.equal(data.settings.boardCount, 1);
      assert.equal(data.settings.capacity, 4);
      assert.equal(data.results["k1-1"].format.legsCount, 3);
    }
    const openedFormat = played === 1 ? { gameType: "bestOf", legsCount: 3 } : undefined;
    await privateStore.saveResult(id, match.id, entrants, 0, played === 2 ? [stats(1), stats(0)] : [stats(2), stats(1)], match.id, openedFormat);
    assert.equal(data.results[match.id].format.legsCount, played === 2 ? 1 : 3);
  }
  await assert.rejects(privateStore.editRules(id, admin, { legsCount: 3 }), /finished/);
  assert.equal(tournamentUrl(id, true), "tournament.html?id=sameId&test=1");
  privateStore.watchLobby(items => assert.deepEqual(items.map(item => item.status), ["complete"]));
  publicStore.watchLobby(items => assert.deepEqual(items.map(item => item.status), ["open"]));
  await assert.rejects(privateStore.deleteTournament(id, owner), /Only the creator/);
  await assert.rejects(privateStore.deleteTournament(id, { ...admin, status: "Inactive" }), /Only the creator/);
  await privateStore.deleteTournament(id, admin);
  await assert.rejects(privateStore.load(id), /not found/);
  assert.equal((await publicStore.load(id)).title, "Public");
});
