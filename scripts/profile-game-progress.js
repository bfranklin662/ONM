(function () {
  function botProgress(data) {
    const wins = new Set((data.monsterBotWins || []).filter(key => /^(?:[1-9]|1\d|20)-(?:1|3|5|7|9)$/.test(key)));
    const flawless = new Set([...wins].filter(key => {
      const mode = Number(key.split("-")[1]), score = data.monsterBotBestScores?.[key];
      return score?.won === (mode === 9 ? 1 : (mode + 1) / 2) && score.lost === 0;
    }));
    let trophies = 0;
    for (let bot = 1; bot <= 20; bot++) if ([1,3,5,7,9].every(mode => flawless.has(`${bot}-${mode}`))) trophies++;
    return { challenges: wins.size, flawless: flawless.size, trophies };
  }
  function championAwards(tournaments, uids, viewTournament) {
    const eligible = new Set(uids);
    return tournaments.flatMap(tournament => {
      if (tournament.testMode || tournament.test || tournament.status !== "complete") return [];
      try {
        const view = viewTournament(tournament);
        if (!view?.complete || view.winners.length !== 1 || !eligible.has(view.winners[0])) return [];
        return [{ id: tournament.id, title: tournament.title || "Tournament", mode: tournament.settings.playMode === "online" ? "Online" : "In person" }];
      } catch (_) { return []; }
    });
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { botProgress, championAwards }; return; }
  const engineUrl = new URL("tournament-engine.mjs", document.currentScript.src).href;
  const section = document.getElementById("profileGameProgress");
  if (!section || !window.ONMFirebase) return;
  const escape = value => String(value || "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  let started = false, revision = 0, stopBot = () => {}, stopTournaments = () => {};
  let progress = null, awards = [];
  function render() {
    section.hidden = !progress && !awards.length;
    section.innerHTML = `${progress ? `<h3>Monster Bot</h3><div class="game-progress-stats"><span>Challenges <strong>${progress.challenges}/100</strong></span><span>Flawless <strong>${progress.flawless}</strong></span><span>Mastery trophies <strong>${progress.trophies}</strong></span><a href="monster-bot.html">Play Monster Bot ↗</a></div>` : ""}${awards.length ? `<h3${progress ? ' style="margin-top:16px"' : ""}>Tournament accolades</h3><div class="profile-tournament-awards">${awards.map(award=>`<a href="tournament.html?id=${encodeURIComponent(award.id)}" title="${escape(award.mode)} tournament winner">🏆 ${escape(award.title)} · ${escape(award.mode)} winner</a>`).join("")}</div>` : ""}`;
  }
  function start() {
    const player = window.ONMProfilePlayer;
    if (started || !player?.playerKey) return;
    started = true;
    window.ONMFirebase.ready.then(({auth,authSdk,db,firestoreSdk:sdk}) => {
      authSdk.onAuthStateChanged(auth, async user => {
        const current = ++revision;
        stopBot(); stopTournaments(); progress = null; awards = []; render();
        if (!user) return;
        const account = await window.ONMFirebase.loadOwnUser().catch(()=>null);
        if (current !== revision || account?.status !== "Active") return;
        if (account.linkedPlayerKey === player.playerKey) {
          stopBot = sdk.onSnapshot(sdk.doc(db,"users",user.uid), snapshot => {
            if (current !== revision) return;
            progress = botProgress(snapshot.data() || {}); render();
          }, () => { if (current === revision) { progress = null; render(); } });
        }
        try {
          const linked = await sdk.getDocs(sdk.collection(db,"linkedPlayers"));
          const uids = linked.docs.filter(doc => (doc.data().linkedPlayerKey || doc.data().playerKey) === player.playerKey).map(doc => doc.id);
          if (account.linkedPlayerKey === player.playerKey && !uids.includes(user.uid)) uids.push(user.uid);
          if (current !== revision || !uids.length) return;
          const {tournamentView} = await import(engineUrl);
          if (current !== revision) return;
          stopTournaments = sdk.onSnapshot(sdk.collection(db,"tournaments"), snapshot => {
            if (current !== revision) return;
            awards = championAwards(snapshot.docs.map(doc => ({...doc.data(), id:doc.id})),uids,tournamentView); render();
          }, () => { if (current === revision) { awards=[];render(); } });
        } catch (error) { console.warn("Tournament accolades unavailable",error.message); }
      });
    }).catch(()=>{});
  }
  document.addEventListener("onm-profile-ready",start);
  start();
})();
