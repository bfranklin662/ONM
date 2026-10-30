const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../scripts/club-bank-engine');
test('club balance includes paid fines and registrations once, opening balance and paid expenses',()=>{
 const input={openingPence:20000,payments:[{season:'26-27',amountPaidPence:725},{season:'25-26',amountPaidPence:9900}],players:[{registrationPaidSeasons:['26-27']},{registrationPaidSeasons:[]}],entries:[{season:'26-27',type:'expense',amountPence:10000},{season:'26-27',type:'income',amountPence:2000},{season:'26-27',type:'expense',amountPence:9999,voided:true}]};
 const result=E.summary(input);assert.equal(result.fines,725);assert.equal(result.registrations,1500);assert.equal(result.income,4225);assert.equal(result.expenses,10000);assert.equal(result.balance,14225);
 input.payments[0].amountPaidPence=1000;assert.equal(E.summary(input).balance,14500);
});
test('unpaid fines are not cash and invalid or other-season entries are excluded',()=>{
 assert.equal(E.summary().balance,0);
 assert.equal(E.summary({payments:[{season:'26-27',amountPaidPence:-1}],entries:[{season:'25-26',type:'income',amountPence:1000},{season:'26-27',type:'expense',amountPence:1.5}]}).balance,0);
 assert.equal(E.summary({openingPence:-1500}).balance,-1500);
});
test('fines owed match admin balances per player, never offset by another player’s overpayment',()=>{
 const {buildFineBalances}=require('../functions/fines-balances');
 const players=[{id:'nick',publicName:'Nick',fullName:'Nick Horne'},{id:'ian',publicName:'Ian'}],results=[{season:'26-27',sheetRow:{Player1:'Nick',F1:'£10.00',Player2:'Ian',F2:5}},{season:'26-27',sheetRow:{'Player 1':'Nick Horne','F 1':2,Player2:'Guest',F2:3}}],payments=[{season:'26-27',playerKey:'nick',amountPaidPence:400},{season:'26-27',playerKey:'ian',amountPaidPence:2000}];
 const expected=buildFineBalances(players,results,payments).reduce((n,r)=>n+r.owedPence,0);assert.equal(E.finesOwed(players,results,payments),expected);assert.equal(expected,1100);
 const totals=E.summary({players,results,payments});assert.equal(totals.owed,1100);assert.equal(totals.balance,2400);
});
test('amounts are validated as integer pence with no floating point drift',()=>{
 assert.equal(E.amount('10.01'),1001);assert.equal(E.amount('0.29'),29);assert.equal(E.amount('-20.50',{signed:true}),-2050);assert.equal(E.amount('0',{signed:true}),0);
 for(const value of ['','-1','0','NaN','1.001','1e3','Infinity','1000001'])assert.throws(()=>E.amount(value));
});
const source=fs.readFileSync(require.resolve('../scripts/club-bank.js'),'utf8');
async function harness(role='admin'){
 const nodes=new Map(),listeners=new Map(),writes=[],auth={};let profileCallback;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,innerHTML:'',textContent:'',value:'',elements:[],listeners:{},addEventListener(k,fn){this.listeners[k]=fn;}});return nodes.get(id);};
 const s={doc:(a,b,c)=>({key:b==='users'?'profile':b==='clubBankSettings'?'settings':c||'new'}),collection:(_db,name)=>({key:name}),query:ref=>ref,where:()=>null,serverTimestamp:()=>({timestamp:true}),onSnapshot:(ref,fn,err)=>{if(ref.key==='profile')profileCallback=fn;else listeners.set(ref.key,{fn,err});return ()=>{listeners.delete(ref.key);};},setDoc:async(ref,data)=>writes.push({ref,data}),updateDoc:async(ref,data)=>writes.push({ref,data}),writeBatch:()=>({set(ref,data){writes.push({ref,data});},commit:async()=>{}})};
 const ctx={document:{getElementById:node},window:{ONMClubBank:E,confirm:()=>true,addEventListener(){},location:{reload(){}},ONMFirebase:{ready:Promise.resolve({db:{},firestoreSdk:s}),authReady:Promise.resolve({auth:{},authSdk:{onAuthStateChanged:(_,fn)=>{auth.changed=fn;}}})}}};
 vm.runInNewContext(source,ctx);await new Promise(r=>setImmediate(r));await auth.changed({uid:'admin',displayName:'Nick'});profileCallback({data:()=>({status:'Active',role,firstName:'Nick'})});await new Promise(r=>setImmediate(r));
 const emit=(key,rows)=>listeners.get(key).fn(key==='settings'?{data:()=>rows}:{docs:rows.map((d,i)=>({id:String(i),data:()=>d}))});
 return {node,listeners,writes,auth,emit,profileCallback};
}
test('non-admin cannot load bank collections or view balances',async()=>{
 const g=await harness('member');assert.equal(g.listeners.size,0);assert.equal(g.node('bankApp').hidden,true);assert.match(g.node('bankGate').innerHTML,/administrators only/);assert.equal(g.writes.length,0);
});
test('balances wait for all live sources and update when payments change',async()=>{
 const g=await harness();assert.equal(g.listeners.size,5);g.emit('results',[]);g.emit('finePayments',[{season:'26-27',amountPaidPence:500}]);g.emit('players',[{fullName:'Nick',registrationPaidSeasons:['26-27']}]);g.emit('clubBankEntries',[{season:'26-27',type:'expense',date:'2026-10-30',description:'League',amountPence:1000}]);assert.equal(g.node('bankContent').hidden,true);
 g.emit('settings',{openingPence:10000});assert.equal(g.node('bankContent').hidden,false);assert.equal(g.node('bankBalance').textContent,'£110.00');g.emit('finePayments',[{season:'26-27',amountPaidPence:1000}]);assert.equal(g.node('bankBalance').textContent,'£115.00');
 g.listeners.get('finePayments').err({code:'unavailable'});assert.equal(g.node('bankContent').hidden,true);assert.match(g.node('bankStatus').textContent,/Couldn’t load/);
});
test('admins can record paid expenses without an opening balance form',async()=>{
 const g=await harness();for(const key of ['finePayments','players','clubBankEntries','results'])g.emit(key,[]);g.emit('settings',{});
 g.node('entryAmount').value='12.34';g.node('entryDescription').value='League fees';g.node('entryType').value='expense';g.node('entryDate').value='2026-01-01';
 g.node('bankEntryForm').listeners.submit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(g.writes[0].data.amountPence,1234);assert.equal(g.writes[0].data.type,'expense');assert.equal(g.writes[0].data.createdBy,'admin');assert.equal(g.writes[0].data.voided,false);
 assert.equal(g.writes.length,1);
});
test('invalid expenses cannot be written',async()=>{
 const g=await harness();g.node('entryAmount').value='-1';g.node('bankEntryForm').listeners.submit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(g.writes.length,0);assert.match(g.node('bankStatus').textContent,/valid amount/);
});
test('revoked admin and sign out clear financial data',async()=>{
 const g=await harness();g.profileCallback({data:()=>({status:'Active',role:'member'})});assert.equal(g.listeners.size,0);assert.equal(g.node('bankApp').hidden,true);await g.auth.changed(null);assert.match(g.node('bankGate').innerHTML,/Log in/);assert.equal(g.node('bankEntries').innerHTML,'');
});
test('Bank is the next admin tab after Accounts, with the embedded cash book and no Starling balance request',()=>{
 const html=fs.readFileSync(require.resolve('../admin.html'),'utf8'),admin=fs.readFileSync(require.resolve('../scripts/admin.js'),'utf8');
 assert.match(html,/data-admin-tab="requests">Accounts<\/button>\s*<button[^>]*data-admin-tab="bank">Bank<\/button>/);
 assert.match(html,/id="bankPanel" class="bankShell hidden"/);assert.match(admin,/getElementById\("bankPanel"\).*state.activeTab !== "bank"/);
 for(const [,id] of source.matchAll(/\$\("([^"]+)"\)/g))assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id);
 assert.doesNotMatch(source,/api\.starlingbank|balance\/account|readStarlingAccounts/);
});
test('page uses admin branding, has all script IDs and rules protect cash book records',()=>{
 const html=fs.readFileSync(require.resolve('../bank.html'),'utf8'),rules=fs.readFileSync(require.resolve('../firestore.rules'),'utf8');
 for(const [,id] of source.matchAll(/\$\("([^"]+)"\)/g))assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/noindex,nofollow/);assert.match(html,/class="adminHeader"/);assert.doesNotMatch(html,/id="openingForm"/);assert.match(html,/id="bankOwed"/);assert.doesNotMatch(source,/STARLING_ACCESS_TOKEN|bankTransferLedger/);
 for(const name of ['clubBankEntries','clubBankSettings','clubBankOpeningHistory'])assert.ok(rules.includes(`match /${name}/`));assert.match(rules,/resource.data.voided == false/);assert.match(rules,/affectedKeys\(\).hasOnly\(\["voided"/);
});
