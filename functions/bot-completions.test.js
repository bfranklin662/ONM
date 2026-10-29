const test = require("node:test");
const assert = require("node:assert/strict");
const { buildCompletions, buildLeaderboard, buildSurvivalLeaderboard } = require("./bot-completions");
test("Survival leaderboard ranks best runs, merges linked accounts and excludes private data",()=>{
  const users=[{id:"a",firstName:"Alex",monsterSurvivalBest:3,email:"private@example.test"},{id:"b",firstName:"Bill",monsterSurvivalAttempted:true},{id:"c",firstName:"Champion",monsterSurvivalCompleted:true},{id:"d",firstName:"No run"},{id:"e",linkedPlayerKey:"linked",monsterSurvivalBest:5},{id:"f",linkedPlayerKey:"linked",monsterSurvivalBest:7}];
  const rows=buildSurvivalLeaderboard(users,new Map([["linked",{publicName:"Linked Player"}]]));
  assert.deepEqual(rows.map(r=>r.best),[10,7,3,0]);assert.equal(rows[0].complete,true);assert.equal(rows[1].name,"Linked Player");
  assert.ok(rows.every(r=>!r.email&&!r.id&&!r.monsterBotBestScores));
});
test("Survival leaderboard clamps invalid progress and uses first names without linked profiles",()=>{
  const rows=buildSurvivalLeaderboard([{id:"a",firstName:"Alex",monsterSurvivalBest:99},{id:"b",firstName:"Beta",monsterSurvivalBest:3.5,monsterSurvivalAttempted:true}],new Map());
  assert.deepEqual(rows.map(r=>[r.name,r.best]),[["Alex",10],["Beta",0]]);
});
test("Survival excludes navigation-only legacy starts but includes genuine attempts at zero",()=>{
 const rows=buildSurvivalLeaderboard([{id:"opened",firstName:"Opened",monsterSurvivalStarted:true},{id:"attempted",firstName:"Attempted",monsterSurvivalAttempted:true},{id:"winner",firstName:"Winner",monsterSurvivalBest:1}],new Map());
 assert.deepEqual(rows.map(r=>r.name),["Winner","Attempted"]);
});
test("Ton+ leaderboard counts sequential wins, merges linked players and never exposes attempts",()=>{
 const {buildTonOutsLeaderboard}=require("./bot-completions");
 const users=[{id:"a",linkedPlayerKey:"nick",tonOutsProgress:{100:{hit:true,misses:99}}},{id:"b",linkedPlayerKey:"nick",tonOutsProgress:{100:{hit:true},101:{hit:true}}},{id:"c",firstName:"No finish",tonOutsProgress:{100:{misses:12}}},{id:"d",firstName:"Skipped",tonOutsProgress:{170:{hit:true}}}];
 const rows=buildTonOutsLeaderboard(users,new Map([["nick",{publicName:"Nick"}]]));assert.equal(rows.length,1);assert.equal(rows[0].completed,2);assert.equal(rows[0].name,"Nick");assert.doesNotMatch(JSON.stringify(rows),/misses|99|linkedPlayerKey/);
});
test("private attempt counters never enter public completions or leaderboards",()=>{
  const users=[{id:"private",firstName:"Nick",monsterBotWins:["1-9"],monsterBotAttemptDevices:{"private-device-secret":{"1-9":12345}}}];
  const publicData=JSON.stringify({completions:buildCompletions(users,new Map()),leaderboard:buildLeaderboard(users,new Map())});
  assert.equal(publicData.includes("monsterBotAttemptDevices"),false);assert.equal(publicData.includes("private-device-secret"),false);assert.equal(publicData.includes("12345"),false);
});
test("completion rows include only public photo and nationality alongside results",()=>{
  const rows=buildCompletions([{id:"private",firstName:"Nick",email:"secret@example.test",linkedPlayerKey:"nick",monsterBotWins:["1-3"],monsterBotBestScores:{"1-3":{won:2,lost:0}}}],new Map([["nick",{publicName:"Nick",photoUrl:"https://example.test/nick.jpg",nationality:"Australia"}]]));
  assert.equal(rows["1-3"][0].photoUrl,"https://example.test/nick.jpg");assert.equal(rows["1-3"][0].flag,"🇦🇺");
  assert.equal(JSON.stringify(rows).includes("secret@example.test"),false);
});
test("leaderboard publishes profile photo and nationality without private account fields",()=>{
  const users=[{id:"private",firstName:"Nick",email:"private@example.test",nationality:"Australia",photoUrl:"https://example.test/account.jpg",linkedPlayerKey:"nick",monsterBotStarted:true}];
  const profiles=new Map([["nick",{publicName:"Nick",nationality:"England",photoUrl:"https://example.test/public.jpg"}]]);
  const [row]=buildLeaderboard(users,profiles);
  assert.equal(row.photoUrl,"https://example.test/public.jpg");assert.equal(row.nationality,"England");assert.ok(row.flag.startsWith("🏴"));
  const [unlinked]=buildLeaderboard(users,new Map());assert.equal(unlinked.flag,"🇦🇺");
  users[0].photoUrl="javascript:alert(1)";assert.equal(buildLeaderboard(users,new Map())[0].photoUrl,undefined);
  assert.equal(JSON.stringify(row).includes("private@example.test"),false);
});
test("unlinked players use first names in the leaderboard and completion lists, not private details",()=>{
  const users=[
    {id:"private-id-a",firstName:"  Alex  ",surname:"PrivateSurname",email:"hidden@example.test",monsterBotWins:["1-1"]},
    {id:"private-id-b",firstName:"Alex",linkedPlayerKey:"missing-profile",monsterBotWins:["1-1"]},
    {id:"private-id-c",firstName:"AccountFirst",linkedPlayerKey:"linked",monsterBotWins:["1-1"]}
  ];
  const profiles=new Map([["linked",{publicName:"Public player name"}]]);
  const completions=buildCompletions(users,profiles),leaderboard=buildLeaderboard(users,profiles);
  assert.deepEqual(completions["1-1"].map(r=>r.name),["Alex","Alex","Public player name"]);
  assert.deepEqual(leaderboard.map(r=>r.name),["Alex","Alex","Public player name"]);
  const output=JSON.stringify({completions,leaderboard});
  for(const privateValue of ["PrivateSurname","hidden@example.test","private-id-a","Player without a linked profile"]) assert.equal(output.includes(privateValue),false);
});
test("leaderboard unlocks level two for any two different modes", () => {
  const rows=buildLeaderboard([{id:"a",monsterBotWins:["1-5","1-9"]}],new Map());
  assert.equal(rows[0].level,2);
  const single=buildLeaderboard([{id:"a",monsterBotWins:["1-5","1-5"]}],new Map());
  assert.equal(single[0].level,1);
});
test("counts one completion per player and format without exposing private account data", () => {
  const result = buildCompletions([
    { id: "a", linkedPlayerKey: "nick", email: "private@example.test", fullName: "Private Name", monsterBotWins: ["1-1", "1-1", "1-3", "invalid"] },
    { id: "b", linkedPlayerKey: "nick", monsterBotWins: ["1-1"] },
    { id: "c", monsterBotWins: ["1-1"] },
    { id: "d", linkedPlayerKey: "rob", monsterBotWins: ["1-1", "10-7"] }
  ], new Map([["nick", { publicName: "Nick" }], ["rob", { publicName: "Rob" }]]));
  assert.deepEqual(result["1-1"].map(r => r.name), ["Nick", "Player", "Rob"]);
  assert.deepEqual(result["1-3"].map(r => r.name), ["Nick"]);
  assert.deepEqual(result["10-7"].map(r => r.name), ["Rob"]);
  assert.equal(Object.keys(result).length, 120);
  assert.deepEqual(result["level-1"].map(r => r.name), ["Nick", "Player", "Rob"]);
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
  assert.deepEqual(result[0],{name:"Nick",level:2,unlocked:2,completed:2,flawless:1,trophies:0});
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
    assert.equal(rows[0].level,E.highestUnlocked(new Set(wins),scores,2)||E.highestUnlocked(new Set(wins),scores));
    assert.equal(rows[0].completed,wins.length);
    assert.equal(rows[0].flawless,wins.length);
  }
  scores["1-3"]={won:2,lost:1};
  assert.equal(buildLeaderboard([{id:"a",monsterBotWins:wins,monsterBotBestScores:scores}],new Map())[0].level,11);
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
