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
test("lobby splits compact player cards, and offline opponents can be selected but cannot be invited", () => {
 const part = script.slice(script.indexOf("function renderLeaderboard("), script.indexOf("async function loadExpandedPlayerStats("));
 const nodes = new Map();
 const invited = [];
 const notices = [];
 const buttons = [{dataset:{versusPlayer:"other"}, addEventListener(_event, handler){this.select = handler;}, setAttribute(_name, value){this.selected = value;}}];
 const node = id => {
  if (!nodes.has(id)) nodes.set(id, {innerHTML:"",textContent:"",classList:{add(){},toggle(){}},getAttribute:()=>null,querySelectorAll:()=>buttons});
  return nodes.get(id);
 };
 const ctx = {document:{getElementById:node,querySelector:()=>node("meta")},window:{ONMSession:{getUser:()=>({})}},loggedInUser:{},
  getCurrentPlayerKey:()=>"me",leaderboardFlag:()=>"🇬🇧",escapeHtml:value=>String(value).replace(/</g,"&lt;"),
  getPlayerPhotoField:player=>player?.photo || "",getPlayerNationality:()=> "British",getLoggedInFullName:()=>"Nick",currentLeagueProfile:null, selectedVersusPlayerKey:"", openCompetitiveInviteFlow:key=>invited.push(key), showOnlineNotice:message=>notices.push(message)};
 vm.runInNewContext(part,ctx);
 ctx.renderLeaderboard([
  {playerKey:"other",playerName:"Alex",average:"52.50",status:"online",nationality:"England",photo:"images/alex.jpg"},
  {playerKey:"me",playerName:"Nick",status:"online",average:"53.25",played:4,wins:3,fastestLeg:18,oneEightys:2,bullOuts:1,highestOut:134,winStreak:2},
  {playerKey:"away",playerName:"Zoe",status:"offline"},
  {playerKey:"a-off",playerName:"Ada",status:"offline"},
  {playerKey:"b-off",playerName:"Ben",status:"offline",played:1}
 ]);
 const html = node("leaderboardRows").innerHTML;
 assert.match(html, /<h3>Online<\/h3>[\s\S]*Alex[\s\S]*<h3>Offline<\/h3>[\s\S]*Zoe/);
 assert.match(html, /<h3>Offline<\/h3>[\s\S]*Ben[\s\S]*Ada[\s\S]*Zoe/);
 assert.match(html, /🇬🇧/);
 assert.match(html, /52.50 <small>avg/);
 assert.equal(node("versusYourAverage").textContent,"53.25");
 assert.equal(node("versusYourFlag").textContent,"🇬🇧");
 assert.equal(node("versusYourWins").textContent,3);
 assert.equal(node("versusYourFastestLeg").textContent,"18 darts");
 assert.equal(node("versusYourHighestOut").textContent,134);
 const board = node("versusLeaderboardRows").innerHTML;
 assert.match(board, /Nick[\s\S]*18 darts/);
 assert.doesNotMatch(board, /Zoe/);
 assert.match(board, /<details class="versusBoardCard"/);
 assert.match(board, /Highest out/);
 assert.match(board, /2 wins in a row/);
 assert.doesNotMatch(board, /Losses|Win rate/);
 assert.match(html, /class="versusAvatar" src="images\/alex.jpg"/);
 assert.doesNotMatch(html, /Wins|data-versus-player="me"/);
 assert.equal(node("versusInviteDock").hidden,true);
 assert.equal((html.match(/<small>avg<\/small>/g) || []).length,1);
 buttons[0].select();
 assert.equal(ctx.selectedVersusPlayerKey,"other");
 assert.equal(buttons[0].selected,"true");
 assert.equal(node("versusInviteDock").hidden,false);
 assert.equal(node("versusInviteSelected").textContent,"Challenge Alex");
 assert.equal(node("versusInviteSelected").disabled,false);
 node("versusInviteSelected").onclick();
 assert.deepEqual(invited,["other"]);
 ctx.renderLeaderboard([{playerKey:"other",playerName:"Alex",status:"offline"}]);
 assert.equal(ctx.selectedVersusPlayerKey,"other");
 assert.equal(node("versusInviteSelected").disabled,false);
 assert.deepEqual(notices,[]);
 node("versusInviteSelected").onclick();
 assert.deepEqual(notices,["Player offline"]);
 assert.deepEqual(invited,["other"]);
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
  ["TestUid","online"],["BusyUid","playing"],["linked","offline"],["SeenUid","offline"]
 ]);
 assert.equal(rows[0].average,null);
 assert.equal(rows[0].wins,0);
 assert.equal(rows[3].wins,1);
 assert.equal(rows[3].average,"50.10");
 assert.equal(E.players(roster, [], null)[0].status,"unknown");
});

test("an invite keeps the exact mixed-case account key used by presence", () => {
 const live = fs.readFileSync(require.resolve("../scripts/firebase-live.js"),"utf8");
 const helpers = live.slice(live.indexOf("function safeFirebaseKey("),live.indexOf("async function setPlayerPresence("));
 const context = {};
 vm.runInNewContext(helpers,context);
 assert.equal(context.getStablePlayerKey({linkedPlayerKey:"TestUid"}),"TestUid");
});

