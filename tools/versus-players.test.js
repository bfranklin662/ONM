const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../scripts/versus-players');
test('friendly directory is alphabetical, not ordered by rating or average',()=>{
 const profiles=[{playerKey:'z',playerName:'Zoe',rating:2000,gamesPlayed:1,nationality:'Scotland',photo:'images/z.jpg'},{playerKey:'a',playerName:'Alex',rating:900,gamesPlayed:1}];
 const matches=[{playerOneId:'z',playerOneTotalScored:501,playerOneDartsThrown:18,playerTwoId:'a',playerTwoTotalScored:400,playerTwoDartsThrown:30}];
 const rows=E.players(profiles,matches);assert.deepEqual(rows.map(p=>p.playerName),['Alex','Zoe']);assert.equal(rows[1].nationality,'Scotland');assert.equal(rows[1].photo,'images/z.jpg');assert.equal(rows[1].average,'83.50');
});
test('averages use total points and darts across existing and new games, not average of averages',()=>{
 const rows=E.players([{playerKey:'a',playerName:'Alex'}],[{playerOneId:'a',playerOneTotalScored:501,playerOneDartsThrown:30},{playerTwoId:'a',playerTwoTotalScored:501,playerTwoDartsThrown:60}]);
 assert.equal(rows[0].average,'33.40');assert.equal(rows[0].trackedGames,2);
});
test('local, bot and invalid-dart games do not contaminate friendly averages',()=>{
 const row={playerOneId:'a',playerOneName:'Alex',playerOneTotalScored:500,playerOneDartsThrown:10};
 assert.equal(E.players([], [{...row,botMode:true},{...row,matchMode:'local'},{...row,playerOneDartsThrown:0}]).length,0);
 const rows=E.players([{playerKey:'a',gamesPlayed:2,playerName:'Alex'}],[]);assert.equal(rows[0].average,null);
});
const script=fs.readFileSync(require.resolve('../scripts/dart-scorer.js'),'utf8');
test("lobby splits compact player cards, and only available opponents can be selected", () => {
 const part = script.slice(script.indexOf("function renderLeaderboard("), script.indexOf("async function loadExpandedPlayerStats("));
 const nodes = new Map();
 const buttons = [{dataset:{versusPlayer:"other"}, addEventListener(_event, handler){this.select = handler;}, setAttribute(_name, value){this.selected = value;}}];
 const node = id => {
  if (!nodes.has(id)) nodes.set(id, {innerHTML:"",textContent:"",classList:{add(){},toggle(){}},querySelectorAll:()=>buttons});
  return nodes.get(id);
 };
 const ctx = {document:{getElementById:node,querySelector:()=>node("meta")},window:{ONMSession:{getUser:()=>({})}},loggedInUser:{},
  getCurrentPlayerKey:()=>"me",leaderboardFlag:()=>"🇬🇧",escapeHtml:value=>String(value).replace(/</g,"&lt;"),
  currentLeagueProfile:null, selectedVersusPlayerKey:"", updateLeaguePlayButton(){}};
 vm.runInNewContext(part,ctx);
 ctx.renderLeaderboard([
  {playerKey:"other",playerName:"Alex",average:"52.50",status:"online",nationality:"England"},
  {playerKey:"me",playerName:"Nick",status:"online"},
  {playerKey:"away",playerName:"Zoe",status:"offline"}
 ]);
 const html = node("leaderboardRows").innerHTML;
 assert.match(html, /<h3>Online<\/h3>[\s\S]*Alex[\s\S]*<h3>Offline<\/h3>[\s\S]*Zoe/);
 assert.match(html, /🇬🇧/);
 assert.match(html, /52.50 <small>avg/);
 assert.doesNotMatch(html, /Wins|<img|data-versus-player="(?:me|away)"/);
 buttons[0].select();
 assert.equal(ctx.selectedVersusPlayerKey,"other");
 assert.equal(buttons[0].selected,"true");
 ctx.renderLeaderboard([{playerKey:"other",playerName:"Alex",status:"offline"}]);
 assert.equal(ctx.selectedVersusPlayerKey,"");
});
test('friendly matches continue saving averages but do not calculate Elo or increase ranked wins',()=>{
 const completion=script.slice(script.indexOf('if (newLegs >= legsToWin)'),script.indexOf('async function',script.indexOf('if (newLegs >= legsToWin)')));
 assert.doesNotMatch(completion,/calculateDartRatingChange\(/);assert.match(completion,/updates.friendly = true/);assert.match(completion,/wins: winnerProfile.wins,/);assert.match(completion,/action: "saveDartMatch"/);
 const payload=script.slice(script.indexOf('function buildDartMatchPayloadFromOnlineMatch'),script.indexOf('function buildRatingHistoryEntry'));
 assert.match(payload,/TotalScored/);assert.match(payload,/DartsThrown/);
});
test('versus branding replaces the ranked league entry and retains backwards-compatible league links',()=>{
 const page=fs.readFileSync(require.resolve('../dart-scorer.html'),'utf8'),games=fs.readFileSync(require.resolve('../games.html'),'utf8');assert.match(games,/Monsters Versus/);assert.match(games,/mode=versus/);assert.doesNotMatch(games,/molGameRankPill|molGameRatingPill|Play ranked/);assert.match(page,/versus-players.js/);assert.match(script,/\["league","versus"\]/);
});

test("new accounts can appear with no matches, and their presence is keyed case-sensitively", () => {
 const presence = {
  TestUid: {playerName:"New Player", online:true, versusAccount:true},
  BusyUid: {playerName:"Busy Player", online:true, status:"playing", updatedAt:Date.now(), versusAccount:true},
  SeenUid: {playerName:"Former Visitor", online:false, versusAccount:true},
  OldUid: {playerName:"Old Account", online:true}
 };
 const roster = E.inviteProfiles([{playerKey:"linked",fullName:"Club Player"}], presence);
 const rows = E.players(roster, [{matchMode:"online",playerOneId:"SeenUid",playerOneWon:true,playerOneTotalScored:501,playerOneDartsThrown:30}], presence);
 assert.deepEqual(rows.map(row => [row.playerKey,row.status]), [
  ["TestUid","online"],["BusyUid","playing"],["SeenUid","offline"]
 ]);
 assert.equal(rows[0].average,null);
 assert.equal(rows[0].wins,0);
 assert.equal(rows[2].wins,1);
 assert.equal(rows[2].average,"50.10");
 assert.equal(E.players(roster, [], null)[0].status,"unknown");
});

test("an invite keeps the exact mixed-case account key used by presence", () => {
 const live = fs.readFileSync(require.resolve("../scripts/firebase-live.js"),"utf8");
 const helpers = live.slice(live.indexOf("function safeFirebaseKey("),live.indexOf("async function setPlayerPresence("));
 const context = {};
 vm.runInNewContext(helpers,context);
 assert.equal(context.getStablePlayerKey({linkedPlayerKey:"TestUid"}),"TestUid");
});
