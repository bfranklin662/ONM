const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseCsv, readSheet, matchSheet, playerStatus } = require("../scripts/pick-team");

const csv = [
  ',League,"TRAFALGAR\nWednesday\n25 Nov 2026\n18:30","Banks Cup\nThursday\n26 Nov 2026"',
  ',Opponent,Sliverbacks,"Dogs No More"',
  ',Home/Away,H,A',
  ',Location,"Pub, London",Club',
  'Available',
  'Unavailable',
  'Not sure',
  '"Nick B (vc)",,Available,',
  'Ricky Plows,,Not sure,Available',
  '"Guest ""Rocket""",,Unavailable,Not sure'
].join("\r\n");

const dateKey = value => value.replace(/(25|26)th/, "$1");

test("the availability export preserves multiline fixture headers, quotes and fixture-specific responses", () => {
  const rows = parseCsv(csv);
  assert.equal(rows[3][2], "Pub, London");
  assert.equal(rows[9][0], 'Guest "Rocket"');
  const sheet = readSheet(rows, dateKey);
  const fixture = matchSheet(sheet, { Date: "25th Nov 2026", League: "Trafalgar League", Opponent: "Silverbacks", HA: "Home" }, dateKey);
  assert.equal(playerStatus({ publicName: "Nick B" }, fixture), "Available");
  assert.equal(playerStatus({ fullName: "Ricky Plows", publicName: "Ricky" }, fixture), "Not sure");
  assert.equal(playerStatus({ publicName: 'Guest "Rocket"' }, fixture), "Unavailable");
  const cup = matchSheet(sheet, { Date: "26th Nov 2026", League: "Banks Cup - First Round", Opponent: "BB Kings", HA: "Away" }, dateKey);
  assert.equal(playerStatus({ publicName: "Nick B" }, cup), "Not updated");
  assert.equal(playerStatus({ publicName: "Nick" }, cup), "No matching sheet row");
});

test("ambiguous fixture columns and duplicate player names do not look like missing responses", () => {
  const rows = parseCsv(csv);
  rows.push(["Nick B", "", "Available"]);
  const sheet = readSheet(rows, dateKey);
  const row = { Date: "25th Nov 2026", League: "Trafalgar", Opponent: "Silverbacks", HA: "H" };
  assert.equal(playerStatus({ publicName: "Nick B" }, matchSheet(sheet, row, dateKey)), "No matching sheet row");
  assert.equal(matchSheet([...sheet, sheet[0]], row, dateKey), null);
  assert.equal(matchSheet(sheet, { ...row, HA: "Away" }, dateKey), null);
});

test("the captain defaults to Nick, Ricky, Rob, then Phil regardless of playing order", () => {
  const { defaultCaptain } = require("../scripts/pick-team.js");
  assert.equal(defaultCaptain(["Phil L", "Rob", "Ricky", "Nick"]), "Nick");
  assert.equal(defaultCaptain(["Phil L", "Rob", "Ricky", "Nick B"]), "Ricky");
  assert.equal(defaultCaptain(["Phil Lee", "Rob Piesse"]), "Rob Piesse");
  assert.equal(defaultCaptain(["Phil L"]), "Phil L");
  assert.equal(defaultCaptain(["Sam C"]), "");
});
