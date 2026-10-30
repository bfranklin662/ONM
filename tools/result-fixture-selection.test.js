const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../scripts/fines.js'),'utf8');
const context={};
for(const name of ['fixtureDateValue','isResultTeamFixture','normaliseSeasonFixture','normaliseMatchTeam','resultDateValue','fixtureHasSubmittedResult']){
 const start=source.indexOf(`  function ${name}(`),end=source.indexOf('\n  function ',start+5);
 vm.runInNewContext(source.slice(start,end),context);
}
const cup={League:'BANKS CUP - FIRST ROUND',Date:'29th Oct 2026',Opponent:'Natwest Allsorts',HA:'Away',Location:'The Artful Dodger'};
test('last night’s named Banks Cup fixture remains eligible after its date',()=>{
 assert.equal(context.isResultTeamFixture(cup),true);
 const fixture=context.normaliseSeasonFixture(cup);
 assert.equal(fixture.dateValue,'2026-10-29');assert.ok(fixture.dateValue<='2026-10-30');assert.ok(fixture.dateValue<='2026-11-10');
 assert.equal(fixture.league,'Banks League');assert.equal(fixture.cup,true);assert.equal(fixture.stage,'FIRST ROUND');assert.equal(context.fixtureHasSubmittedResult(fixture,[]),false);
 assert.equal(context.fixtureHasSubmittedResult(fixture,[{Date:'29/10/2026',HomeTeam:'Natwest Allsorts',AwayTeam:'Oche Ness Monsters'}]),true);
});
test('league fixtures stay eligible, but unresolved draws and individual events do not',()=>{
 assert.equal(context.isResultTeamFixture({...cup,League:'Banks League'}),true);
 assert.equal(context.normaliseSeasonFixture({...cup,League:'Banks League'}).cup,false);
 assert.equal(context.isResultTeamFixture({...cup,Opponent:'TBC',HA:'TBC'}),false);
 assert.equal(context.isResultTeamFixture({...cup,League:'TRAFALGAR - SINGLES KO ROUND TWO'}),false);
});
