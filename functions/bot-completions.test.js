const test = require("node:test");
const assert = require("node:assert/strict");
const { buildCompletions, buildLeaderboard } = require("./bot-completions");
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
  assert.equal(Object.keys(result).length, 60);
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
test("Bull or Bust completion has a one-leg score and its own count", () => {
  const result = buildCompletions([{id:"a",monsterBotWins:["1-9"],monsterBotBestScores:{"1-9":{won:1,lost:0}}}],new Map());
  assert.deepEqual(result["1-9"][0].results,[{mode:9,won:1,lost:0,flawless:true}]);
  assert.equal(result["level-1"].length,1);
});
test("leaderboard includes starters, merges linked accounts, and publishes no private fields", () => {
  const result=buildLeaderboard([
    {id:"private-id",linkedPlayerKey:"nick",monsterBotWins:["1-1","1-1","bad"],email:"secret@example.test"},
    {id:"b",linkedPlayerKey:"nick",monsterBotWins:["1-3"],monsterBotBestScores:{"1-3":{won:2,lost:0}}},
    {id:"c",linkedPlayerKey:"rob",monsterBotStarted:true},
    {id:"d",monsterBotStarted:true},
    {id:"e",monsterBotWins:["fake"]}
  ],new Map([["nick",{publicName:"Nick"}],["rob",{publicName:"Rob"}]]));
  assert.deepEqual(result[0],{name:"Nick",level:2,completed:2,flawless:1});
  assert.equal(result.length,3);
  assert.ok(result.some(row=>row.name==="Rob"&&row.completed===0&&row.level===1));
  assert.equal(JSON.stringify(result).includes("secret@example.test"),false);
  assert.equal(JSON.stringify(result).includes("private-id"),false);
});
test("leaderboard level matches game rules including flawless formats", () => {
  const E=require("../scripts/monster-bot-engine");
  const wins=[],scores={};
  for(const profile of E.LEVELS) for(const mode of E.MODES) {
    const key=`${profile.level}-${mode}`; wins.push(key);scores[key]={won:E.legsNeeded(mode),lost:0};
    const rows=buildLeaderboard([{id:"a",monsterBotWins:wins,monsterBotBestScores:scores}],new Map());
    assert.equal(rows[0].level,E.highestUnlocked(new Set(wins),scores));
    assert.equal(rows[0].completed,wins.length);
    assert.equal(rows[0].flawless,wins.length);
  }
  scores["1-3"]={won:2,lost:1};
  assert.equal(buildLeaderboard([{id:"a",monsterBotWins:wins,monsterBotBestScores:scores}],new Map())[0].level,4);
  assert.equal(buildLeaderboard([{id:"a",monsterBotWins:wins,monsterBotBestScores:scores}],new Map())[0].flawless,49);
});
test("flawless counts unique challenges with valid zero-loss scores only", () => {
  const result=buildLeaderboard([
    {id:"a",linkedPlayerKey:"p",monsterBotWins:["1-1","1-1","1-3","1-5","1-7","1-9"],monsterBotBestScores:{"1-1":{won:1,lost:0},"1-3":{won:2,lost:1},"1-5":{won:99,lost:0},"1-9":{won:1,lost:0},"2-1":{won:1,lost:0}}},
    {id:"b",linkedPlayerKey:"p",monsterBotWins:["1-1","1-3"],monsterBotBestScores:{"1-1":{won:1,lost:0},"1-3":{won:2,lost:0}}},
    {id:"c",monsterBotStarted:true}
  ],new Map([["p",{publicName:"Player"}]]));
  assert.equal(result[0].completed,5);
  assert.equal(result[0].flawless,3);
  assert.equal(result[1].flawless,0);
});
