const test=require("node:test"),assert=require("node:assert/strict"),E=require("../scripts/monster-bot-engine"),{buildLeaderboard,buildCompletions}=require("../functions/bot-completions");
test("tier and trophy summary controls are present in the real page markup",()=>{
  const fs=require("node:fs"),html=fs.readFileSync(require.resolve("../monster-bot.html"),"utf8");
  for(const id of ["ladderTierTabs","ladderTierOne","ladderTierTwo","playerSummaryTrophies","playerSummaryBar"])assert.equal((html.match(new RegExp(`id="${id}"`,"g"))||[]).length,1);
  assert.match(html,/<progress id="playerSummaryBar" max="50"/);
  const survival=fs.readFileSync(require.resolve("../monster-survival.html"),"utf8");assert.doesNotMatch(survival,/🏆|Claim trophy|Trophy earned/);assert.match(survival,/Survival complete!/);
});
function seed(levels){const wins=new Set(),scores={};for(const level of levels)for(const mode of E.MODES){const key=`${level}-${mode}`;wins.add(key);scores[key]={won:E.legsNeeded(mode),lost:0};}return{wins,scores};}
test("Tier 2 has ten distinct opponents, preserved Tier 1 IDs and requested averages",()=>{
  assert.equal(E.LEVELS.length,10);assert.equal(E.ALL_LEVELS.length,20);
  assert.deepEqual(E.TIER2_LEVELS.map(p=>p.name),["George Bot","Paddy Bot","Phil Bot","Scottsman Bot","Bobby Bot","Russ Bot","Piesse Bot","Seb Bot","Gary Bot","Cod Bot"]);
  assert.deepEqual(E.TIER2_LEVELS.map(p=>p.average),[37.5,42.5,47.5,52.5,57.5,62.5,67.5,72.5,77.5,82.5]);
  assert.equal(E.validWinningScore("11-1",{won:1,lost:0}),true);assert.equal(E.validWinningScore("21-1",{won:1,lost:0}),false);
});
test("Tier 2 requires three trophies and 20 Tier 1 stars, regardless of Survival",()=>{
  const boundary=seed([1,2,3]);assert.equal(E.tier2EntryUnlocked(boundary.wins,boundary.scores),false);
  for(const bot of [4,5,6,7,8]){boundary.wins.add(`${bot}-1`);boundary.scores[`${bot}-1`]={won:1,lost:0};}
  assert.equal(E.trophies(boundary.wins,boundary.scores,1),3);assert.equal(E.tier2EntryUnlocked(boundary.wins,boundary.scores),true);
  const {wins,scores}=seed([1,2,3,4,5]);assert.equal(E.trophies(wins,scores),5);
  assert.equal(E.isUnlocked(11,wins,scores,0),true);assert.equal(E.isUnlocked(11,wins,scores,7),true);assert.equal(E.highestUnlocked(wins,scores,2,0),11);
  const missing={...scores,"4-3":{won:2,lost:1},"5-3":{won:2,lost:1},"3-3":{won:2,lost:1}};assert.equal(E.isUnlocked(11,wins,missing,10),false);
  const scattered=seed([1,2,3]);for(const bot of [4,5,6,7,8]){scattered.wins.add(`${bot}-1`);scattered.scores[`${bot}-1`]={won:1,lost:0};}
  assert.equal(E.goldStars(scattered.wins,scattered.scores),20);assert.equal(E.trophies(scattered.wins,scattered.scores),3);assert.equal(E.isUnlocked(11,scattered.wins,scattered.scores,10),true);
});
test("Tier 2 repeats the original progression pattern using only its own modes and stars",()=>{
  const {wins,scores}=seed([1,2,3,4,5]);
  for(const mode of [1,3]){wins.add(`11-${mode}`);scores[`11-${mode}`]={won:E.legsNeeded(mode),lost:0};}
  assert.equal(E.isUnlocked(12,wins,scores,7),true);assert.equal(E.isUnlocked(13,wins,scores,7),false);
  for(const mode of E.MODES){wins.add(`11-${mode}`);scores[`11-${mode}`]={won:E.legsNeeded(mode),lost:0};}
  for(const mode of [1,3]){wins.add(`12-${mode}`);scores[`12-${mode}`]={won:E.legsNeeded(mode),lost:1};}
  assert.equal(E.isUnlocked(13,wins,scores,7),true);assert.equal(E.isUnlocked(14,wins,scores,7),false);
  const weak={...scores,"11-3":{won:2,lost:1}};assert.equal(E.isUnlocked(13,wins,weak,7),false);
  assert.equal(E.trophies(wins,scores),6);assert.equal(E.trophies(wins,scores,1),5);assert.equal(E.trophies(wins,scores,2),1);
});
test("public rankings and client progression agree across both tiers, including trophies",()=>{
  for(let through=0;through<=20;through++){
    const {wins,scores}=seed(Array.from({length:through},(_,i)=>i+1));
    for(const survivalBest of [0,6,7,10]){
      const [row]=buildLeaderboard([{id:"member",firstName:"Alex",monsterBotStarted:true,monsterBotWins:[...wins],monsterBotBestScores:scores,monsterSurvivalBest:survivalBest}],new Map());
      const highest2=E.highestUnlocked(wins,scores,2,survivalBest);
      assert.equal(row.level,highest2||E.highestUnlocked(wins,scores));assert.equal(row.trophies,E.trophies(wins,scores));assert.equal(row.completed,wins.size);
    }
  }
  const groups=buildCompletions([{id:"member",firstName:"Alex",monsterBotWins:["11-1"],monsterBotBestScores:{"11-1":{won:1,lost:0}}}],new Map());assert.equal(groups["11-1"].length,1);assert.equal(groups["1-1"].length,0);
});
test("Tier 2 bot scoring stays close to each advertised midpoint over many legs",()=>{
  for(const profile of E.TIER2_LEVELS){let value=123;const random=()=>((value=Math.imul(value,1664525)+1013904223>>>0)/4294967296);const result=E.simulate(profile,1500,random);assert.ok(Math.abs(result.average-profile.targetAverage)<2,`${profile.name}: ${result.average}`);}
});
