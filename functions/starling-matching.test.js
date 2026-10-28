const test=require("node:test"),assert=require("node:assert/strict");
const {syncStarling,allocation}=require("./starling-matching");
const now=new Date("2026-10-28T15:00:00Z");
const intent={status:"open",amountPence:2000,finesPence:500,registrationPence:1500,paidBaselinePence:100,createdAt:"2026-10-28T13:00:00Z",expiresAt:"2026-11-04T13:00:00Z"};
function fixture(changes={}){
 const values=new Map(Object.entries({"bankMatching/starling":{enabled:true,activatedAt:"2026-10-28T12:00:00Z",accountUid:"a"},"finePaymentReferences/nick":{playerKey:"nick",reference:"Fines-NH"},"finePaymentIntents/nick":intent,"players/nick":{fullName:"Nick",registrationPaidSeasons:[]},"finePayments/26-27__nick":{amountPaidPence:100},...changes}));
 const snap=key=>({exists:values.has(key),data:()=>values.get(key)});
 const doc=key=>({get:async()=>snap(key),set:async(v,o)=>values.set(key,o?.merge?{...values.get(key),...v}:v),key});
 const db={collection:c=>({doc:id=>doc(`${c}/${id}`),get:async()=>({docs:[...values].filter(([k])=>k.startsWith(c+"/")).map(([k])=>snap(k))})}),runTransaction:async fn=>fn({get:async ref=>snap(ref.key),set:(ref,v,o)=>values.set(ref.key,o?.merge?{...values.get(ref.key),...v}:v)})};
 const item={feedItemUid:"tx1",direction:"IN",source:"FASTER_PAYMENTS_IN",status:"SETTLED",reference:"Fines-NH",amount:{currency:"GBP",minorUnits:2000},transactionTime:"2026-10-28T14:00:00Z"};
 const fetcher=async url=>({ok:true,json:async()=>url.endsWith("/accounts")?{accounts:[{accountUid:"a",defaultCategory:"c",currency:"GBP"}]}:{feedItems:[item]}});
 return {values,db,item,fetcher};
}
test("combined payment credits fines and registration exactly once, even if delivered again",async()=>{
 const f=fixture();await syncStarling({...f,token:"test",now});await syncStarling({...f,token:"test",now});
 assert.equal(f.values.get("finePayments/26-27__nick").amountPaidPence,600);
 assert.deepEqual(f.values.get("players/nick").registrationPaidSeasons,["26-27"]);
 assert.deepEqual(f.values.get("publicPlayers/nick").registrationPaidSeasons,["26-27"]);
 assert.equal(f.values.get("finePaymentIntents/nick").status,"paid");
});
test("changed manual payment, missing instructions, wrong amount and pre-instruction transfer never auto-credit",async()=>{
 for(const scenario of ["changed","missing","amount","date"]){const f=fixture();if(scenario==="changed")f.values.set("finePayments/26-27__nick",{amountPaidPence:200});if(scenario==="missing")f.values.delete("finePaymentIntents/nick");if(scenario==="amount")f.item.amount.minorUnits=1000;if(scenario==="date")f.item.transactionTime="2026-10-28T12:30:00Z";const baseline=f.values.get("finePayments/26-27__nick").amountPaidPence;assert.equal((await syncStarling({...f,token:"test",now})).review,1);assert.equal(f.values.get("finePayments/26-27__nick").amountPaidPence,baseline);}
});
test("allocations reject expired instructions and changed registration",()=>{
 assert.equal(allocation({...intent,expiresAt:"2026-10-27T00:00:00Z"},{},{amountPaidPence:100},now.getTime()),"invalid-or-expired-instructions");
 assert.equal(allocation(intent,{registrationPaidSeasons:["26-27"]},{amountPaidPence:100},now.getTime()),"registration-changed");
});
test("separate registration and fines transfers reconcile in either order without overwriting each other",async()=>{
 for(const order of ["registration-first","fines-first"]){
  const f=fixture();f.values.delete("finePaymentIntents/nick");
  f.values.set("finePaymentIntents/nick__fines",{...intent,type:"fines",registrationPence:0,finesPence:500,amountPence:500});
  f.values.set("finePaymentIntents/nick__registration",{...intent,type:"registration",registrationPence:1500,finesPence:0,amountPence:1500});
  f.values.set("finePaymentReferences/nick__registration",{playerKey:"nick",reference:"Reg-NH",intentId:"nick__registration"});
  const registration={...f.item,feedItemUid:"reg1",reference:"Reg-NH",amount:{currency:"GBP",minorUnits:1500}},fines={...f.item,feedItemUid:"fine1",amount:{currency:"GBP",minorUnits:500}};
  const fetcher=async url=>({ok:true,json:async()=>url.endsWith("/accounts")?{accounts:[{accountUid:"a",defaultCategory:"c",currency:"GBP"}]}:{feedItems:order==="registration-first"?[registration,fines]:[fines,registration]}});
  assert.equal((await syncStarling({...f,fetcher,token:"test",now})).matched,2);
  assert.equal(f.values.get("finePayments/26-27__nick").amountPaidPence,600);assert.deepEqual(f.values.get("players/nick").registrationPaidSeasons,["26-27"]);
  assert.equal((await syncStarling({...f,fetcher,token:"test",now})).matched,0);
 }
});
