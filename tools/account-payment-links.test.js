const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("account promotes What I owe and retains a smaller player profile link",()=>{
 assert.match(read("scripts/account.js"),/class="btn btnPrimary" href="fines.html">What I owe/);assert.match(read("scripts/account.js"),/class="accountProfileLink"/);assert.match(read("styles/account.css"),/accountProfileLink\{[^}]*font-size:12px/);assert.match(read("player-profile.html"),/href="fines.html">What I owe/);
});
test("header avatar fills the circular button without the old extra zoom",()=>{
 const css=read("styles/site-theme.css");assert.match(css,/authProfileBtn,\.profileHeaderBtn[^}]*border-radius:50%;overflow:hidden/);assert.match(css,/authProfileBtn img[^}]*width:100%;height:100%[^}]*transform:none/);
});
test("default avatar is shared on desktop and mobile, including bot headers",()=>{
 const css=read("styles/site-theme.css");
 assert.ok(css.indexOf(".authProfileInitial{display:block")<css.indexOf("@media"));
 assert.match(read("scripts/session.js"),/initial.setAttribute\("aria-hidden", "true"\)/);
 assert.match(read("scripts/site-ui.js"),/user\?\.uid!==current.uid/);
 assert.match(read("scripts/site-ui.js"),/botProfile.replaceChildren\(image\)/);
});
