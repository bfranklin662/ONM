const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html')).concat(['match/index.html']);
test('every page has consistent logo favicons, an Apple icon and app manifest',()=>{
 for(const file of pages){const head=fs.readFileSync(path.join(root,file),'utf8').match(/<head\b[^>]*>[\s\S]*?<\/head>/i)[0];
 assert.match(head,/rel="apple-touch-icon" sizes="180x180" href="\/graphics\/icons\/apple-touch-icon.png/,file);assert.match(head,/rel="manifest" href="\/site.webmanifest/,file);assert.match(head,/favicon-32.png/,file);assert.match(head,/apple-mobile-web-app-title" content="Monsters"/,file);assert.doesNotMatch(head,/graphics\/favicon1.png|i\.ibb\.co/,file);
 assert.equal((head.match(/property="og:image"/g)||[]).length,1,file);assert.match(head,/og:image" content="https:\/\/ochenessmonsters.com\/graphics\/icons\/share-monsters.png/,file);assert.match(head,/twitter:card" content="summary_large_image"/,file);
 }
});
test('manifest names the club and has full-size and maskable logo icons',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'site.webmanifest'),'utf8'));assert.equal(manifest.name,'Oche Ness Monsters');assert.equal(manifest.short_name,'Monsters');assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/');assert.equal(manifest.theme_color,'#0c2419');assert.ok(manifest.icons.some(i=>i.purpose==='maskable'&&i.sizes==='512x512'));
 for(const i of manifest.icons)assert.ok(fs.existsSync(path.join(root,i.src)));
});
test('logo images have the exact browser, Apple, app and sharing dimensions',()=>{
 for(const [name,w,h] of [['favicon-32.png',32,32],['favicon-48.png',48,48],['apple-touch-icon.png',180,180],['icon-192.png',192,192],['icon-512.png',512,512],['icon-maskable-512.png',512,512],['share-monsters.png',1200,630]]){
 const bytes=fs.readFileSync(path.join(root,'graphics/icons',name));assert.equal(bytes.readUInt32BE(16),w,name);assert.equal(bytes.readUInt32BE(20),h,name);assert.equal(bytes[25],2,'Opaque RGB avoids black/transparent home icons: '+name);
 }
});
