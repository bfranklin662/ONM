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
  assert.deepEqual(result["1-1"].map(r => r.name), ["Nick", "Player without a linked profile", "Rob"]);
  assert.deepEqual(result["1-3"].map(r => r.name), ["Nick"]);
  assert.deepEqual(result["10-7"].map(r => r.name), ["Rob"]);
  assert.equal(Object.keys(result).length, 50);
  assert.deepEqual(result["level-1"].map(r => r.name), ["Nick", "Player without a linked profile", "Rob"]);
  assert.equal(result["10-7"][0].results[0].won, null);
  assert.equal(JSON.stringify(result).includes("private@example.test"), false);
  assert.equal(JSON.stringify(result).includes("Private Name"), false);
  assert.deepEqual(result["3-5"], []);
});
test("modal records the best score, flawless flag and each format without duplicate people", () => {
  const result = buildCompletions([
    {id:"a",linkedPlayerKey:"nick",monsterBotWins:["1-7","1-3"],monsterBotBestScores:{"1-7":{won:4,lost:1},"1-3":{won:2,lost:1}}},
    {id:"b",linkedPlayerKey:"nick",monsterBotWins:["1-7"],monsterBotBestScores:{"1-7":{won:4,lost:0}}}
  ],new Map([["nick",{publicName:"Nick"}]]));
  assert.equal(result["1-7"].length,1);
  assert.deepEqual(result["1-7"][0].results,[{mode:7,won:4,lost:0,flawless:true}]);
  assert.deepEqual(result["level-1"][0].results,[{mode:3,won:2,lost:1,flawless:false},{mode:7,won:4,lost:0,flawless:true}]);
});
