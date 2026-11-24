const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const fines = fs.readFileSync(require.resolve("../scripts/fines.js"), "utf8");
const admin = fs.readFileSync(require.resolve("../scripts/admin.js"), "utf8");

function functionRange(source, first, next) {
  return source.slice(source.indexOf(first), source.indexOf(next, source.indexOf(first)));
}

function matchHarness() {
  const fixtures = [
    { key: "a", dateValue: "2026-11-24", League: "Banks League", opponent: "Exiles", homeAway: "Home", Player1: "Nick B", Player3: "Ricky" },
    { key: "b", dateValue: "2026-11-25", League: "Trafalgar League", opponent: "Pandas", homeAway: "Away", Player1: "George" }
  ];
  const context = vm.createContext({
    MAX_PLAYERS: 12,
    DEFAULT_PLAYER_INPUTS: 6,
    playerInputCount: 6,
    players: [],
    store: { setupNames: [] },
    setupGrid: { replaceChildren() {} },
    matchFixture: {},
    loadSetupLineup: {},
    setupLineupStatus: {},
    playerInputValue: value => value,
    applyFixture(fixture) { context.match = fixture; },
    renderSetupInputs() {},
    saveStore() {},
    readMatchInfo() {},
    availableFixtures: () => fixtures
  });
  vm.runInContext(functionRange(fines, "  function normalisePlayerName(", "  function findPlayerDirectoryEntry(") +
    functionRange(fines, "  function setupFixtureIdentity(", "  function renderSetupFixtureSelector("), context);
  return { context, fixtures };
}

test("an empty match setup loads its saved lineup in order and keeps it editable", () => {
  const { context, fixtures } = matchHarness();
  context.applySetupFixture(fixtures[0]);
  assert.deepEqual(Array.from(context.store.setupNames), ["Nick B", "Ricky"]);
  assert.equal(context.matchFixture.value, "a");
  assert.match(context.setupLineupStatus.textContent, /late swap/i);
  context.applySetupFixture(fixtures[1]);
  assert.deepEqual(Array.from(context.store.setupNames), ["George"]);
});

test("fixture changes and refreshes preserve late swaps unless the saved lineup is explicitly loaded", () => {
  const { context, fixtures } = matchHarness();
  context.applySetupFixture(fixtures[0]);
  context.store.setupNames[0] = "Phil";
  context.applySetupFixture(fixtures[0]);
  assert.equal(context.store.setupNames[0], "Phil");
  context.applySetupFixture(fixtures[1]);
  assert.equal(context.store.setupNames[0], "Phil");
  assert.equal(context.loadSetupLineup.hidden, false);
  context.applySetupFixture(fixtures[1], { replaceNames: true });
  assert.equal(context.store.setupNames[0], "George");
  context.store.game = { players: ["George"] };
  context.applySetupFixture(fixtures[0], { replaceNames: true });
  assert.equal(context.store.setupNames[0], "George");
});

test("fixture save persists public player names and rejects duplicates", async () => {
  const writes = [];
  const context = vm.createContext({
    clean: value => String(value ?? "").trim(),
    rowFor: item => item?.sheetRow || {},
    dayName: () => "Tuesday",
    fixtureDate: value => value,
    DEFAULT_MATCH_TIME: "18:30",
    renderFixtures() {},
    renderPlayers() {},
    state: { editor: { id: "fixture-a" }, fixtures: [{ id: "fixture-a", sheetRow: {} }], user: { uid: "admin" } },
    window: { ONMFirebase: { ready: {
      db: {},
      firestoreSdk: { doc() {}, serverTimestamp() {}, setDoc(_, saved) { writes.push(saved); } }
    } } }
  });
  vm.runInContext(functionRange(admin, "  async function saveFixture(", "  async function saveResult("), context);
  const fields = new Map([["eventType", "fixture"], ["lineupPlayer1", "Nick B"], ["lineupPlayer2", "Ricky"]]);
  await context.saveFixture(fields);
  assert.equal(writes[0].sheetRow.Player1, "Nick B");
  assert.equal(writes[0].sheetRow.Player2, "Ricky");
  fields.set("lineupPlayer12", "nick b");
  await assert.rejects(context.saveFixture(fields), /only once/);
  assert.equal(writes.length, 1);
  fields.set("eventType", "social");
  await context.saveFixture(fields);
  assert.equal(writes[1].sheetRow.Player1, "");
});

test("both Match routes keep the tracker hidden until Firebase restores a signed-in user", async () => {
  for (const route of ["../match.html", "../match/index.html"]) {
    const markup = fs.readFileSync(require.resolve(route), "utf8");
    assert.match(markup, /id="matchTracker"[^>]*\bhidden\b/);
    assert.match(markup, /id="matchSignInLink"[^>]*redirect=%2Fmatch/);
  }
  for (const user of [null, { uid: "player-1" }]) {
    const nodes = {
      matchTracker: { hidden: true },
      matchSignIn: { hidden: false },
      matchSignInStatus: {},
      matchSignInLink: { hidden: true }
    };
    let start;
    let matchDataStarted = false;
    let authChanged;
    let reloaded = false;
    const context = vm.createContext({
      document: {
        addEventListener(_, callback) { start = callback; },
        getElementById: id => nodes[id]
      },
      window: {
        ONMFirebase: {
          async currentFirebaseUser() { return user; },
          ready: Promise.resolve({ auth: {}, authSdk: {
            onAuthStateChanged(_, callback) { authChanged = callback; }
          } })
        },
        location: { reload() { reloaded = true; } }
      },
      console: { log() {} },
      startMatchData() { matchDataStarted = true; }
    });
    vm.runInContext(fines.slice(0, fines.indexOf("  // ---- Constants ----")) + "startMatchData(); });", context);
    await start();
    assert.equal(matchDataStarted, Boolean(user));
    assert.equal(nodes.matchTracker.hidden, !user);
    if (!user) {
      assert.match(nodes.matchSignInStatus.textContent, /Sign in to view upcoming games/);
      assert.equal(nodes.matchSignInLink.hidden, false);
    } else {
      authChanged(null);
      assert.equal(nodes.matchTracker.hidden, true);
      assert.equal(reloaded, true);
    }
  }
});
