const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../scripts/admin.js'),'utf8');
function harness({confirm=true,fail=false}={}){
 const fixture={id:'fixture-1',sheetRow:{Opponent:'Natwest Allsorts',Date:'29th Oct 2026'}},writes=[],messages=[],prompts=[];
 const state={fixtures:[fixture],results:[{id:'result-1'}],editor:{type:'fixture',id:fixture.id}};
 const ctx={state,pendingDeletions:new Set(),rowFor:x=>x.sheetRow,showToast:(m,error)=>messages.push({m,error}),closeEditor:()=>{state.editor=null;},renderFixtures(){},renderResults(){},renderFines(){},renderPlayers(){},console:{error(){}},window:{confirm:text=>{prompts.push(text);return confirm;},ONMFirebase:{ready:Promise.resolve({db:{},firestoreSdk:{doc:(_db,collection,id)=>({collection,id}),deleteDoc:async ref=>{if(fail)throw Error('Permission denied');writes.push(ref);}}})}}};
 const start=source.indexOf('  async function deleteItem('),end=source.indexOf('  async function loadCollection(',start);vm.runInNewContext(source.slice(start,end),ctx);return {ctx,state,writes,messages,prompts};
}
test('fixture editor has an explicit Delete fixture button only for existing fixtures',()=>{
 const editor=source.slice(source.indexOf('function openFixtureEditor('),source.indexOf('function playerInputs('));assert.match(editor,/item\?\.id \?/);assert.match(editor,/data-delete-fixture=/);assert.match(editor,/>Delete fixture<\/button>/);
 assert.match(source,/button.dataset.deleteFixture\) deleteItem\("fixture", button.dataset.deleteFixture\)/);
});
test('deletion confirms the exact fixture, deletes only that document and preserves results',async()=>{
 const g=harness();await g.ctx.deleteItem('fixture','fixture-1');assert.match(g.prompts[0],/Natwest Allsorts on 29th Oct 2026/);assert.match(g.prompts[0],/submitted result will remain/);assert.equal(g.writes.length,1);assert.equal(g.writes[0].collection,'fixtures');assert.equal(g.writes[0].id,'fixture-1');assert.equal(g.state.fixtures.length,0);assert.equal(g.state.results.length,1);assert.equal(g.state.editor,null);
});
test('cancelled or failed deletion keeps the fixture and editor intact',async()=>{
 for(const options of [{confirm:false},{fail:true}]){const g=harness(options);await g.ctx.deleteItem('fixture','fixture-1');assert.equal(g.writes.length,0);assert.equal(g.state.fixtures.length,1);assert.ok(g.state.editor);assert.equal(g.ctx.pendingDeletions.size,0);}
});
test('duplicate clicks issue one deletion and unknown fixture IDs cannot delete data',async()=>{
 const g=harness();await Promise.all([g.ctx.deleteItem('fixture','fixture-1'),g.ctx.deleteItem('fixture','fixture-1')]);assert.equal(g.writes.length,1);await g.ctx.deleteItem('fixture','unknown');assert.equal(g.writes.length,1);
});
