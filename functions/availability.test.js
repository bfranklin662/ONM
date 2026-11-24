"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createAvailabilityService, parseFixture, findPlayerRow, todayLondon, SHEET_ID } = require("./availability");

function harness(overrides = {}) {
  const grid = [
    ["Club", "League", "TRAFALGAR\nWednesday\n21 Oct 2026\n18:30", "BANKS\nThursday\n8 Oct 2026\n18:30", "TRAFALGAR\nWednesday\n28 Oct 2026"],
    ["", "Opponent", "Silverbacks", "Schroders Mugs", "Nolans Rawdogs"],
    ["", "Home/Away", "H", "A", "A"],
    ["", "Location", "The Barley Mow", "The Brown Bear", "Nolans"],
    ["Available"], ["Unavailable"], ["Not sure"],
    ["Nick Horne (c)", "7", "Unavailable", "Available", "Available"],
    ["Ricky Plows (c)", "2", "Available", "Unavailable", ""]
  ];
  const user = { status: "Active", linkedPlayerKey: "nick", accountType: "player", ...overrides.user };
  const player = { fullName: "Nick Horne", publicName: "Nick", ...overrides.player };
  const writes = [], reads = [];
  const data = { user, player, grid, writes, reads, current: "Unavailable", formula: false, valid: true };
  const service = createAvailabilityService({
    now: () => new Date("2026-10-16T10:00:00Z"),
    db: { doc(path) { reads.push(path); return { get: async () => ({ exists: true, data: () => path === "users/signed-in-user" ? user : player }) }; } },
    sheets: {
      metadata: async () => ({ sheets: [{ properties: { sheetId: SHEET_ID, title: "Availability 2026-27", gridProperties: { rowCount: 93, columnCount: 50 } } }] }),
      values: async () => grid,
      cell: async () => ({ userEnteredValue: data.formula ? { formulaValue: "=1" } : { stringValue: data.current }, dataValidation: data.rule || (data.valid ? { condition: { type: "ONE_OF_LIST", values: ["Available", "Unavailable", "Not sure"].map(userEnteredValue => ({ userEnteredValue })) } } : undefined) }),
      overrideSelections: async entries => writes.push(...entries.map(({ rowIndex, columnIndex, rule, status }) => ({ row: rowIndex, column: columnIndex, rule, status }))),
      setRowHidden: async (row, hidden) => writes.push({ row, hidden }),
      update: async (range, value) => writes.push({ range, value })
    }
  });
  return { ...data, data, service };
}

test("reads the linked player's existing responses, excluding past fixtures", async () => {
  const h = harness();
  const result = await h.service.get("signed-in-user");
  assert.equal(result.fixtures.length, 2);
  assert.deepEqual(result.fixtures.map(f => f.status), ["Unavailable", "Available"]);
  assert.equal(result.fixtures[1].time, "18:30");
  assert.equal(result.fixtures[0].column, undefined);
  assert.deepEqual(h.reads, ["users/signed-in-user", "players/nick"]);
  assert.equal(h.writes.length, 0);
});

test("writes exactly the linked player's existing cell and ignores forged row/player input", async () => {
  const h = harness();
  const { fixtures } = await h.service.get("signed-in-user");
  await h.service.set("signed-in-user", { fixtureId: fixtures[0].id, status: "Available", previousStatus: "Unavailable", playerKey: "ricky", row: 9, range: "A1" });
  assert.deepEqual(h.writes, [{ range: "'Availability 2026-27'!C8", value: "Available" }]);
});

test("unauthenticated, inactive, supporter and unlinked accounts cannot write", async () => {
  await assert.rejects(harness().service.get(null), { code: "unauthenticated" });
  for (const user of [{ status: "Inactive" }, { accountType: "supporter" }, { linkedPlayerKey: "" }]) {
    const h = harness({ user });
    await assert.rejects(h.service.set("signed-in-user", { fixtureId: "unknown", status: "Available", previousStatus: "" }));
    assert.equal(h.writes.length, 0);
  }
});

