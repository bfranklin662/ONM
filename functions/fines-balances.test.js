const test=require("node:test"),assert=require("node:assert/strict"),{buildFineBalances,buildFineHistory}=require("./fines-balances");
test("private balances reject guests and inactive accounts before financial collections are read",async()=>{
  const fs=require("node:fs"),vm=require("node:vm"),source=fs.readFileSync(require.resolve("./index"),"utf8"),start=source.indexOf("exports.getFinesBalances="),end=source.indexOf("\n});",start)+4;
  let reads=0;const ctx={exports:{},options:{},onCall:(_options,handler)=>handler,HttpsError:class extends Error{constructor(code,message){super(message);this.code=code;}},getFirestore:()=>({collection:name=>{if(name!=="users")reads++;return {doc:()=>({get:async()=>({exists:true,data:()=>({status:"Inactive"})})})};}}),buildFineBalances,buildFineHistory};
  vm.runInNewContext(source.slice(start,end),ctx);
  await assert.rejects(ctx.exports.getFinesBalances({}),e=>e.code==="unauthenticated");await assert.rejects(ctx.exports.getFinesBalances({auth:{uid:"member"}}),e=>e.code==="permission-denied");assert.equal(reads,0);
});
test("balances use season results, subtract payments and count each appearance once",()=>{
  const rows=buildFineBalances([{id:"nick",publicName:"Nick H",fullName:"Nick Horne",email:"private"}],[{season:"26-27",sheetRow:{Player1:"Nick H",F1:"£3.50",Player2:"Nick Horne",F2:"1"}},{season:"26-27",sheetRow:{Player1:"Nick H",F1:"2"}},{season:"25-26",sheetRow:{Player1:"Nick H",F1:100}}],[{season:"26-27",playerKey:"nick",amountPaidPence:300}]);
  assert.deepEqual(rows,[{playerKey:"nick",name:"Nick Horne",registrationPaid:false,appearances:2,issuedPence:650,paidPence:300,owedPence:350}]);assert.ok(!JSON.stringify(rows).includes("private"));
});
test("unmatched players remain visible, invalid fines are ignored, and overpayments never produce negative debt",()=>{
  const rows=buildFineBalances([{id:"a",publicName:"Alex"}],[{season:"26-27",sheetRow:{"Player 1":"Guest","F 1":"1.25",Player2:"Alex",F2:"bad"}}],[{season:"26-27",playerKey:"a",amountPaidPence:400}]);
  assert.equal(rows[0].name,"Guest");assert.equal(rows[0].owedPence,125);assert.equal(rows[1].owedPence,0);assert.equal(rows[1].paidPence,400);
});
test("players without appearances are excluded and registration status follows the selected season",()=>{
  const rows=buildFineBalances([{id:"played",publicName:"Played",registrationPaidSeasons:["26-27"]},{id:"unused",publicName:"Unused",registrationPaidSeasons:["26-27"]}],[{season:"26-27",sheetRow:{Player1:"Played",F1:"2"}}],[]);
  assert.equal(rows.length,1);assert.equal(rows[0].playerKey,"played");assert.equal(rows[0].registrationPaid,true);
});
test("personal balances endpoint never returns other players, including to an admin",async()=>{
 const fs=require("node:fs"),vm=require("node:vm"),source=fs.readFileSync(require.resolve("./index"),"utf8"),start=source.indexOf("exports.getFinesBalances="),end=source.indexOf("\n});",start)+4;
 const doc=(id,data)=>({id,exists:true,data:()=>data});
 const lists={players:[doc("nick",{fullName:"Nick Horne",publicName:"Nick"}),doc("other",{fullName:"Other Private Player",publicName:"Other"})],results:[doc("match",{season:"26-27",sheetRow:{Player1:"Nick",F1:"2",Player2:"Other",F2:"99"}})],finePayments:[]};
 const db={collection:name=>{const q={select:()=>q,where:()=>q,get:async()=>({docs:lists[name]||[]}),doc:id=>({get:async()=>doc(id,name==="users"?{status:"Active",role:"admin",firstName:"Nick",linkedPlayerKey:"nick"}:name==="finePaymentReferences"?{reference:"Fines-NH"}:{healthy:false})})};return q;},runTransaction:fn=>fn({get:ref=>ref.get()})};
 const ctx={exports:{},options:{},onCall:(_,handler)=>handler,HttpsError:Error,getFirestore:()=>db,buildFineBalances,buildFineHistory};vm.runInNewContext(source.slice(start,end),ctx);
 const result=await ctx.exports.getFinesBalances({auth:{uid:"nick"}});assert.equal(result.viewer.balance.owedPence,200);assert.equal(Object.hasOwn(result,"players"),false);assert.equal(Object.hasOwn(result,"bankReview"),false);assert.doesNotMatch(JSON.stringify(result),/Other Private Player|9900/);
});
test("match history includes only the linked player, groups slots and sorts UK dates newest first",()=>{
 const results=[{season:"26-27",sheetRow:{Date:"29/09/2026",HomeTeam:"Oche Ness Monsters",AwayTeam:"BB Kings",HomeScore:4,AwayScore:5,Competition:"Banks",Player1:"Nick",C1:2,F1:"£6.80"}},{season:"26-27",sheetRow:{Date:"08/10/2026",HomeTeam:"Mugs",AwayTeam:"Oche Ness Monsters",HomeScore:5,AwayScore:4,"Player 1":"Nick Horne","C 1":1,"F 1":"2",Player2:"Nick",C2:2,F2:"0.50",Player3:"Other",C3:9,F3:99}},{season:"26-27",sheetRow:{Date:"21/10/2026",Player1:"Other",F1:50}},{season:"25-26",sheetRow:{Player1:"Nick",F1:100}}];
 const history=buildFineHistory({fullName:"Nick Horne",publicName:"Nick"},results);assert.equal(history.length,2);assert.equal(history[0].date,"08/10/2026");assert.equal(history[0].opponent,"Mugs");assert.equal(history[0].side,"Away");assert.equal(history[0].score,"5–4");assert.equal(history[0].appearances,1);assert.equal(history[0].checkouts,3);assert.equal(history[0].finesPence,250);assert.equal(history[1].finesPence,680);assert.deepEqual(buildFineHistory(null,results),[]);
});
