"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../scripts/fixtures.js"), "utf8");
function harness() {
  const context = { window: {}, document: { addEventListener() {} }, console };
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

test("every response has the correct pill state and unanswered says not recorded", () => {
  const h = harness();
  for (const [status, state] of [["Available", "available"], ["Unavailable", "unavailable"], ["Not sure", "unsure"], ["", "unanswered"]]) {
    h.response.status = status;
    assert.equal(h.context.personalFixture(h.fixture).state, state);
    if (["available", "unavailable"].includes(state)) {
      assert(h.context.personalClass(h.fixture).includes(`fxPersonal-${state}`));
      assert(h.context.personalBadge(h.fixture).includes(status));
    } else {
      assert.equal(h.context.personalClass(h.fixture), "");
      assert.equal(h.context.personalBadge(h.fixture), "");
    }
  }
});

test("Selected replaces Available on the fixture card", () => {
  const h = harness();
  h.response.status = "Selected";
  assert.match(h.context.personalBadge(h.fixture), /fxPersonalBadge-selected[^>]*>Selected</);
  assert.equal(h.context.personalClass(h.fixture), "");
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
  assert.equal(h.context.personalFixture({ ...played, playerNames: ["Nick B"] }).state, "missed");
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
  let releaseFixtures;
  const fixturesReady = new Promise(resolve => { releaseFixtures = resolve; });
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: "", textContent: "", value: "", open: false, events: {},
      setAttribute() {},
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
        fetchFixtures: async season => {
          await fixturesReady;
          return season === "26-27" ? [{ League: "Trafalgar League", Date: "21st Oct 2026", Day: "Wednesday", Opponent: "Silverbacks", HA: "Home", Location: "The Barley Mow" }] : [];
        },
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
  assert.equal(get("#fixtureCalendarMonth").textContent, "October 2026");
  assert.equal((get("#fixtureCalendarGrid").innerHTML.match(/class="fixtureDayNumber"/g) || []).length, 31);
  assert.equal(get("#fixtureCalendarCount").textContent, "Loading fixtures…");
  assert(get("#fixtureCalendarEmpty").hidden);
  releaseFixtures();
  await new Promise(resolve => setImmediate(resolve));
  assert(get("#fixturesStage").innerHTML.includes("Available"));
  get("#fixturesStage").events.click({ target: { closest: selector => selector === "a" ? null : { dataset: { cardFixtureIndex: "0" } } } });
  assert(get("#fixtureDetails").open);
  assert(get("#fixtureDetailsContent").innerHTML.includes('value="Available" selected'));
  get("#fixtureAvailabilityChoice").value = "Unavailable";
  await get("#fixtureDetails").events.submit({ target: { id: "fixtureAvailabilityForm" }, preventDefault() {} });
  const saved = requests.find(request => request.action === "setPlayerAvailability");
  assert.equal(saved.data.fixtureId, "sheet-21-oct");
  assert.equal(saved.data.previousStatus, "Available");
  assert.equal(saved.data.status, "Unavailable");
  assert(get("#fixturesStage").innerHTML.includes("Unavailable"));
  assert(get("#fixtureCalendarGrid").innerHTML.includes("Unavailable"));
  assert.equal(get("#fixtureAvailabilityMessage").textContent, "Saved to the availability sheet.");
  failSave = true;
  get("#fixtureAvailabilityChoice").value = "Not sure";
  await get("#fixtureDetails").events.submit({ target: { id: "fixtureAvailabilityForm" }, preventDefault() {} });
  assert(!get("#fixturesStage").innerHTML.includes("fxPersonal-unavailable"));
  assert(!get("#fixturesStage").innerHTML.includes("fxPersonal-unanswered"));
  assert(get("#fixtureDetailsContent").innerHTML.includes("Refresh availability"));
});

test("completed fixture details show participation once and keep score and result link", () => {
  const h = harness();
  const content = { innerHTML: "" };
  const dialog = { open: false, showModal() { this.open = true; } };
  h.context.el = selector => selector === "#fixtureDetailsContent" ? content : dialog;
  h.context.getOnmTeamForFixture = () => "Oche Ness Monsters";
  h.context.RESULTS_PAGE_URL = () => "results.html?date=2026-10-21";
  const start = source.indexOf("  function availabilityDetails(");
  const end = source.indexOf("  const RESULTS_PAGE_URL", start);
  vm.runInContext(source.slice(start, end), h.context);
  h.context.openFixtureDetails({ ...h.fixture, completed: true, playerNames: ["Nick", "Rob"], homeTeam: "Oche Ness Monsters", awayTeam: "Silverbacks", homeScore: 6, awayScore: 3, resultRow: { Player1: "Nick B", C1: "99", F1: "£99.00", Player2: "Nick", C2: "3", F2: "£12.50", B2: "1", T2: "2" }, outcome: "win", Day: "Wednesday", Date: "21st Oct 2026" });
  assert.equal((content.innerHTML.match(/>Played</g) || []).length, 0);
  assert(!content.innerHTML.includes("fixtureAvailabilityForm"));
  assert(content.innerHTML.includes("6 – 3"));
  assert(content.innerHTML.indexOf("fixtureDetailsResult") < content.innerHTML.indexOf("fixtureDetailsMeta"));
  assert(content.innerHTML.includes("fixtureDetailsSide"));
  assert(!content.innerHTML.includes("fixturePersonalStats"));
  assert(content.innerHTML.includes("Fines: £12.50"));
  assert(content.innerHTML.includes("Bull ×1"));
  assert(content.innerHTML.includes("Ton+ ×2"));
  assert(content.innerHTML.includes("Checkouts: 3"));
  assert(content.innerHTML.includes("data-fixture-avatar=\"Nick\""));
  assert(content.innerHTML.includes("Fines: £99.00"));
  assert.equal((content.innerHTML.match(/class="fixtureLineupSelf"/g) || []).length, 1);
  assert(content.innerHTML.includes("View full result ↗"));
  assert(!content.innerHTML.includes("<dt>Time</dt>"));
  assert(content.innerHTML.includes("Our team"));
  assert(content.innerHTML.includes("player-profile.html?name=Nick%20B"));
  assert(content.innerHTML.indexOf("fixtureDetailsFooter") > content.innerHTML.indexOf("fixtureMatchPhotos"));
  assert(dialog.open);
  vm.runInContext('fixturePictures.live = { "Nick B": { nickname: "The Monster" } };', h.context);
  h.context.openFixtureDetails({ ...h.fixture, Player1: "Nick B", "Player 4": "Rob", C1: "99" });
  assert.match(content.innerHTML, /<em[^>]*>“The Monster”<\/em>/);
  assert(content.innerHTML.includes('aria-label="Selected team lineup"'));
  assert(content.innerHTML.indexOf('data-fixture-avatar="Nick B"') < content.innerHTML.indexOf('data-fixture-avatar="Rob"'));
  assert(!content.innerHTML.includes("Checkouts:"));
  assert(!content.innerHTML.includes("View full result"));
  assert(content.innerHTML.includes("fixtureAvailabilityForm"));
  assert(!content.innerHTML.includes("<dt>Time</dt>"));
  assert(content.innerHTML.includes("fixtureDetailsMeta"));
  assert(!content.innerHTML.includes("<dt>Home / Away</dt>"));
});


test("match editing links are only offered to active administrators", () => {
  const h = harness();
  const start = source.indexOf("  function fixtureAdminEditLink(");
  const end = source.indexOf("  function fixtureLineup(", start);
  vm.runInContext(source.slice(start,end),h.context);
  assert.equal(h.context.fixtureAdminEditLink(h.fixture), "");
  h.personal.user.role = "owner";
  assert(h.context.fixtureAdminEditLink(h.fixture).includes("edit=fixture"));
  assert(h.context.fixtureAdminEditLink({ ...h.fixture, completed:true, resultRow:{_resultId:"submitted-one"} }).includes("id=submitted-one"));
  h.personal.user.status = "Inactive";
  assert.equal(h.context.fixtureAdminEditLink(h.fixture), "");
});


test("zero checkouts show a bagel and missing statistics remain unknown", () => {
  const h = harness();
  const start = source.indexOf("  function fixturePlayerStats(");
  const end = source.indexOf("  function fixtureAdminEditLink(",start);
  vm.runInContext(source.slice(start,end),h.context);
  const fixture = { ...h.fixture, completed:true, playerNames:["Nick"], resultRow:{Player1:"Nick",C1:"0",F1:"£2.00",B1:"1"} };
  const html = h.context.fixturePlayerStats(fixture.resultRow,1) + h.context.fixtureCheckoutMarkup("0");
  assert(html.includes("🥯"));
  assert(html.includes("aria-label=\"0 checkouts\""));
  assert(html.includes("Bull ×1"));
  assert(html.includes("£2.00"));
  assert(!h.context.fixtureCheckoutMarkup("").includes("🥯"));
  assert(!h.context.fixturePlayerStats({},1).includes("fixtureSpecial"));
});


test("social events show details without match participation or result controls", () => {
  const h = harness();
  const content = {innerHTML:""};
  const dialog = {open:false,showModal(){this.open=true;}};
  h.context.el = selector => selector === "#fixtureDetailsContent" ? content : dialog;
  const start=source.indexOf("  function availabilityDetails(");
  vm.runInContext(source.slice(start,source.indexOf("  const RESULTS_PAGE_URL",start)),h.context);
  const event={...h.fixture,EventType:"social",League:"Social",Opponent:"Christmas party",Day:"Friday",Date:"18th Dec 2026",Time:"19:00",Location:"The pub",EventDetails:"Bring a <hat>"};
  assert.equal(h.context.personalFixture(event),null);
  h.context.openFixtureDetails(event);
  assert(dialog.open);
  assert(content.innerHTML.includes("Christmas party"));
  assert(content.innerHTML.includes("19:00"));
  assert(content.innerHTML.includes("Bring a &lt;hat&gt;"));
  for(const unwanted of ["vs Christmas", "fixtureAvailabilityForm", "fixtureLineup", "View full result", "Missed"]) assert(!content.innerHTML.includes(unwanted));
});


test("cup fixtures merge with results despite round and league label differences", () => {
  const h=harness();
  const leagueStart=source.indexOf("  function normalizeLeague(");
  vm.runInContext(source.slice(leagueStart,source.indexOf("  function leagueClass(",leagueStart)),h.context);
  const start=source.indexOf("  function mergeCalendarResults(");
  vm.runInContext(source.slice(start,source.indexOf("  function fixtureLeagueLabel(",start)),h.context);
  h.context.calendarResultEvents=rows=>rows;
  const base={dateISO:"2026-10-29",dateObj:new Date("2026-10-29"),Opponent:"Natwest Allsorts",HA:"Away"};
  const fixture={...base,League:"BANKS CUP - FIRST ROUND"};
  const result={...base,League:"Banks Cup",Competition:"Banks League",completed:true};
  let merged=h.context.mergeCalendarResults([fixture],[{rows:[result],season:"26-27"}]);
  assert.equal(merged.length,1);
  assert.equal(merged[0].completed,true);
  merged=h.context.mergeCalendarResults([{...fixture,League:"Banks League"},fixture],[{rows:[result]}]);
  assert.equal(merged.length,2); // A separate league fixture must remain separate.
});