test("changes in the sheet appear on the next read and block stale saves", async () => {
  const h = harness();
  const { fixtures } = await h.service.get("signed-in-user");
  h.grid[7][2] = "Not sure";
  assert.equal((await h.service.get("signed-in-user")).fixtures[0].status, "Not sure");
  await assert.rejects(h.service.set("signed-in-user", { fixtureId: fixtures[0].id, status: "Available", previousStatus: "Unavailable" }), { code: "aborted" });
  assert.equal(h.writes.length, 0);
});

test("formula cells, missing dropdown validation and late sheet edits cannot be overwritten", async () => {
  for (const mutation of [{ formula: true }, { valid: false }, { current: "Available" }]) {
    const h = harness();
    const { fixtures } = await h.service.get("signed-in-user");
    Object.assign(h.data, mutation);
    await assert.rejects(h.service.set("signed-in-user", { fixtureId: fixtures[0].id, status: "Not sure", previousStatus: "Unavailable" }));
    assert.equal(h.writes.length, 0);
  }
});

test("invalid choices, removed fixtures and cancelled fixtures cannot be saved", async () => {
  const h = harness();
  const { fixtures } = await h.service.get("signed-in-user");
  await assert.rejects(h.service.set("signed-in-user", { fixtureId: fixtures[0].id, status: "Yes", previousStatus: "Unavailable" }), { code: "invalid-argument" });
  h.grid[3][2] = "CANCELLED";
  await assert.rejects(h.service.set("signed-in-user", { fixtureId: fixtures[0].id, status: "Available", previousStatus: "Unavailable" }), { code: "failed-precondition" });
  assert.equal(h.writes.length, 0);
});

test("fixture columns can move without writing to the wrong match", async () => {
  const h = harness();
  const { fixtures } = await h.service.get("signed-in-user");
  h.grid.forEach(row => { [row[2], row[4]] = [row[4], row[2]]; });
  await h.service.set("signed-in-user", { fixtureId: fixtures[0].id, status: "Available", previousStatus: "Unavailable" });
  assert.equal(h.writes[0].range, "'Availability 2026-27'!E8");
});

test("matching handles captain labels and public names but refuses ambiguous names", () => {
  const h = harness();
  assert.equal(findPlayerRow(h.grid, { fullName: "Nick Horne" }), 7);
  h.grid[7][0] = "Billiams";
  assert.equal(findPlayerRow(h.grid, { fullName: "Michael Williams", publicName: "Billiams" }), 7);
  h.grid[7][0] = "Gary Hamshere";
  assert.equal(findPlayerRow(h.grid, { fullName: "Gary Hampshire", availabilitySheetName: "Gary Hamshere" }), 7);
  assert.equal(findPlayerRow(h.grid, { fullName: "Gary Hampshire" }), 7);
  h.grid[8][0] = "Gary Hamshere";
  assert.throws(() => findPlayerRow(h.grid, { fullName: "Gary Hamshere" }), { code: "failed-precondition" });
});

test("duplicate fixtures are read-only and London dates handle summer time", async () => {
  const h = harness();
  h.grid.forEach(row => { row[4] = row[2]; });
  const { fixtures } = await h.service.get("signed-in-user");
  assert(fixtures.every(f => !f.editable));
  await assert.rejects(h.service.set("signed-in-user", { fixtureId: fixtures[0].id, status: "Available", previousStatus: "Unavailable" }));
  assert.equal(todayLondon(new Date("2026-07-01T23:30:00Z")), "2026-07-02");
  assert.equal(parseFixture("BANKS\nTuesday\n31 Feb 2027", "Opponent", "H", "Pub"), null);
});

test("only active admins and owners can read team availability", async () => {
  await assert.rejects(harness().service.getTeamSheet(null), { code: "unauthenticated" });
  for (const user of [{ role: "player" }, { role: "admin", status: "Inactive" }]) {
    await assert.rejects(harness({ user }).service.getTeamSheet("signed-in-user"), { code: "permission-denied" });
  }
  const h = harness({ user: { role: "admin", linkedPlayerKey: "" } });
  const { rows } = await h.service.getTeamSheet("signed-in-user");
  assert.deepEqual(rows[7], ["Nick Horne (c)", "", "Unavailable", "Available", "Available"]);
  assert.deepEqual(rows.slice(4, 7), [[], [], []]);
  assert.deepEqual(h.reads, ["users/signed-in-user"]);
  assert.equal(h.writes.length, 0);
});

