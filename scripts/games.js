console.log("[GAMES DEBUG] games.js loaded");
console.log("[GAMES DEBUG] ONMSession:", !!window.ONMSession);
console.log("[GAMES DEBUG] ONMLiveDarts:", !!window.ONMLiveDarts);

async function initGamesPageLeagueStats() {
  const rankEl = document.getElementById("molGameRank");
  const ratingEl = document.getElementById("molGameRating");
  const playersEl = document.getElementById("molGamePlayers");

  const rankPill = document.getElementById("molGameRankPill");
  const ratingPill = document.getElementById("molGameRatingPill");

  if (!playersEl) return;

  rankPill?.classList.add("hidden");
  ratingPill?.classList.add("hidden");

  if (!window.ONMLiveDarts) {
    playersEl.textContent = "-";
    return;
  }

  try {
    const { db, ref, get } = window.ONMLiveDarts;
    const snapshot = await get(ref(db, "ratings"));

    if (!snapshot.exists()) {
      playersEl.textContent = "0";
      return;
    }

    const players = Object.values(snapshot.val())
      .map(player => ({
        playerKey: player.playerKey || "",
        rating: Number(player.rating || 1000),
        gamesPlayed: Number(player.gamesPlayed || 0)
      }))
      .filter(player => Number(player.gamesPlayed || 0) > 0)
      .sort((a, b) => b.rating - a.rating);

    playersEl.textContent = players.length;

    const user = window.ONMSession?.getUser?.();

    if (!user) return;

    const myKey =
      user.linkedPlayerKey ||
      user.playerKey ||
      user.userId ||
      "";

    if (!myKey) return;

    const myIndex = players.findIndex(player => player.playerKey === myKey);
    const me = myIndex >= 0 ? players[myIndex] : null;

    if (!me || Number(me.gamesPlayed || 0) < 1) return;

    if (rankEl) rankEl.textContent = myIndex + 1;
    if (ratingEl) ratingEl.textContent = me.rating;

    rankPill?.classList.remove("hidden");
    ratingPill?.classList.remove("hidden");

  } catch (err) {
    console.warn("Could not load games page league stats:", err);
    playersEl.textContent = "-";
  }
}

async function initGamesPage() {
  if (window.ONMSession?.init) {
    await window.ONMSession.init();
  }

  initGamesPageLeagueStats();
}

if (window.ONMLiveDarts) {
  initGamesPage();
} else {
  window.addEventListener("onmLiveDartsReady", initGamesPage, { once: true });
}