const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../scripts/admin.js'),'utf8');
test('quick payments can exceed the outstanding fines and preserve the full payment',async()=>{
 const nodes=new Map(),writes=[],node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},textContent:'',focus(){}});return nodes.get(id);};
 node('quickFinePlayer').dataset.playerKey='nick';node('quickFineAmount').value='10';
 const button={disabled:false},form={dataset:{},reportValidity:()=>true,querySelector:()=>button};
 const state={players:[{playerKey:'nick',publicName:'Nick'}],finePayments:[],user:{uid:'admin'}};
 const sdk={doc:()=>null,increment:n=>n,serverTimestamp:()=>null,setDoc:async(_,v)=>writes.push(v)};
 const ctx={state,document:{getElementById:node},playerFineAccount:()=>({owed:400}),currencyForToast:p=>'£'+(p/100).toFixed(2),renderPlayers(){},renderFines(){},window:{ONMFirebase:{ready:Promise.resolve({db:{},firestoreSdk:sdk})}}};
 const start=source.indexOf('  async function saveQuickFinePayment('),end=source.indexOf('  async function recordFinePayment(',start);vm.runInNewContext(source.slice(start,end),ctx);
 await ctx.saveQuickFinePayment({preventDefault(){},currentTarget:form});assert.equal(writes[0].amountPaidPence,1000);assert.equal(state.finePayments[0].amountPaidPence,1000);assert.equal(button.disabled,false);assert.doesNotMatch(node('quickFineStatus').textContent,/exceeds/);
});
test('admin credit is green, payment controls have no outstanding-balance cap, and totals exclude credits',()=>{
 assert.doesNotMatch(source,/Payment exceeds the outstanding balance|cannot be more than the outstanding fine balance|max="\$\{\(player.outstandingPence/);
 assert.match(source,/owed: issued - paid/);assert.match(source,/balance.owed < 0 \? "fineCredit"/);assert.match(source,/balance.owed === 0 && balance.paid > 0 \? "fineSettled"/);assert.match(source,/Math.max\(0,item.owed\)/);assert.match(source,/Math.max\(0,player.outstandingPence\)/);
});
