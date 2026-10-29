const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
test("Ton+ Outs reuses the ladder title/help styling and signed-in player summary structure",()=>{
 const ton=fs.readFileSync(require.resolve("../ton-outs.html"),"utf8"),survival=fs.readFileSync(require.resolve("../monster-survival.html"),"utf8");
 assert.match(ton,/class="botIntro"><h1 id="tonPageTitle"/);assert.doesNotMatch(ton,/class="tonHeading"/);
 for(const html of [ton,survival]){assert.match(html,/class="playerSummary"/);assert.match(html,/class="playerSummaryDetails"/);assert.match(html,/class="playerSummaryCompletion"/);assert.match(html,/monster-bot-compact.css/);assert.match(html,/game-summary-identity.js/);}
});
test("summary identity uses the first name, resolves a linked photo and falls back to an icon",async()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},ctx={document:{getElementById:node},fetch:async()=>({ok:true,json:async()=>({nick:"https://example.com/nick.jpg"})}),window:{ONMFirebase:{ready:Promise.resolve({db:{},firestoreSdk:{doc:()=>"publicPlayers/nick",getDoc:async()=>({data:()=>({publicName:"Nick"})})}})}}};
 vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/game-summary-identity.js"),"utf8"),ctx);
 ctx.window.ONMGameSummaryIdentity.render("tonSummary",{uid:"nick"},{firstName:"Nick",linkedPlayerKey:"nick"});await new Promise(r=>setImmediate(r));assert.equal(node("tonSummaryName").textContent,"Nick");assert.equal(node("tonSummaryPhoto").src,"https://example.com/nick.jpg");node("tonSummaryPhoto").onerror();assert.match(node("tonSummaryPhoto").src,/^data:image\/svg\+xml,/);
 await ctx.window.ONMGameSummaryIdentity.loadPhotos();const row=ctx.window.ONMGameSummaryIdentity.row({name:"Nick",photoUrl:"images/players/Nick.jpg",flag:"🇬🇧"});assert.match(row,/https:\/\/example.com\/nick.jpg/);assert.match(row,/class="botLeaderboardFlag"/);
});
