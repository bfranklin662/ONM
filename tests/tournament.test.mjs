import test from "node:test";
import assert from "node:assert/strict";
import {
  makeDraw, makeResult, tournamentView, validateSettings, validDoubleInVisit, doubleInCheckout, statFields
} from "../scripts/tournament-engine.mjs";
import { tournamentStore } from "../scripts/tournament-store.mjs";

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