test("the highest checkout and current streak use completed Versus results in match order", () => {
 const row = E.players([{playerKey:"a",playerName:"Alex"}], [
  {dateTime:"2026-11-04",matchMode:"online",playerOneId:"a",playerOneWon:true,playerOneBestLeg:18,playerOne180s:2,playerOneHighestOut:140},
  {dateTime:"2026-11-01",matchMode:"online",playerOneId:"a",playerOneWon:true,playerOneBestLeg:"21 darts",playerOne180s:1,playerOneBullOuts:1,playerOneHighestOut:120},
  {dateTime:"2026-11-02",matchMode:"online",playerOneId:"a",playerTwoWon:true},
  {createdAt:{toMillis:()=>Date.parse("2026-11-03")},matchMode:"online",playerOneId:"a",playerOneWon:true},
  {dateTime:"2026-11-05",matchMode:"local",playerOneId:"a",playerTwoWon:true,playerOneBestLeg:9,playerOneHighestOut:170}
 ])[0];
 assert.deepEqual([row.played,row.wins,row.fastestLeg,row.oneEightys,row.bullOuts,row.highestOut,row.winStreak],[4,3,18,3,1,140,2]);
});

test("selected opponents open settings and the confirmed invite uses the selected format", () => {
 const page = fs.readFileSync(require.resolve("../dart-scorer.html"), "utf8");
 assert.match(page, /id="versusPanelTitle">Challenge an online player/);
 assert.doesNotMatch(page, /id="openLastGameStatsBtn"[^>]*>Play/);
 assert.match(script, /openCompetitiveInviteFlow\(player.playerKey\)/);
 assert.match(script, /selectedKey \? "Match settings"/);
 assert.match(script, /if \(!await isPlayerOnline\(opponentKey\)\)/);
 const flow = script.slice(script.indexOf("const inviteId = await window.ONMLiveDarts.createOnlineInvite"), script.indexOf('button.textContent = "Challenge sent"'));
 assert.match(flow, /gameType: competitiveGameType/);
 assert.match(flow, /legsCount: competitiveLegsCount/);
});

test("ready players use the inviter's decider and legacy matches default to a coin toss", async () => {
 const part = script.slice(script.indexOf("async function startReadyOnlineDecider("),script.indexOf("function openOnlineCoinDecider("));
 for (const deciderType of ["bull", "coin", undefined]) {
  const updates = [];
  const context = {onlineMatchId:"match",onlineRole:"host",readyDeciderMatchId:"",
   onlinePlayerKeys:()=>["host","guest"],window:{ONMLiveDarts:{db:{},ref:(_, path)=>path,
   get:async()=>({exists:()=>true,val:()=>({status:"readyLobby",settings:{deciderType}})}),
   update:async(_ref,value)=>updates.push(value)}},
   console};
  vm.runInNewContext(part,context);
  await context.startReadyOnlineDecider();
  assert.equal(updates[0].status,"decider");
  assert.equal(updates[0].decider.type,deciderType || "coin");
  assert.equal("coinWinnerIndex" in updates[0].decider,deciderType !== "bull");
 }
});

test("an active account that has never opened Versus appears offline", () => {
 const accounts = [{playerKey:"NewUid",playerName:"New Account"}];
 const roster = E.inviteProfiles([], {}, accounts);
 const [player] = E.players(roster);
 assert.equal(player.status,"offline");
 assert.equal(player.played,0);
});

test("nationality options, including English and British aliases, resolve to flags", () => {
 const auth = fs.readFileSync(require.resolve("../auth.html"),"utf8");
 const select = auth.match(/<select id="registerNationality"[\s\S]*?<\/select>/)[0];
 const part = script.slice(script.indexOf("const nationalityFlagCodes"),script.indexOf("function preloadImage("));
 const ctx = {};
 vm.runInNewContext(part,ctx);
 for(const [,value] of select.matchAll(/<option value="([^"]+)"/g)) assert.ok(ctx.countryToFlag(value),value);
 assert.equal(ctx.countryToFlag("English"),ctx.countryToFlag("England"));
 assert.equal(ctx.countryToFlag("British"),"🇬🇧");
 assert.equal(ctx.countryToFlag("not a country"),"");
});

test("Versus photos use the linked club profile key and preserve unlinked account photos", () => {
 const rows = E.withProfilePhotos([
  {playerKey:"nick-h", playerName:"Nick", photo:"images/players/old.jpg"},
  {playerKey:"nick-b", playerName:"Nick"},
  {playerKey:"GuestUid", playerName:"Nick", photoUrl:"https://example.com/guest.jpg"}
 ], {
  "Nick Horne":{playerKey:"nick-h",photo:"https://example.com/current.jpg"},
  "Nick Brown":{playerKey:"nick-b",photo:""}
 }, {"Nick Brown":"https://example.com/brown.jpg"});
 assert.deepEqual(rows.map(row => row.photo), [
  "https://example.com/current.jpg","https://example.com/brown.jpg","https://example.com/guest.jpg"
 ]);
});
