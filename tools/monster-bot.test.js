const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../scripts/monster-bot-engine.js");
const fs = require("node:fs");
const vm = require("node:vm");
function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
test("only possible scores and double-out finishes are accepted", () => {
  assert.equal(E.validateVisit(501, 180), "");
  assert.notEqual(E.validateVisit(501, 179), "");
  assert.notEqual(E.validateVisit(20, 19), "");
  assert.notEqual(E.validateVisit(20, 21), "");
  assert.equal(E.validateVisit(170, 170, 3), "");
  assert.notEqual(E.validateVisit(169, 169, 3), "");
  assert.equal(E.validateVisit(50, 50, 1), "");
  assert.notEqual(E.validateVisit(60, 60, 1), "");
});

async function gameHarness(stored = new Map(), account = null) {
  const elements = new Map(), writes = []; let callback;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: "", hidden: false, disabled: false, textContent: "", innerHTML: "", listeners: {},
      classList: { toggle() {} }, focus() {}, querySelectorAll() { return []; },
      addEventListener(event, fn) { this.listeners[event] = fn; }
    });
    return elements.get(id);
  }
  element("bestOf").value = "1"; element("firstThrow").value = "player"; element("checkoutDarts").value = "3";
  const context = {
    window: { MonsterBotEngine: { ...E, botVisit: (remaining) => ({ remaining, score: 0, darts: 3, attempts: 0, hits: [0, 0, 0] }) }, ONMFirebase: {
      loadOwnUser: async () => account,
      ready: Promise.resolve({ db: {}, firestoreSdk: {
        doc: (_db, collection, uid) => `${collection}/${uid}`,
        getDoc: async () => ({ data: () => ({ monsterBotWins: ["2-3"] }) }),
        arrayUnion: (...values) => values,
        updateDoc: async (path, data) => writes.push({ path, data })
      } })
    }, addEventListener() {} },
    document: { getElementById: element },
    localStorage: { getItem: k => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) },
    setTimeout: fn => { callback = fn; return 1; }, clearTimeout: () => { callback = null; }, confirm: () => true, Math
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/monster-bot.js"), "utf8"), context);
  await new Promise(resolve => setImmediate(resolve));
  const click = id => element(id).listeners.click();
  const start = (level = 1, mode = 1) => {
    element(`bot-mode-${level}`).value = String(mode);
    element("botLevels").listeners.click({ target: { closest: selector => selector === "[data-play-level]" ? ({ dataset: { playLevel: String(level) } }) : null } });
  };
  const bot = () => { const fn = callback; callback = null; if (fn) fn(); };
  const score = n => { element("visitScore").value = String(n); element("scoreForm").listeners.submit({ preventDefault() {} }); };
  return { element, click, bot, score, stored, writes, start };
}

test("match lengths, alternating starts, wins and gold progress survive reload", async () => {
  const g = await gameHarness();
  for (const mode of E.MODES) {
    g.start(1, mode);
    for (let leg = 0; leg < (mode + 1) / 2; leg++) {
      if (leg) { g.click("nextLeg"); g.bot(); }
      g.score(180); g.bot(); g.score(180); g.bot(); g.score(141);
    }
    await new Promise(resolve => setImmediate(resolve));
    assert.match(g.element("turnStatus").textContent, /You win/);
    g.click("backToLevels");
  }
  assert.deepEqual(JSON.parse(g.stored.get("onm-monster-bot-guest")).sort(), ["1-1", "1-3", "1-5", "1-7"]);
  assert.match(g.element("botLevels").innerHTML, /☑ Complete/);
  assert.match(g.element("progressSummary").textContent, /4 \/ 40 formats won · 1 \/ 10 levels complete/);
  const reloaded = await gameHarness(g.stored);
  assert.match(reloaded.element("progressSummary").textContent, /4 \/ 40 formats won · 1 \/ 10 levels complete/);
});

test("signed-in progress loads and saves only on that user's account", async () => {
  const g = await gameHarness(new Map(), { uid: "test-member" });
  assert.match(g.element("progressSummary").textContent, /1 \/ 40/);
  g.start(); g.score(180); g.bot(); g.score(180); g.bot(); g.score(141);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(g.writes.at(-1).path, "users/test-member");
  assert.deepEqual(Array.from(g.writes.at(-1).data.monsterBotWins), ["1-1"]);
  assert.ok(g.stored.has("onm-monster-bot-test-member"));
  assert.equal(g.stored.has("onm-monster-bot-guest"), false);
});

test("invalid scores, busts, undo and abandoned matches never grant victories", async () => {
  const g = await gameHarness(); g.start();
  g.score(179); assert.match(g.element("scoreError").textContent, /possible/); assert.equal(g.element("playerRemaining").textContent, 501);
  g.click("bustVisit"); g.bot(); assert.equal(g.element("playerRemaining").textContent, 501);
  g.score(180); g.bot(); assert.equal(g.element("playerRemaining").textContent, 321);
  g.click("undoVisit"); assert.equal(g.element("playerRemaining").textContent, 501);
  g.click("leaveMatch"); assert.equal(g.stored.size, 0);
});

test("ladder is descending and a single format victory unlocks only the next bot", async () => {
  assert.equal(E.LEVELS[0].name, "Billy Bot"); assert.equal(E.LEVELS[9].name, "Filip Bot");
  for (const mode of E.MODES) {
    const wins = new Set([`1-${mode}`]);
    assert.equal(E.isUnlocked(2, wins), true);
    assert.equal(E.isUnlocked(3, wins), false);
  }
  const g = await gameHarness();
  const html = g.element("botLevels").innerHTML;
  assert.ok(html.indexOf("Filip Bot") < html.indexOf("Billy Bot"));
  assert.equal(html.includes("First 9"), false); assert.equal(html.includes("Checkout:"), false);
  g.start(2);
  assert.equal(g.element("matchTitle").textContent, "");
  g.start(); g.score(180); g.bot(); g.score(180); g.bot(); g.score(141);
  await new Promise(resolve => setImmediate(resolve));
  g.click("backToLevels"); g.start(2, 3);
  assert.equal(g.element("matchTitle").textContent, "You vs Croft Bot");
  assert.match(g.element("matchFormat").textContent, /Best of 3/);
});
test("each bot finishes legal legs with the requested long-run profile", () => {
  for (const profile of E.LEVELS) {
    const stats = E.simulate(profile, 6000, seeded(200 + profile.level));
    assert.ok(Math.abs(stats.average - profile.average) < 2, `Level ${profile.level}: average ${stats.average}`);
    assert.ok(stats.firstNine >= profile.firstNine[0] && stats.firstNine <= profile.firstNine[1], `First nine ${stats.firstNine}`);
    assert.ok(stats.checkout >= profile.checkout[0] && stats.checkout <= profile.checkout[1], `Checkout ${stats.checkout}`);
    const random = seeded(profile.level);
    for (let leg = 0; leg < 60; leg++) {
      let remaining = 501, thrown = 0;
      while (remaining && thrown < 600) {
        const visit = E.botVisit(remaining, thrown, profile, random);
        assert.ok(visit.darts >= 1 && visit.darts <= 3);
        if (visit.bust) assert.equal(visit.remaining, remaining);
        else { assert.equal(E.validateVisit(remaining, visit.score, visit.darts), ""); assert.equal(remaining - visit.score, visit.remaining); }
        remaining = visit.remaining; thrown += visit.darts;
      }
      assert.equal(remaining, 0);
    }
  }
});
