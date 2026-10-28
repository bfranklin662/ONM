const test=require("node:test"),assert=require("node:assert/strict"),{played}=require("../scripts/results-personal");
test("played stickers match only a verified linked player's exact public name",()=>{
 assert.equal(played(["Nick","Ricky"],[" nick "]),true);
 assert.equal(played(["Nick Horne"],["Nick"]),false);
 assert.equal(played(["Nick"],[]),false);
 assert.equal(played(["Nick"],["Ricky"]),false);
 assert.equal(played([" James   B "],["james b"]),true);
});
test("result and gallery cards carry line-ups and update badges after rendering and auth changes",()=>{
 const fs=require("node:fs"),path=require("node:path"),read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8"),source=read("scripts/results.js"),personal=read("scripts/results-personal.js");
 assert.equal((source.match(/data-result-lineup=/g)||[]).length,2);assert.match(personal,/onAuthStateChanged/);assert.match(personal,/MutationObserver/);assert.match(personal,/aliases=\[\];update\(\);if\(!user\)return/);assert.match(personal,/status!=="Active"/);assert.doesNotMatch(personal,/localStorage|account.firstName/);
 assert.match(read("results.html"),/results-personal.js/);
});
