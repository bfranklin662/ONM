const test=require("node:test"),assert=require("node:assert/strict");
const create=require("../scripts/monster-bot-attempts");
function storage(){const data=new Map();return{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),data};}
function database(){let data={};return{read:()=>data,sdk:{doc:(_db,_type,uid)=>uid,runTransaction:async(_db,fn)=>fn({get:async()=>({data:()=>data}),update:(_ref,changes)=>{data={...data,...changes};}})}};}
test("private counts are per account and challenge, and retained on the device",async()=>{
  const local=storage(),db=database(),t=create(local,()=>"device-one");
  t.load("alice",{});assert.equal(t.start("alice","1-9"),1);assert.equal(t.start("alice","1-9"),2);assert.equal(t.start("alice","2-3"),1);
  await t.sync("alice",{},db.sdk);await t.sync("alice",{},db.sdk);
  assert.equal(t.counts("alice")["1-9"],2);assert.deepEqual(t.counts("bob"),{});
  const reloaded=create(local,()=>assert.fail("Must reuse device ID"));reloaded.load("alice",db.read());assert.equal(reloaded.counts("alice")["1-9"],2);
  assert.throws(()=>t.start("alice","invalid"));
});
test("two devices merge offline attempts without counting retries of the sync twice",async()=>{
  const db=database(),a=create(storage(),()=>"device-one"),b=create(storage(),()=>"device-two");
  a.load("alice",{});b.load("alice",{});a.start("alice","1-9");b.start("alice","1-9");b.start("alice","1-9");
  await a.sync("alice",{},db.sdk);await b.sync("alice",{},db.sdk);await a.sync("alice",{},db.sdk);
  assert.equal(a.counts("alice")["1-9"],3);assert.equal(b.counts("alice")["1-9"],3);
  a.start("alice","1-9");await assert.rejects(a.sync("alice",{},{...db.sdk,runTransaction:async()=>{throw Error("offline");}}));
  await a.sync("alice",{},db.sdk);await a.sync("alice",{},db.sdk);assert.equal(a.counts("alice")["1-9"],4);
});
test("initialising the tracker alone stores nothing for casual games",()=>{
  const local=storage();create(local,()=>"device-one");assert.equal(local.data.size,0);
});
