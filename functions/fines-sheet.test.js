const test=require("node:test"),assert=require("node:assert/strict");
const {outstandingFineRows,syncFinesSheet}=require("./fines-sheet");
test("shared list contains only unpaid fines, subtracts payments and excludes registration",()=>{
 const players=[{id:"nick",publicName:"Nick",registrationPaidSeasons:[]},{id:"gary",publicName:"Gary"},{id:"unused",publicName:"Unused"}];
 const results=[{season:"26-27",sheetRow:{Player1:"Nick",F1:"10",Player2:"Gary",F2:"5"}}];
 const payments=[{season:"26-27",playerKey:"nick",amountPaidPence:300},{season:"26-27",playerKey:"gary",amountPaidPence:500}];
 assert.deepEqual(outstandingFineRows(players,results,payments),[["Nick",7]]);
});
test("sheet export replaces stale rows with blanks and only writes fines ranges",async()=>{
 const db={collection:()=>({select(){return this},where(){return this},get:async()=>({docs:[]})})};let data;
 await syncFinesSheet({db,write:async v=>{data=v}});
 assert.equal(data[1].values.length,197);assert.deepEqual(data[1].values[0],["Player","Fines owed"]);assert.deepEqual(data[1].values[1],["",""]);assert.ok(data.every(d=>d.range.startsWith("'Fines 26-27'!")));
});
