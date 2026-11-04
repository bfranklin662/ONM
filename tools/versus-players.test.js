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
test('player gallery contains pictures flags and averages, without rank or win-loss columns',()=>{
 const part=script.slice(script.indexOf('function renderLeaderboard('),script.indexOf('async function loadExpandedPlayerStats(')),nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{add(){},toggle(){}}});return nodes.get(id);};
 const ctx={document:{getElementById:node,querySelector:()=>node('meta')},window:{ONMSession:{getUser:()=>({})}},loggedInUser:{},getCurrentPlayerKey:()=>'a',leaderboardFlag:()=> '🇬🇧',escapeHtml:v=>String(v).replace(/</g,'&lt;'),currentLeagueProfile:null};
 vm.runInNewContext(part,ctx);ctx.renderLeaderboard([{playerKey:'a',playerName:'Alex',average:'52.50',photo:'images/a.jpg',nationality:'England'}]);
 const html=node('leaderboardRows').innerHTML;assert.match(html,/versusPlayer/);assert.match(html,/images\/a.jpg/);assert.match(html,/🇬🇧/);assert.match(html,/52.50/);assert.doesNotMatch(html,/leaderboardRank|leaderboardRating|Wins|Losses|streak/);
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
