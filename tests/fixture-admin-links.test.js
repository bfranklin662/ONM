const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../scripts/admin.js'),'utf8');
const context = {};
vm.createContext(context);
for (const name of ['clean','rowFor','inputDate','requestedMatchCandidates']) {
  const start = source.indexOf(`  function ${name}(`);
  const ends = [source.indexOf('\n  function ',start+10),source.indexOf('\n  async function ',start+10)].filter(value=>value>=0);
  vm.runInContext(source.slice(start,Math.min(...ends)),context);
}
test('fixture edit links distinguish league, opponent, date, season and side',()=>{
  const fixture={id:'banks',season:'26-27',sheetRow:{Date:'24th Nov 2026',League:'Banks League',Opponent:'The Arrows',HA:'Away'}};
  const params=new URLSearchParams({date:'2026-11-24',league:'Banks League',opponent:'The Arrows',side:'Away',season:'26-27'});
  const other={...fixture,id:'trafalgar',sheetRow:{...fixture.sheetRow,League:'Trafalgar League'}};
  assert.equal(context.requestedMatchCandidates([fixture,other],params,'fixture')[0].id,'banks');
  params.set('side','Home');assert.equal(context.requestedMatchCandidates([fixture],params,'fixture').length,0);
  params.set('side','Away');assert.equal(context.requestedMatchCandidates([fixture,{...fixture,id:'duplicate'}],params,'fixture').length,2);
});
test('result edit links use saved result IDs and do not silently select another match',()=>{
  const results=[{id:'first'},{id:'second'}];
  assert.equal(context.requestedMatchCandidates(results,new URLSearchParams({id:'second'}),'result')[0].id,'second');
  assert.equal(context.requestedMatchCandidates(results,new URLSearchParams({id:'deleted'}),'result').length,0);
});
