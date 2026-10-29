"use strict";
const validWins = new Set(Array.from({ length: 20 }, (_, i) => [1, 3, 5, 7, 9].map(mode => `${i + 1}-${mode}`)).flat());
const regionNames = new Intl.DisplayNames(["en"],{type:"region"});
const countryCodes = new Map();
for(let a=65;a<=90;a++) for(let b=65;b<=90;b++) {
  const code=String.fromCharCode(a,b), name=regionNames.of(code);
  if(name!==code) {countryCodes.set(name.toLowerCase(),code);countryCodes.set(code.toLowerCase(),code);}
}
function publicIdentity(user,profile) {
  const result={}, photo=profile?.photoUrl || user.photoUrl, nationality=profile?.nationality || user.nationality;
  if(typeof photo==="string" && (/^https:\/\//i.test(photo) || /^(?:\/?)(?:graphics|images)\/[\w/.-]+$/.test(photo))) result.photoUrl=photo.slice(0,1500);
  if(typeof nationality==="string" && nationality.trim()) {
    result.nationality=nationality.trim().slice(0,80);
    const name=result.nationality.toLowerCase();
    const home={england:"🏴\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}",scotland:"🏴\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}",wales:"🏴\u{e0067}\u{e0062}\u{e0077}\u{e006c}\u{e0073}\u{e007f}"};
    const aliases={english:"england",scottish:"scotland",welsh:"wales",british:"united kingdom",irish:"ireland",australian:"australia",polish:"poland","czech republic":"czechia",usa:"united states"};
    const country=aliases[name]||name, code=country==="united kingdom"||country==="uk" ? "GB" : countryCodes.get(country);
    result.flag=home[country] || (code ? [...code].map(c=>String.fromCodePoint(127397+c.charCodeAt(0))).join("") : "🌍");
  }
  return result;
}
function displayName(user,profile) {
  if (typeof profile?.publicName === "string" && profile.publicName.trim()) return profile.publicName.trim().slice(0,80);
  return typeof user.firstName === "string" && user.firstName.trim() ? user.firstName.trim().slice(0,80) : "Player";
}
function buildCompletions(users, profiles) {
  const groups = new Map([...validWins].map(key => [key, new Map()]));
  for (let level = 1; level <= 20; level++) groups.set(`level-${level}`, new Map());
  for (const user of users) {
    const profile = profiles.get(user.linkedPlayerKey);
    const name = displayName(user,profile);
    const identity = profile ? `player:${user.linkedPlayerKey}` : `account:${user.id}`;
    for (const win of new Set(Array.isArray(user.monsterBotWins) ? user.monsterBotWins : [])) {
      if (validWins.has(win)) {
        const mode = Number(win.split("-")[1]), needed = mode === 9 ? 1 : (mode + 1) / 2;
        const score = user.monsterBotBestScores?.[win];
        const valid = score?.won === needed && Number.isInteger(score.lost) && score.lost >= 0 && score.lost < needed;
        for (const groupKey of [win, `level-${win.split("-")[0]}`]) {
          const row = groups.get(groupKey).get(identity) || { name, ...publicIdentity(user,profile), results: [] };
          const previous = row.results.find(r => r.mode === mode);
          const result = { mode, won: valid ? score.won : null, lost: valid ? score.lost : null, flawless: valid && score.lost === 0 };
          if (!previous) row.results.push(result);
          else if (valid && (previous.lost === null || result.lost < previous.lost)) Object.assign(previous, result);
          row.results.sort((a,b) => a.mode - b.mode);
          groups.get(groupKey).set(identity, row);
        }
      }
    }
  }
  return Object.fromEntries([...groups].map(([key, names]) => [key, [...names.values()].sort((a, b) => a.name.localeCompare(b.name))]));
}
function buildLeaderboard(users, profiles) {
  const players = new Map(), modes = [1,3,5,7,9];
  for (const user of users) {
    const wins = (Array.isArray(user.monsterBotWins) ? user.monsterBotWins : []).filter(k => validWins.has(k));
    if (!user.monsterBotStarted && !wins.length) continue;
    const profile = profiles.get(user.linkedPlayerKey);
    const identity = profile ? `player:${user.linkedPlayerKey}` : `account:${user.id}`;
    const name = displayName(user,profile);
    const row = players.get(identity) || { name, ...publicIdentity(user,profile), wins:new Set(), scores:{} };
    row.survivalBest=Math.max(row.survivalBest||0,user.monsterSurvivalCompleted===true?10:Number.isInteger(user.monsterSurvivalBest)?Math.max(0,Math.min(10,user.monsterSurvivalBest)):0);
    for (const key of wins) {
      row.wins.add(key);
      const mode = Number(key.split("-")[1]), needed = mode === 9 ? 1 : (mode+1)/2, score = user.monsterBotBestScores?.[key];
      if (score?.won === needed && Number.isInteger(score.lost) && score.lost >= 0 && score.lost < needed && (!row.scores[key] || score.lost < row.scores[key].lost)) row.scores[key] = {won:score.won,lost:score.lost};
    }
    players.set(identity,row);
  }
  return [...players.values()].map(row => {
    const flawless = Object.values(row.scores).filter(score => score.lost === 0).length;
    const mastered=level=>modes.every(mode=>row.wins.has(`${level}-${mode}`)&&row.scores[`${level}-${mode}`]?.lost===0);
    const trophies=Array.from({length:20},(_,i)=>i+1).filter(mastered).length;
    const tierStars=tier=>Object.entries(row.scores).filter(([key,score])=>(Number(key.split("-")[0])>10?2:1)===tier&&score.lost===0).length;
    function highest(tier){
      const offset=tier===2?10:0,won=(level,formats)=>formats.every(mode=>row.wins.has(`${offset+level}-${mode}`));let level=1;
      for(let next=2;next<=10;next++){
        if(modes.filter(mode=>row.wins.has(`${offset+next-1}-${mode}`)).length<2||next>=3&&!won(next-2,[1,3,5,7])||next>=4&&!won(next-3,modes)||next>=5&&!mastered(offset+next-4)||next>=3&&tierStars(tier)<5+(next-3)*4)break;
        level=next;
      }
      return offset+level;
    }
    const entry=tierStars(1)>=20&&Array.from({length:10},(_,i)=>i+1).filter(mastered).length>=3;
    const level=entry?highest(2):highest(1);
    const unlocked=highest(1)+(entry?highest(2)-10:0);
    return {name:row.name,level,unlocked,completed:row.wins.size,flawless,trophies,...(row.photoUrl?{photoUrl:row.photoUrl}:{}),...(row.nationality?{nationality:row.nationality,flag:row.flag}:{})};
  }).sort((a,b) => b.completed-a.completed || b.level-a.level || a.name.localeCompare(b.name));
}
function buildSurvivalLeaderboard(users,profiles,tier=1){
  const field=name=>`monsterSurvival${tier===2?"Tier2":""}${name}`;
  const players=new Map();
  for(const user of users){
    const best=user[field("Completed")]===true?10:Number.isInteger(user[field("Best")])?Math.max(0,Math.min(10,user[field("Best")])):0;
    if(!user[field("Attempted")]&&!best)continue;
    const profile=profiles.get(user.linkedPlayerKey),identity=profile?`player:${user.linkedPlayerKey}`:`account:${user.id}`;
    const previous=players.get(identity);
    if(!previous||best>previous.best)players.set(identity,{name:displayName(user,profile),...publicIdentity(user,profile),best,complete:best===10});
  }
  return [...players.values()].sort((a,b)=>b.best-a.best||a.name.localeCompare(b.name));
}
function buildTonOutsLeaderboard(users,profiles){
  const valid=Array.from({length:71},(_,i)=>100+i).filter(n=>![159,162,163,165,166,168,169].includes(n)),players=new Map();
  for(const user of users){let completed=0;for(const n of valid){if(user.tonOutsProgress?.[String(n)]?.hit!==true)break;completed++;}if(!completed)continue;
    const profile=profiles.get(user.linkedPlayerKey),id=profile?`player:${user.linkedPlayerKey}`:`account:${user.id}`,previous=players.get(id);
    if(!previous||completed>previous.completed)players.set(id,{name:displayName(user,profile),...publicIdentity(user,profile),completed});
  }
  return [...players.values()].sort((a,b)=>b.completed-a.completed||a.name.localeCompare(b.name));
}
function buildTonOutsCompletions(users,profiles){
  const valid=Array.from({length:71},(_,i)=>100+i).filter(n=>![159,162,163,165,166,168,169].includes(n)),result={};
  for(const total of valid){const people=new Map();for(const user of users){if(!valid.slice(0,valid.indexOf(total)+1).every(n=>user.tonOutsProgress?.[String(n)]?.hit===true))continue;
    const profile=profiles.get(user.linkedPlayerKey),id=profile?`player:${user.linkedPlayerKey}`:`account:${user.id}`;
    if(!people.has(id))people.set(id,{name:displayName(user,profile),...publicIdentity(user,profile)});
  }result[total]=[...people.values()].sort((a,b)=>a.name.localeCompare(b.name));}return result;
}
module.exports = { buildCompletions, buildLeaderboard, buildSurvivalLeaderboard, buildTonOutsLeaderboard, buildTonOutsCompletions };
