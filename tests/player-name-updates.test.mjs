import test from "node:test";
import assert from "node:assert/strict";
import { playerResultNamePatch } from "../scripts/player-name-updates.mjs";

test("shortened names change every matching appearance without changing stats or similar names", () => {
  const record = { season: "26-27", sheetRow: {
    Player1: "Leondro", Player7: "Leondro", Player2: "Nick", Player3: "Leondro B", C1: 2, F1: 1
  }};
  assert.deepEqual(playerResultNamePatch(record, ["Leondro"], "Leandro", "leondro"),
    { "sheetRow.Player1": "Leandro", "sheetRow.Player7": "Leandro" });
  assert.equal(record.sheetRow.Player1, "Leondro");
  assert.deepEqual(playerResultNamePatch({ Player1: " Leondro " }, ["Leondro"], "Leandro", "leondro"),
    { Player1: "Leandro" });
});

test("dart names follow stable player identity and corrections can be retried", () => {
  assert.deepEqual(playerResultNamePatch({ playerOneId: "leondro", playerOneName: "Old spelling",
    playerTwoId: "other", playerTwoName: "Leondro" }, ["Leondro"], "Leandro", "leondro"),
    { playerOneName: "Leandro" });
  assert.deepEqual(playerResultNamePatch({ sheetRow: { Player1: "Leandro", Player2: "Leondro" } },
    ["Leondro", "Older spelling"], "Leandro", "leondro"), { "sheetRow.Player2": "Leandro" });
  assert.deepEqual(playerResultNamePatch({ Player1: "Older spelling" }, ["Leondro", "Older spelling"],
    "Leandro", "leondro"), { Player1: "Leandro" });
  assert.deepEqual(playerResultNamePatch({ Player1: "Leandro" }, ["Leondro"], "Leandro", "leondro"), {});
});
