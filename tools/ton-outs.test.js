const test=require("node:test"),assert=require("node:assert/strict"),E=require("../scripts/ton-outs-engine"),fs=require("node:fs");
test("all 64 routes total correctly, use at most three darts and end on a double or bull",()=>{
 assert.equal(E.totals.length,64);for(const n of E.totals){const route=E.routes[n];assert.ok(route.length<=3);assert.equal(route.reduce((s,d)=>s+E.value(d),0),n,`${n}: ${route}`);assert.match(route.at(-1),/^(D(?:[1-9]|1\d|20)|Bull)$/);for(const d of route)assert.match(d,/^(?:[TD]?(?:[1-9]|1\d|20)|25|Bull)$/);}
 for(const n of [159,162,163,165,166,168,169])assert.equal(E.routes[n],undefined);
});
test("sequential progression cannot skip finishes and counts misses and successful visits",()=>{
 let data={};assert.equal(E.unlocked(100,data),true);assert.equal(E.unlocked(101,data),false);assert.throws(()=>E.record(data,101,true));data=E.record(data,100,false);assert.equal(E.attempts(data[100]),1);assert.equal(E.unlocked(101,data),false);data=E.record(data,100,true);assert.equal(E.attempts(data[100]),2);assert.equal(E.unlocked(101,data),true);assert.throws(()=>E.record(data,100,true));
 for(const n of E.totals.slice(1))data=E.record(data,n,true);assert.equal(E.completed(data).length,64);assert.equal(E.attempts(data[170]),1);
});
test("tampered non-contiguous progress does not unlock or count later finishes",()=>{assert.deepEqual(E.completed({170:{hit:true}}),[]);assert.equal(E.unlocked(170,{170:{hit:true}}),false);});
test("dartboards show the exact route and repeated darts with separate numbered markers",()=>{for(const n of E.totals){const svg=E.board(n);assert.match(svg,/viewBox="0 0 400 400"/);assert.match(svg,new RegExp('Checkout '+n+':'));assert.equal((svg.match(/<g>/g)||[]).length,E.routes[n].length);}assert.match(E.board(170),/T20, T20, Bull/);});
test("new game never launches the usual scorer and saves only private per-checkout progress",()=>{const code=fs.readFileSync(require.resolve("../scripts/ton-outs.js"),"utf8"),html=fs.readFileSync(require.resolve("../ton-outs.html"),"utf8");assert.doesNotMatch(code+html,/dart-scorer.html|ONMBotLaunch/);assert.match(code,/runTransaction/);assert.match(code,/tonOutsProgress:next/);assert.match(html,/id="tonMiss"/);assert.match(html,/id="tonHit"/);});
