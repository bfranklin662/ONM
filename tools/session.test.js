const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
function harness(current, fail = false) {
  const user = {uid:"member",userId:"member",firstName:"Member"};
  const storage = new Map([["onmUser",JSON.stringify(user)]]);
  let signOuts=0;
  const context={window:{ONMFirebase:{firebasePrimary:true,currentFirebaseUser:async()=>{if(fail)throw Error("Offline");return current;},post:async()=>({success:true,user}),signOut:async()=>{signOuts++;}}},document:{getElementById:()=>null,addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
  vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/session.js"),"utf8"),context);
  return {session:context.window.ONMSession,storage,signOuts:()=>signOuts};
}
test("an expired cached profile is not treated as signed in or used to sign out a session",async()=>{
  const g=harness(null);
  assert.equal(await g.session.init(),null);
  assert.equal(g.storage.has("onmUser"),false);
  assert.equal(g.signOuts(),0);
});
test("a verified persisted account is recognised",async()=>{
  const g=harness({uid:"member"});
  assert.equal((await g.session.init()).uid,"member");
  assert.equal((await g.session.check()).uid,"member");
});
test("failed or mismatched auth verification does not trust a stale cache",async()=>{
  assert.equal(await harness(null,true).session.init(),null);
  assert.equal(await harness({uid:"someone-else"}).session.check(),null);
});
test("embedded bot scorers reuse the authenticated same-origin Firebase client",()=>{
  const firebase={firebasePrimary:true,ready:Promise.resolve({}),currentFirebaseUser:async()=>({uid:"member"})};
  const ctx={URLSearchParams,window:{location:{origin:"https://example.test",search:"?mode=bot"},parent:{location:{origin:"https://example.test"},ONMFirebase:firebase}}};
  vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/firebase-client.js"),"utf8"),ctx);
  assert.equal(ctx.window.ONMFirebase,firebase);
});
