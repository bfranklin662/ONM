const test = require("node:test");
const assert = require("node:assert/strict");
const { buildCompletions } = require("./bot-completions");
test("counts one completion per player and format without exposing private account data", () => {
  const result = buildCompletions([
    { id: "a", linkedPlayerKey: "nick", email: "private@example.test", fullName: "Private Name", monsterBotWins: ["1-1", "1-1", "1-3", "invalid"] },
    { id: "b", linkedPlayerKey: "nick", monsterBotWins: ["1-1"] },
    { id: "c", monsterBotWins: ["1-1"] },
    { id: "d", linkedPlayerKey: "rob", monsterBotWins: ["1-1", "10-7"] }
  ], new Map([["nick", { publicName: "Nick" }], ["rob", { publicName: "Rob" }]]));
  assert.deepEqual(result["1-1"], ["Nick", "Player without a linked profile", "Rob"]);
  assert.deepEqual(result["1-3"], ["Nick"]);
  assert.deepEqual(result["10-7"], ["Rob"]);
  assert.equal(Object.keys(result).length, 50);
  assert.deepEqual(result["level-1"], ["Nick", "Player without a linked profile", "Rob"]);
  assert.equal(JSON.stringify(result).includes("private@example.test"), false);
  assert.equal(JSON.stringify(result).includes("Private Name"), false);
  assert.deepEqual(result["3-5"], []);
});
