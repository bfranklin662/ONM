"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../scripts/fixtures.js"), "utf8");
function harness() {
  const context = { window: {}, document: {}, console };
  vm.createContext(context);
  const state = source.slice(source.indexOf("  const personal ="), source.indexOf("  async function loadPersonalAvailability("));
  const normalise = source.slice(source.indexOf("  function normalizeName("), source.indexOf("  function isOnmTeam("));
  const escape = source.slice(source.indexOf("  function escapeFixtureText("), source.indexOf("  function calendarResultEvents("));
  vm.runInContext(state + normalise + escape + "\nthis.personal = personal;", context);
  context.personal.user = { uid: "u", linkedPlayerKey: "nick", linkedPlayerName: "Nick", status: "Active" };
  const fixture = { dateISO: "2026-10-21", Opponent: "Silverbacks", HA: "Home", League: "Trafalgar League", completed: false };
  const response = { id: "sheet-fixture", date: "2026-10-21", opponent: "Sliverbacks", side: "H", league: "TRAFALGAR", status: "Available", editable: true };
  context.personal.fixtures = [response];
  return { context, personal: context.personal, fixture, response };
}

test("sheet responses match date, league, opponent aliases and home/away", () => {
  const h = harness();
  assert.equal(h.context.personalFixture(h.fixture).response.id, "sheet-fixture");
  for (const change of [{ HA: "Away" }, { dateISO: "2026-10-22" }, { League: "Banks League" }, { League: "Trafalgar Cup" }]) {
    assert.equal(h.context.personalFixture({ ...h.fixture, ...change }).state, "unknown");
  }
});

test("every valid response is coloured; unanswered is explicitly greyscale", () => {
  const h = harness();
  for (const [status, state] of [["Available", "available"], ["Unavailable", "unavailable"], ["Not sure", "unsure"], ["", "unanswered"]]) {
    h.response.status = status;
    assert.equal(h.context.personalFixture(h.fixture).state, state);
    assert(h.context.personalClass(h.fixture).includes(`fxPersonal-${state}`));
    assert(h.context.personalBadge(h.fixture).includes(status || "not answered"));
  }
});

test("connection errors and ambiguous matches never look like unanswered fixtures", () => {
  const h = harness();
  h.personal.error = "connection failed";
  assert.equal(h.context.personalFixture(h.fixture).state, "unknown");
  h.personal.error = "";
  h.personal.fixtures.push({ ...h.response, id: "duplicate" });
  assert.equal(h.context.personalFixture(h.fixture).state, "unknown");
  h.personal.fixtures = [];
  assert.equal(h.context.personalFixture(h.fixture).state, "unknown");
});

test("completed match participation comes from submitted lineups, not availability", () => {
  const h = harness();
  const played = { ...h.fixture, completed: true, playerNames: ["Nick", "Rob"] };
  h.response.status = "Unavailable";
  assert.equal(h.context.personalFixture(played).state, "played");
  assert.equal(h.context.personalFixture({ ...played, playerNames: ["Nick B"] }).state, "not-played");
  assert.equal(h.context.personalFixture({ ...played, playerNames: [] }).state, "unknown");
});

test("visitors, unlinked accounts and supporters keep normal card colours", () => {
  const h = harness();
  for (const user of [null, { linkedPlayerKey: "" }, { linkedPlayerKey: "nick", accountType: "supporter" }]) {
    h.personal.user = user;
    assert.equal(h.context.personalClass(h.fixture), "");
    assert.equal(h.context.personalBadge(h.fixture), "");
  }
});

test("bank fixtures and renamed opponents match without matching a different side", () => {
  const h = harness();
  h.personal.fixtures = [{ ...h.response, league: "BANKS", opponent: "DOGS No More", side: "A" }];
  assert(h.context.personalFixture({ ...h.fixture, League: "Banks League", Opponent: "BB Kings", HA: "Away" }).response);
  assert.equal(h.context.personalFixture({ ...h.fixture, League: "Banks League", Opponent: "BB Kings", HA: "Home" }).state, "unknown");
});

test("clicking a card shows the response and saving refreshes both views", async () => {
  const elements = new Map(), documentEvents = {}, requests = [];
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: "", textContent: "", value: "", open: false, events: {},
      addEventListener(name, callback) { this.events[name] = callback; },
      classList: { add() {}, remove() {}, toggle() {} },
      showModal() { this.open = true; }, close() { this.open = false; }
    });
    return elements.get(selector);
  };
  const response = { id: "sheet-21-oct", date: "2026-10-21", league: "TRAFALGAR", opponent: "Sliverbacks", side: "H", status: "Available", editable: true };
  let failSave = false;
  const NativeDate = Date;
  class FixedDate extends NativeDate { constructor(...args) { super(...(args.length ? args : ["2026-10-16T12:00:00Z"])); } }
  const context = { Date: FixedDate, console,
    document: { querySelector: get, querySelectorAll: () => [], addEventListener(name, callback) { documentEvents[name] = callback; } },
    window: {
      matchMedia: () => ({ matches: false }), addEventListener() {},
      ONMSeasonData: {
        fetchFixtures: async season => season === "26-27" ? [{ League: "Trafalgar League", Date: "21st Oct 2026", Day: "Wednesday", Opponent: "Silverbacks", HA: "Home", Location: "The Barley Mow" }] : [],
        fetchResults: async () => []
      },
      ONMFirebase: {
        loadOwnUser: async () => ({ uid: "u", status: "Active", linkedPlayerName: "Nick", linkedPlayerKey: "nick" }),
        availability: async (action, data) => {
          requests.push({ action, data });
          if (action === "getPlayerAvailability") return { fixtures: [{ ...response }] };
          if (failSave) throw new Error("Your response changed in the sheet. Refresh before saving again.");
          response.status = data.status;
          return { fixtureId: response.id, status: data.status };
        }
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  documentEvents.DOMContentLoaded();
  await new Promise(resolve => setImmediate(resolve));
  assert(get("#fixturesStage").innerHTML.includes("You: Available"));
  get("#fixturesStage").events.click({ target: { closest: selector => selector === "a" ? null : { dataset: { cardFixtureIndex: "0" } } } });
  assert(get("#fixtureDetails").open);
  assert(get("#fixtureDetailsContent").innerHTML.includes('value="Available" selected'));
  get("#fixtureAvailabilityChoice").value = "Unavailable";
  await get("#fixtureDetails").events.submit({ target: { id: "fixtureAvailabilityForm" }, preventDefault() {} });
  const saved = requests.find(request => request.action === "setPlayerAvailability");
  assert.equal(saved.data.fixtureId, "sheet-21-oct");
  assert.equal(saved.data.previousStatus, "Available");
  assert.equal(saved.data.status, "Unavailable");
  assert(get("#fixturesStage").innerHTML.includes("You: Unavailable"));
  assert(get("#fixtureCalendarGrid").innerHTML.includes("You: Unavailable"));
  assert.equal(get("#fixtureAvailabilityMessage").textContent, "Saved to the availability sheet.");
  failSave = true;
  get("#fixtureAvailabilityChoice").value = "Not sure";
  await get("#fixtureDetails").events.submit({ target: { id: "fixtureAvailabilityForm" }, preventDefault() {} });
  assert(get("#fixturesStage").innerHTML.includes("Availability unavailable"));
  assert(!get("#fixturesStage").innerHTML.includes("fxPersonal-unanswered"));
  assert(get("#fixtureDetailsContent").innerHTML.includes("Refresh availability"));
});
