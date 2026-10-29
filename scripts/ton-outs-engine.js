(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ONMTonOuts=api;})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  // One suggested, double-out route per achievable total. Bull means inner bull (50).
  const routeText={100:"T20 D20",101:"T17 18 D16",102:"T20 10 D16",103:"T20 11 D16",104:"T18 18 D16",105:"T20 13 D16",106:"T20 14 D16",107:"T19 18 D16",108:"T20 16 D16",109:"T20 17 D16",110:"T20 18 D16",111:"T20 19 D16",112:"T20 20 D16",113:"T20 13 D20",114:"T20 14 D20",115:"T20 15 D20",116:"T20 16 D20",117:"T20 17 D20",118:"T20 18 D20",119:"T19 12 Bull",120:"T20 20 D20",121:"T20 11 Bull",122:"T18 18 Bull",123:"T19 16 Bull",124:"T20 14 Bull",125:"25 T20 D20",126:"T19 T19 D6",127:"T20 T17 D8",128:"T18 T14 D16",129:"T19 T16 D12",130:"T20 T20 D5",131:"T20 T13 D16",132:"T20 T20 D6",133:"T20 T19 D8",134:"T20 T14 D16",135:"T20 T15 D15",136:"T20 T20 D8",137:"T17 T18 D16",138:"T20 T14 D18",139:"T20 T13 D20",140:"T20 T16 D16",141:"T20 T15 D18",142:"T20 T14 D20",143:"T20 T17 D16",144:"T20 T20 D12",145:"T20 T15 D20",146:"T20 T18 D16",147:"T20 T17 D18",148:"T20 T16 D20",149:"T20 T19 D16",150:"T20 T18 D18",151:"T20 T17 D20",152:"T20 T20 D16",153:"T20 T19 D18",154:"T20 T18 D20",155:"T20 T19 D19",156:"T20 T20 D18",157:"T20 T19 D20",158:"T20 T20 D19",160:"T20 T20 D20",161:"T20 T17 Bull",164:"T20 T18 Bull",167:"T20 T19 Bull",170:"T20 T20 Bull"};
  const routes=Object.fromEntries(Object.entries(routeText).map(([key,value])=>[key,value.split(" ")]));
  const totals=Object.keys(routes).map(Number).sort((a,b)=>a-b);
  function completed(data={}){const result=[];for(const total of totals){if(data[String(total)]?.hit!==true)break;result.push(total);}return result;}
  function unlocked(total,data){const wins=completed(data);return totals.includes(total)&&(wins.includes(total)||totals[wins.length]===total);}
  function record(data,total,hit){
    if(!unlocked(total,data)||completed(data).includes(total))throw Error("This checkout is locked or already complete.");
    const prior=data[String(total)]||{},misses=Math.min(1000000,Math.max(0,Number.isInteger(prior.misses)?prior.misses:0));
    return {...data,[String(total)]:{misses:misses+(hit?0:1),hit:Boolean(hit)}};
  }
  const attempts=entry=>Math.max(0,Number.isInteger(entry?.misses)?entry.misses:0)+(entry?.hit===true?1:0);
  const value=segment=>segment==="Bull"?50:segment==="25"?25:Number(segment.replace(/^[TD]/,""))*(segment[0]==="T"?3:segment[0]==="D"?2:1);
  const order=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const point=(radius,angle)=>[200+radius*Math.sin(angle),200-radius*Math.cos(angle)];
  function arcPath(inner,outer,start,end){const a=point(outer,start),b=point(outer,end),c=point(inner,end),d=point(inner,start);return `M${a} A${outer},${outer} 0 0 1 ${b} L${c} A${inner},${inner} 0 0 0 ${d} Z`;}
  function board(total){
    const route=routes[total]||[],step=Math.PI/10;let svg='<svg viewBox="0 0 400 400" role="img" aria-labelledby="boardTitle"><title id="boardTitle">Checkout '+total+': '+route.join(', ')+'</title><circle cx="200" cy="200" r="198" fill="#09150f"/>';
    order.forEach((n,i)=>{const start=(i-.5)*step,end=(i+.5)*step;[[16,90,"S"],[90,100,"T"],[100,145,"S"],[145,156,"D"]].forEach(([a,b,type])=>{const selected=route.includes(type==="S"?String(n):type+n);svg+=`<path d="${arcPath(a,b,start,end)}" fill="${selected?'#ffd740':type==='S'?(i%2?'#d8d8c5':'#26372c'):(i%2?'#27714a':'#9b353f')}" stroke="#6b8675" stroke-width=".7"/>`;});const p=point(177,i*step);svg+=`<text x="${p[0]}" y="${p[1]+5}" text-anchor="middle" fill="#e5f2e9" font-size="16" font-family="system-ui">${n}</text>`;});
    svg+=`<circle cx="200" cy="200" r="16" fill="${route.includes('25')?'#ffd740':'#27714a'}" stroke="#96b39f"/><circle cx="200" cy="200" r="7" fill="${route.includes('Bull')?'#ffd740':'#9b353f'}" stroke="#96b39f"/>`;
    const seen={};route.forEach((segment,i)=>{const repeated=seen[segment]||0;seen[segment]=repeated+1;const n=Number(segment.replace(/^[TD]/,"")),r=segment==='Bull'?0:segment==='25'?12:segment[0]==='T'?95:segment[0]==='D'?150:122,a=order.indexOf(n)*step;const p=segment==='Bull'?[200,200]:segment==='25'?[200,188]:point(r,a);const dx=26+repeated*23,dy=-27-repeated*10;svg+=`<g><path d="M${p[0]},${p[1]} l${dx},${dy}" stroke="#f9faf4" stroke-width="3"/><circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#101b13"/><circle cx="${p[0]+dx}" cy="${p[1]+dy}" r="10" fill="#d9f9e4" stroke="#102a1c"/><text x="${p[0]+dx}" y="${p[1]+dy+4}" font-family="system-ui" font-size="11" font-weight="800" text-anchor="middle" fill="#102a1c">${i+1}</text></g>`;});return svg+'</svg>';
  }
  return {routes,totals,completed,unlocked,record,attempts,value,board};
});
