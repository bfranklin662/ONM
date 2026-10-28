const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
test("what I owe page has shared navigation, separate personal cards and a loading indicator, with no directory",()=>{
 const html=fs.readFileSync(require.resolve("../fines.html"),"utf8"),script=fs.readFileSync(require.resolve("../scripts/fines-balances-page.js"),"utf8");
 for(const id of ["authNavBtn","sidebar","gate","balances","refresh","loading","registrationAmount","finesAmount","payRegistration","payFines"])assert.equal((html.match(new RegExp(`id="${id}"`,"g"))||[]).length,1);
 assert.match(html,/id="historyRows"/);assert.match(html,/<h1>What I owe<\/h1>/);assert.match(html,/class="site-header"/);assert.match(html,/styles\/header.css/);assert.match(html,/redirect=fines.html/);assert.match(html,/id="balances" hidden/);assert.doesNotMatch(html,/id="search"|id="rows"/);assert.match(script,/getIdToken/);assert.match(script,/Authorization/);assert.doesNotMatch(script,/saveAdmin|writeBatch|data-payment/);
});
