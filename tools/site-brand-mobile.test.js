const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("phone results release their animation height and do not retain a desktop flex-basis",()=>{
 assert.match(read("styles/site-theme.css"),/\.flex-layout\.no-match-images \.player-table-wrapper\{flex:0 1 auto/);
 assert.doesNotMatch(read("scripts/results.js"),/onclick="togglePlayers\(this\)"/);
 assert.match(read("scripts/results.js"),/anim\.cancel\(\);\s*el\.style\.removeProperty\("height"\)/);
 assert.doesNotMatch(read("results.html"),/>Season<\/label>/);
});
test("website menus keep Survival inside the game and use the shared compact theme",()=>{
 for(const page of ["index.html","results.html","players-landing.html","games.html","account.html"]){assert.match(read(page),/site-theme\.css\?v=20261028-avatar-fill/);assert.match(read(page),/site-ui\.js/);assert.doesNotMatch(read(page),/href="\/?monster-survival.html"[^>]*>Survival<\/a>/);}
 assert.match(read("account.html"),/>← Back<\/a>/);
 assert.match(read("scripts/site-ui.js"),/history.back\(\)/);
});
