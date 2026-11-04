// Reuse the original club artwork without redrawing or AI-altering the logo.
const fs=require('node:fs'),path=require('node:path');
let sharp;try{sharp=require('sharp');}catch{sharp=require('/Users/djnickhorne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');}
const root=path.resolve(__dirname,'..'),out=path.join(root,'graphics/icons'),green='#0c2419';
async function icon(name,size,ratio=0.88,crop=false){
 let logo=sharp(path.join(root,'graphics/logoWText.png'));if(crop)logo=logo.extract({left:95,top:95,width:530,height:530});
 const width=Math.round(size*ratio),buffer=await logo.resize(width,width).png().toBuffer();
 await sharp({create:{width:size,height:size,channels:3,background:green}}).composite([{input:buffer,gravity:'centre'}]).removeAlpha().png().toFile(path.join(out,name));
}
(async()=>{fs.mkdirSync(out,{recursive:true});await Promise.all([icon('favicon-32.png',32,1,true),icon('favicon-48.png',48,1,true),icon('apple-touch-icon.png',180),icon('icon-192.png',192),icon('icon-512.png',512),icon('icon-maskable-512.png',512,.76)]);
 const artwork=await sharp(path.join(root,'graphics/logoWText.png')).resize(530,530).png().toBuffer();
 const lettering=Buffer.from('<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><path d="M610 165H1100" stroke="#447254"/><g fill="#fff" font-family="Arial, sans-serif" font-weight="900"><text x="610" y="260" font-size="58">OCHE NESS</text><text x="610" y="340" font-size="66">MONSTERS</text></g><text x="610" y="401" fill="#b6d4c1" font-family="Arial, sans-serif" font-size="26">London darts. Games. Monsters.</text><text x="610" y="465" fill="#ffe17b" font-family="Arial, sans-serif" font-size="24">ochenessmonsters.com</text></svg>');
 await sharp({create:{width:1200,height:630,channels:3,background:green}}).composite([{input:artwork,left:40,top:50},{input:lettering}]).removeAlpha().png().toFile(path.join(out,'share-monsters.png'));
 console.log('Built six opaque club icons and a 1200×630 share image.');
})().catch(error=>{console.error(error);process.exitCode=1;});
