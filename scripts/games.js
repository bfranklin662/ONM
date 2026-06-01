console.log("[GAMES DEBUG] games.js loaded");
console.log("[GAMES DEBUG] ONMSession:", !!window.ONMSession);
console.log("[GAMES DEBUG] ONMLiveDarts:", !!window.ONMLiveDarts);

async function initGamesPageLeagueStats() {
  const rankEl = document.getElementById("molGameRank");
  const ratingEl = document.getElementById("molGameRating");
  const playersEl = document.getElementById("molGamePlayers");

  if (!rankEl || !ratingEl) return;

  const user = window.ONMSession?.getUser?.();

  if (!user || !window.ONMLiveDarts) {
    rankEl.textContent = "-";
    ratingEl.textContent = "-";
    return;
  }

  const myKey =
    user.linkedPlayerKey ||
    user.playerKey ||
    user.userId ||
    "";

  if (!myKey) return;

  try {
    const { db, ref, get } = window.ONMLiveDarts;
    const snapshot = await get(ref(db, "ratings"));

    if (!snapshot.exists()) return;

    const players = Object.values(snapshot.val())
      .map(player => ({
        playerKey: player.playerKey || "",
        rating: Number(player.rating || 1000),
        gamesPlayed: Number(player.gamesPlayed || 0)
      }))
      .filter(player => player.gamesPlayed > 0)
      .sort((a, b) => b.rating - a.rating);

    if (playersEl) {
      playersEl.textContent = players.length;
    }

    const myIndex = players.findIndex(player => player.playerKey === myKey);
    const me = myIndex >= 0 ? players[myIndex] : null;

    rankEl.textContent = me ? myIndex + 1 : "-";
    ratingEl.textContent = me ? me.rating : "-";
  } catch (err) {
    console.warn("Could not load games page league stats:", err);
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