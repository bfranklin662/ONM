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
test("lobby splits compact player cards, and offline opponents can be selected but cannot be invited", async () => {
 const part = script.slice(script.indexOf("function formatStreak("), script.indexOf("async function loadExpandedPlayerStats("));
 const nodes = new Map();
 const invited = [];
 const notices = [];
 const buttons = ["other","away"].map(versusPlayer => ({
  dataset:{versusPlayer}, events:{},
  addEventListener(event, handler){this.events[event] = handler;},
  setAttribute(_name, value){this.selected = value;}
 }));
 let online = true;
 const node = id => {
  if (!nodes.has(id)) nodes.set(id, {innerHTML:"",textContent:"",classList:{add(){},toggle(){}},getAttribute:()=>null,querySelectorAll:()=>buttons});
  return nodes.get(id);
 };
 const ctx = {document:{getElementById:node,querySelector:()=>node("meta")},window:{ONMSession:{getUser:()=>({})}},loggedInUser:{},
  getCurrentPlayerKey:()=>"me",leaderboardFlag:()=>"🇬🇧",escapeHtml:value=>String(value).replace(/</g,"&lt;"),
  getPlayerPhotoField:player=>player?.photo || "",getPlayerNationality:()=> "British",getLoggedInFullName:()=>"Nick",currentLeagueProfile:null, getVersusMatchHistory:()=>[], selectedVersusPlayerKey:"", selectedVersusPlayerWasOnline:false, isPlayerOnline:async()=>online, openCompetitiveInviteFlow:key=>invited.push(key), showOnlineNotice:message=>notices.push(message)};
 vm.runInNewContext(part,ctx);
 ctx.renderLeaderboard([
  {playerKey:"other",playerName:"Alex",average:"52.50",status:"online",nationality:"England",photo:"images/alex.jpg"},
  {playerKey:"me",playerName:"Nick",status:"online",average:"53.25",played:4,wins:3,fastestLeg:18,oneEightys:2,bullOuts:1,highestOut:134,winStreak:2},
  {playerKey:"away",playerName:"Zoe",status:"offline"},
  {playerKey:"a-off",playerName:"Ada",status:"offline"},
  {playerKey:"b-off",playerName:"Ben",status:"offline",played:1}
 ]);
 const html = node("leaderboardRows").innerHTML;
 assert.match(html, /<h3>Online<\/h3>[\s\S]*Alex[\s\S]*<summary>Offline[\s\S]*Zoe/);
 assert.match(html, /<summary>Offline[\s\S]*Ben[\s\S]*Ada[\s\S]*Zoe/);
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
 assert.match(board, />2 🔥<\/span>/);
 assert.doesNotMatch(board, /Losses|Win rate/);
 assert.match(html, /class="versusAvatar" src="images\/alex.jpg"/);
 assert.doesNotMatch(html, /Wins|data-versus-player="me"/);
 assert.equal(node("versusInviteDock").hidden,true);
 assert.equal((html.match(/<small>avg<\/small>/g) || []).length,1);
 buttons[0].events.pointerdown({pointerType:"touch",clientX:50,clientY:10});
 buttons[0].events.pointermove({clientX:50,clientY:40});
 buttons[0].events.click({detail:1});
 assert.equal(ctx.selectedVersusPlayerKey,"");
 buttons[0].events.pointerdown({pointerType:"touch",clientX:50,clientY:10});
 buttons[0].events.click({detail:1});
 assert.equal(ctx.selectedVersusPlayerKey,"other");
 assert.equal(buttons[0].selected,"true");
 assert.equal(node("versusInviteDock").hidden,false);
 assert.equal(node("versusInviteSelected").textContent,"Challenge Alex");
 assert.equal(node("versusInviteSelected").disabled,false);
 await node("versusInviteSelected").onclick();
 assert.deepEqual(invited,["other"]);
 buttons[1].events.click({detail:0});
 assert.equal(buttons[0].selected,"false");
 assert.equal(buttons[1].selected,"true");
 assert.equal(node("versusInviteSelected").disabled,true);
 assert.equal(node("versusInviteSelected").textContent,"Challenge Zoe");
 buttons[0].events.click({detail:0});
 online = false;
 await node("versusInviteSelected").onclick();
 assert.deepEqual(notices,["This player is no longer online."]);
 assert.equal(node("versusInviteSelected").textContent,"Challenge unavailable");
 assert.equal(node("versusInviteSelected").disabled,true);
 assert.deepEqual(invited,["other"]);
});
test('friendly matches continue saving averages but do not calculate Elo or increase ranked wins',()=>{
 const completion=script.slice(script.indexOf('if (newLegs >= legsToWin)'),script.indexOf('async function',script.indexOf('if (newLegs >= legsToWin)')));
 assert.doesNotMatch(completion,/calculateDartRatingChange\(/);assert.match(completion,/updates.friendly = true/);assert.match(completion,/wins: winnerProfile.wins,/);assert.match(completion,/saveCompletedOnlineMatch\(matchRef\)/);
 assert.match(script.slice(script.indexOf("async function saveCompletedOnlineMatch"),script.indexOf("function setTogglePosition")),/action: "saveDartMatch"/);
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

test("both challenge screens use the server deadline and expired invites cannot be accepted", async () => {
 const live = fs.readFileSync(require.resolve("../scripts/firebase-live.js"), "utf8");
 const part = live.slice(live.indexOf("const INVITE_DURATION_MS"), live.indexOf("async function createOnlineInvite"));
 let now = 100_000;
 let invite = {status:"pending",createdAt:100_000,durationMs:30_000};
 const ctx = {
  db:{}, ref:(_,path)=>path, get:async()=>({}), Date:{now:()=>now},
  onValue:(_ref,callback)=>callback({val:()=>1000}),
  runTransaction:async(_ref,change)=>{
   const next = change(invite);
   if (next) invite = next;
   return {committed:Boolean(next)};
  }
 };
 vm.runInNewContext(part,ctx);
 assert.equal(ctx.inviteTimeLeft(invite),29_000);
 assert.equal((await ctx.transitionPendingInvite("game","expired")).committed,false);
 now = 129_000;
 assert.equal(ctx.inviteTimeLeft(invite),0);
 assert.equal((await ctx.transitionPendingInvite("game","accepting")).committed,false);
 assert.equal((await ctx.transitionPendingInvite("game","expired")).committed,true);
 assert.equal(invite.status,"expired");

 invite = {status:"pending",createdAt:130_000,durationMs:30_000};
 now = 130_000;
 assert.equal((await ctx.transitionPendingInvite("game","accepting",{matchId:"match"})).committed,true);
 now = 160_000;
 assert.equal((await ctx.transitionPendingInvite("game","expired")).committed,false);
 assert.equal(invite.matchId,"match");
});

function onlineScorerHarness(status = "playing") {
  const calls = { saved: [], photos: [], audio: [] };
  let match = {
    matchId: "versus-test", status,
    hostPlayerKey: "nick", guestPlayerKey: "test",
    settings: { legsCount: 3, gameType: "bestOf" },
    game: { currentPlayerKey: "nick", players: {
      nick: { name: "Nick", score: 125, legs: 1, legDarts: [24] },
      test: { name: "Test", score: 105 }
    } }
  };
  const snapshot = () => ({ val: () => match, exists: () => Boolean(match) });
  const api = {
    db: "db", ref: (_db, path) => path, get: async () => snapshot(),
    async runTransaction(_ref, mutate) {
      const next = mutate(structuredClone(match));
      if (next) {
        if (next.game.checkoutPhoto && match.game.checkoutPhoto?.id !== next.game.checkoutPhoto.id) {
          calls.photos.push({ status: next.status, photo: next.game.checkoutPhoto });
        }
        match = next;
      }
      return { committed: Boolean(next), snapshot: snapshot() };
    },
    async update() {},
    setPresenceStatus: async () => {}
  };
  const ctx = vm.createContext({
    window: { ONMLiveDarts: api }, onlineMatchId: "versus-test", PAGE_MODE: "league",
    STARTING_SCORE: 501, GAME_TYPE: "bestOf", LEGS_TO_WIN: 2, IN_MODE: "straight",
    els: { legsCount: { textContent: "3" }, input: {} }, state: { players: [{}, {}] },
    calculateFirstNineImpact: () => ({ firstNineScore: 0, firstNineDartsUsed: 0 }),
    getFirebasePlayerRating: async () => ({ rating: 1000, gamesPlayed: 0, wins: 0 }),
    buildMolStatRows: () => [], showOnlineScoreEditToast() {},
    postDartMatch: async payload => (calls.saved.push(payload.match), { success: true }),
    syncCheckoutPhotoButton() {}, setTimeout() {}, console,
    fullyStopDartAudio() {}, clearOnlineSession() {}, resetOnlineLobbyState() {},
    initialisePageModeView() {}, showLeagueResumePrompt() {},
    document: { getElementById: () => null }, clearInterval() {},
    getCurrentPlayerKey: () => "nick", clearDartAudioQueue() {},
    isDartAudioSuppressed: () => false, playDartCallout: name => calls.audio.push(name)
  });
  for (const [start, end] of [
    ["function onlinePlayerKeys", "function syncScoreCorrectionButton"],
    ["let onlineHeartbeatInterval", "function saveOnlineSession"],
    ["function buildDartMatchPayloadFromOnlineMatch", "function setTogglePosition"],
    ["function getPlayerStats", "async function submitCompetitiveResult"],
    ["function cleanStatNumber", "function buildDartMatchPayload()"],
    ["async function leaveOnlineMatch", "async function openOnlineBullDecider"],
    ["function playOnlineCallout", "function lockLobbySettings"]
  ]) vm.runInContext(script.slice(script.indexOf(start), script.indexOf(end, script.indexOf(start))), ctx);
  vm.runInContext(script.slice(script.indexOf("function announceDartVisit"), script.indexOf("function announceRequiredScore")), ctx);
  return { ctx, calls, match: () => match };
}

test("a 125 match checkout saves when the opponent has no leg stats, with or without a photo", async () => {
  for (const checkoutPhoto of [null, { imageData: "data:image/jpeg;base64,test" }]) {
    const h = onlineScorerHarness();
    await h.ctx.applyOnlineVisit({
      match: h.match(), myKey: "nick", visitScore: 125, previousScore: 125,
      legWon: true, dartsUsed: 3, doublesAttempted: 1, bullOut: false, checkoutPhoto
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.match().status, "complete");
    assert.equal(h.calls.saved[0].playerOneWon, true);
    assert.equal(h.calls.saved[0].playerTwoWon, false);
    assert.equal(h.calls.photos.length, Number(Boolean(checkoutPhoto)));
    if (checkoutPhoto) {
      assert.equal(h.calls.photos[0].status, "complete");
      assert.equal(h.calls.photos[0].photo.imageData, checkoutPhoto.imageData);
    }
  }
});

test("quitting opens a full minute to rejoin before the opponent wins by forfeit", async () => {
  const h = onlineScorerHarness();
  h.ctx.window.ONMLiveDarts.serverNow = () => 5000;
  await h.ctx.leaveOnlineMatch("left");
  const paused = h.match();
  assert.equal(paused.status, "playing");
  assert.equal(paused.reconnect.playerKey, "nick");
  assert.equal(paused.reconnect.deadline, 65000);
  assert.equal(h.calls.saved.length, 0);
  assert.equal(h.ctx.advanceOnlineMatchClock(paused, "test", 64999), undefined);
  const resumed = h.ctx.resumeOnlineMatchState(paused, "nick", 64999);
  assert.equal(resumed.reconnect, undefined);
  assert.equal(resumed.game.turnStartedAt, 64999);
  assert.equal(resumed.game.players.nick.score, 125);
  const expired = h.ctx.resumeOnlineMatchState(paused, "nick", 65000);
  assert.equal(expired.status, "complete");
  assert.equal(expired.forfeitByKey, "nick");
  assert.equal(expired.winnerKey, "test");
  const { playerOneWon, playerTwoWon } = h.ctx.buildDartMatchPayloadFromOnlineMatch(expired, expired.winnerKey);
  assert.equal(playerOneWon, false);
  assert.equal(playerTwoWon, true);
});

test("a throw expires after sixty seconds and gives the thrower a separate minute to rejoin", () => {
  const h = onlineScorerHarness();
  const match = h.match();
  match.game.turnStartedAt = 1000;
  match.presence = { nick: { lastSeen: 60000 }, test: { lastSeen: 60000 } };
  assert.equal(h.ctx.advanceOnlineMatchClock(match, "test", 60999), undefined);
  const paused = h.ctx.advanceOnlineMatchClock(match, "test", 61000);
  assert.equal(paused.reconnect.playerKey, "nick");
  assert.equal(paused.reconnect.deadline, 121000);
  assert.equal(h.ctx.advanceOnlineMatchClock(paused, "test", 121000).winnerKey, "test");
});

test("a stale connection pauses play and lets the disconnected player rejoin", () => {
  const h = onlineScorerHarness();
  const match = h.match();
  match.game.turnStartedAt = 1000;
  match.presence = { nick: { lastSeen: 1000 }, test: { lastSeen: 24000 } };
  assert.equal(h.ctx.advanceOnlineMatchClock(match, "test", 25999), undefined);
  const paused = h.ctx.advanceOnlineMatchClock(match, "test", 26000);
  assert.equal(paused.reconnect.playerKey, "nick");
  assert.equal(paused.reconnect.deadline, 86000);
  assert.equal(h.ctx.resumeOnlineMatchState(paused, "test", 50000).reconnect.playerKey, "nick");
  assert.equal(h.ctx.resumeOnlineMatchState(paused, "nick", 50000).reconnect, undefined);
});

test("the visible countdown starts thirty seconds after the throw begins", () => {
  const h = onlineScorerHarness();
  const countdown = {};
  h.ctx.document.getElementById = id => id === "onlineThrowCountdown" ? countdown : null;
  vm.runInContext("onlineMatchConnected = true", h.ctx);
  h.match().game.turnStartedAt = 1000;
  h.ctx.renderOnlineMatchClock(h.match(), "nick", 30999);
  assert.equal(countdown.hidden, true);
  h.ctx.renderOnlineMatchClock(h.match(), "nick", 31000);
  assert.equal(countdown.hidden, false);
  assert.equal(countdown.textContent, "Throw now · 30s left");
  h.ctx.renderOnlineMatchClock(h.match(), "test", 32000);
  assert.equal(countdown.textContent, "Opponent has 29s to throw");
});

test("a shared score edit queues correction before the corrected number", () => {
  const h = onlineScorerHarness();
  h.ctx.playOnlineCallout({ type: "scoreEdit", visitScore: 60, previousVisitScore: 45 });
  assert.deepEqual(h.calls.audio, ["correction.m4a", "score-60.mp3"]);
});

test("Monster Bot activity keeps a player visible even without a Versus session", () => {
  assert.equal(E.statusOf({ online: false, botGames: { session: true } }), "monster-bot");
  assert.equal(E.statusOf({ online: false, botGames: {} }), "offline");
  assert.equal(E.statusOf({ online: true, status: "playing", botGames: { session: true } }), "playing");
});

test("the completed result waits until the final checkout photo is closed", () => {
  let hidden = false;
  const shown = [];
  const match = { status: "complete", matchId: "test-final" };
  const ctx = {
    window: { currentOnlineMatch: match }, onlineMatchId: match.matchId,
    molVictoryShownForMatchId: null, getCurrentPlayerKey: () => "test",
    els: { checkoutPhotoOverlay: { classList: { contains: () => hidden } } },
    buildMatchStatsData: value => value, openMolVictoryScreen: value => shown.push(value)
  };
  const start = script.indexOf("function showCompletedVersusResult");
  vm.runInNewContext(script.slice(start, script.indexOf("function listenToOnlineMatch", start)), ctx);
  ctx.showCompletedVersusResult();
  assert.equal(shown.length, 0);
  hidden = true;
  ctx.showCompletedVersusResult();
  ctx.showCompletedVersusResult();
  assert.deepEqual(shown, [match]);
});

test("only the player whose turn it is hears the required checkout score", () => {
  const h = onlineScorerHarness();
  const required = [];
  h.ctx.announceVisitAndRequire = (_score, checkout) => required.push(checkout);
  const callout = { type: "score", visitScore: 40, requiredScore: 125 };
  h.ctx.playOnlineCallout(callout, false);
  h.ctx.playOnlineCallout(callout, true);
  assert.deepEqual(required, [null, 125]);
});

test("saved and legacy result cards supply dates and valid checkout counts", () => {
  const ctx = {
    window: {}, getCurrentPlayerKey: () => "nick",
    getMatchFormatLabel: (_type, count) => `BO${count}`
  };
  const start = script.indexOf("function buildVersusHistoryResult");
  vm.runInNewContext(script.slice(start, script.indexOf("function openLastLeagueStats", start)), ctx);
  const dateTime = "2026-11-27T16:30:00.000Z";
  const saved = ctx.buildVersusHistoryResult({
    matchMode: "online", dateTime, playerOneId: "nick", playerOneWon: true,
    playerOneCheckoutsHit: 1, playerOneCheckoutAttempts: 2
  });
  assert.equal(saved.dateTime, dateTime);
  assert.equal(saved.players[0].stats.checkouts, "1/2");
  assert.equal(saved.players[1].stats.checkouts, "0/0");
  const legacy = ctx.buildVersusHistoryResult({ score: "0-1", statsRows: [["Checkouts", "undefined/undefined", "1/2"]] });
  assert.equal(legacy.players[0].stats.checkouts, "0/0");
  assert.equal(legacy.players[1].stats.checkouts, "1/2");
});