test("only admins can mark a matching response Selected, without adding a dropdown option", async () => {
  const admin = harness({ user: { role: "admin", linkedPlayerKey: "" } });
  const { fixtureIds } = await admin.service.getTeamSheet("signed-in-user");
  const payload = { fixtureId: fixtureIds[2], playerKey: "nick", status: "Selected", previousStatus: "Unavailable" };
  const member = harness();
  await assert.rejects(member.service.setTeamResponse("signed-in-user", payload), { code: "permission-denied" });
  await assert.rejects(member.service.set("signed-in-user", payload), { code: "invalid-argument" });
  await assert.rejects(admin.service.setTeamResponse("signed-in-user", { ...payload, previousStatus: "Available" }), { code: "aborted" });
  await admin.service.setTeamResponse("signed-in-user", payload);
  assert.equal(admin.writes.length, 1);
  assert.equal(admin.writes[0].row, 7);
  assert.equal(admin.writes[0].column, 2);
  assert.deepEqual(admin.writes[0].rule.condition.values.map(value => value.userEnteredValue), ["Available", "Unavailable", "Not sure"]);

  member.grid[7][2] = "Selected";
  member.data.current = "Selected";
  const { fixtures, choices } = await member.service.get("signed-in-user");
  assert.equal(fixtures[0].status, "Selected");
  assert(!choices.includes("Selected"));
  await member.service.set("signed-in-user", { ...payload, status: "Not sure", previousStatus: "Selected" });
  assert.deepEqual(member.writes, [{ range: "'Availability 2026-27'!C8", value: "Not sure" }]);
});

test("team sync matches exact roster aliases and hides or restores the sheet row", async () => {
  const h = harness({ user: { role: "owner" }, player: { publicName: "George M", fullName: "George M" } });
  h.grid[7][0] = "George Mills";
  await h.service.archiveTeamPlayer("signed-in-user", { playerKey: "george-m", archived: true });
  await h.service.archiveTeamPlayer("signed-in-user", { playerKey: "george-m", archived: false });
  assert.deepEqual(h.writes, [{ row: 7, hidden: true }, { row: 7, hidden: false }]);
  h.grid[7][0] = "Gary Hampshere";
  assert.equal(findPlayerRow(h.grid, { fullName: "Gary Hampshire" }), 7);
});

test("saving a team writes Selected for the requested fixture and rejects ordinary players", async () => {
  const admin = harness({ user: { role: "admin" } });
  const { fixtureIds } = await admin.service.getTeamSheet("signed-in-user");
  const payload = { fixtureId: fixtureIds[2], playerKeys: ["nick"] };
  const member = harness();
  await assert.rejects(member.service.selectTeamOnSheet("signed-in-user", payload), { code: "permission-denied" });
  await assert.rejects(member.service.archiveTeamPlayer("signed-in-user", { playerKey: "nick", archived: true }), { code: "permission-denied" });
  assert.deepEqual(await admin.service.selectTeamOnSheet("signed-in-user", payload), { selected: 1 });
  assert.equal(admin.writes[0].row, 7);
  assert.equal(admin.writes[0].column, 2);
});

test("admin can replace Selected with a normal response when the sheet hides the Selected dropdown", async () => {
  const h = harness({ user: { role: "admin" } });
  h.grid[7][2] = "Selected";
  h.data.current = "Selected";
  h.data.rule = { strict: true, condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "Selected" }] } };
  const { fixtureIds } = await h.service.getTeamSheet("signed-in-user");
  await h.service.setTeamResponse("signed-in-user", {
    playerKey: "nick", fixtureId: fixtureIds[2], status: "Not sure", previousStatus: "Selected"
  });
  assert.equal(h.writes[0].status, "Not sure");
  assert.equal(h.writes[0].row, 7);
  assert.equal(h.writes[0].column, 2);
});
