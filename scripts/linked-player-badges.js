(function () {
  const grid = document.getElementById("playersGrid") || document.querySelector(".players-grid");
  if (!grid || !window.ONMFirebase) return;
  let keys = new Set(), revision = 0;
  function update() {
    grid.querySelectorAll("[data-linked-player-key]").forEach(card => {
      const heading = card.querySelector(".player-card-name");
      const existing = heading?.querySelector(".profileLinkedBadge");
      const linked = keys.has(card.dataset.linkedPlayerKey);
      if (!linked) { existing?.remove(); return; }
      if (existing || !heading) return;
      const badge = document.createElement("span");
      badge.className = "registrationBadge profileLinkedBadge";
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", "Account linked");
      badge.dataset.tooltip = "Account linked";
      badge.tabIndex = 0;
      badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>';
      const nickname = heading.querySelector(".player-card-nickname");
      heading.insertBefore(badge, nickname);
    });
  }
  new MutationObserver(update).observe(grid, { childList: true, subtree: true });
  window.ONMFirebase.ready.then(({ auth, authSdk, db, firestoreSdk: sdk }) => {
    let stop = () => {};
    authSdk.onAuthStateChanged(auth, async user => {
      const current = ++revision;
      stop(); keys = new Set(); update();
      if (!user) return;
      const account = await window.ONMFirebase.loadOwnUser().catch(() => null);
      if (current !== revision || account?.status !== "Active") return;
      if (account.linkedPlayerKey) keys.add(account.linkedPlayerKey);
      update();
      stop = sdk.onSnapshot(sdk.collection(db, "linkedPlayers"), snapshot => {
        if (current !== revision) return;
        keys = new Set(snapshot.docs.map(doc => doc.data().linkedPlayerKey || doc.data().playerKey).filter(Boolean));
        if (account.linkedPlayerKey) keys.add(account.linkedPlayerKey);
        update();
      }, () => { if (current === revision) { keys = new Set([account.linkedPlayerKey].filter(Boolean)); update(); } });
    });
  }).catch(() => { keys = new Set(); update(); });
})();
