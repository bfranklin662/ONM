(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ONMNickAudio=api;})(typeof window!=="undefined"?window:globalThis,function(){
  const announcements=["301.mp3","501.mp3","701.mp3","901.mp3","bo1.mp3","bo3.mp3","bo5.mp3","bo7.mp3","bo9.mp3","bull-out.mp3","game-on.mp3","game-shot.mp3","match-shot.mp3","you-require.mp3","you-throw.mp3","oppo-throw.mp3"];
  const isNick=(file,credit)=>announcements.includes(file)||Boolean(credit?.startsWith("Nick "));
  const source=(file,credit)=>isNick(file,credit)?`audio/darts/nick-boosted/${file.replace(/\.mp3$/,".m4a")}?v=20261025-all-nick-v2`:`audio/darts/${file}`;
  return{announcements,isNick,source};
});
