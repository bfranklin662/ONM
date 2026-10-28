const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("home shows both merch ranges and native scroll rails instead of hidden tabs",()=>{
 const html=read("index.html"),script=read("scripts/merch.js");
 assert.match(html,/home-refresh.css/);assert.match(html,/home-merch-ranges/);assert.doesNotMatch(html,/role="tablist"|data-merch-tab|role="tabpanel"/);
 for(const id of ["merch-shirt-panel","merch-tshirt-panel"])assert.match(html,new RegExp(`<section id="${id}"[^>]*>`));
 assert.match(script,/scrollBy/);assert.doesNotMatch(script,/panel.hidden|showMerchPanel/);
 assert.match(html,/aria-label="Next T-shirt"/);
});
test("fixture cards open directly and personal status is in their footer",()=>{
 const script=read("scripts/fixtures.js"),css=read("styles/home-refresh.css");
 assert.doesNotMatch(script,/class="fxPersonalDetails"/);
 assert.match(script,/\$\{resultCardHtml\}\s*\$\{personalBadge\(fx\)\}/);
 assert.match(script,/fixtureEventFooter/);assert.match(script,/stage.addEventListener\("keydown"/);
 assert.match(css,/max-height:340px/);assert.match(css,/\.fixtureDetails\{background:#102d20/);
});
