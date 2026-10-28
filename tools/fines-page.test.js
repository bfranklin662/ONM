const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
test("private fines page uses shared site navigation and contains no embedded balances",()=>{
  const html=fs.readFileSync(require.resolve("../fines.html"),"utf8"),script=fs.readFileSync(require.resolve("../scripts/fines-balances-page.js"),"utf8");
  for(const id of ["authNavBtn","sidebar","rows","gate","balances","search","refresh"])assert.equal((html.match(new RegExp(`id="${id}"`,"g"))||[]).length,1);
  assert.equal((html.match(/<main>/g)||[]).length,1);assert.match(html,/styles\/header.css/);assert.match(html,/class="site-header"/);assert.match(html,/scripts\/session.js/);assert.match(html,/redirect=fines.html/);assert.match(html,/id="balances" hidden/);assert.match(html,/id="rows"><\/tbody>/);assert.match(script,/getIdToken/);assert.match(script,/Authorization/);
});
