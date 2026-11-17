import { countdownLabel, tournamentStartTime } from "./tournament-engine.mjs";
import { canManage, scorerUrl, tournamentStore, tournamentUrl } from "./tournament-store.mjs";

const notificationAge = 24 * 60 * 60 * 1000;

export function pendingStarts(tournaments, uid, seen, now = Date.now()) {
  return tournaments.filter(({ tournament, testMode }) => {
    const started = tournament.startedAt?.toMillis?.();
    return tournament.status === "live" && started && now - started <= notificationAge &&
      Object.hasOwn(tournament.entries, uid) && !seen(`${testMode ? "test" : "public"}:${tournament.id}:${started}`);
  });
}

export async function watchTournamentStarts(firebase) {
  const { auth, authSdk } = await firebase.authReady;
  let stops = [];
  let generation = 0;
  let dialog;
  let timer;
  let uid;
  const lists = new Map();
  const seenHere = new Set();

  const key = ({ tournament, testMode }) =>
    `${testMode ? "test" : "public"}:${tournament.id}:${tournament.startedAt.toMillis()}`;
  const storageKey = event => `onmTournamentStart:${uid}:${event}`;

  function wasSeen(event) {
    const id = storageKey(event);
    try { return seenHere.has(id) || localStorage.getItem(id) === "1"; }
    catch { return seenHere.has(id); }
  }

  function markSeen(event) {
    const id = storageKey(event);
    seenHere.add(id);
    try { localStorage.setItem(id, "1"); } catch {}
  }

  function matchNotification(items) {
    for (const { tournament, testMode } of items) {
      for (const [matchId, session] of Object.entries(tournament.matchSessions ?? {})) {
        if (!session.players.includes(uid)) continue;
        const inviting = session.mode === "shared" && session.status === "invited" && session.owner !== uid;
        const accepted = session.mode === "shared" && session.status === "playing" && session.owner === uid;
        const marked = session.mode === "chalk" && session.owner !== uid;
        if (!inviting && !accepted && !marked) continue;
        const event = `match:${session.id}:${session.status}`;
        if (wasSeen(event)) continue;
        const opponent = tournament.entries[session.players.find(player => player !== uid)];
        return { tournament, testMode, event,
          title: inviting ? "Tournament match invite" : accepted ? "Match accepted" : "Your match is being scored",
          instructions: inviting ? `${opponent} is ready. Accept to score on your own phone.`
            : accepted ? `${opponent} accepted. Open the match to decide who throws first.`
            : `Your match against ${opponent} is being scored on another phone.`,
          href: inviting || accepted ? scorerUrl(tournament.id, matchId, testMode, "shared")
            : tournamentUrl(tournament.id, testMode, "fixtures"),
          label: inviting ? "Accept match" : accepted ? "Open match" : "Open Matches"
        };
      }
    }
    return null;
  }

  function nextNotification() {
    if (dialog?.open || !uid || document.hidden) return;
    if (new URLSearchParams(location.search).get("mode") === "tournament") return;
    const items = [...lists.values()].flat();
    const candidate = matchNotification(items) ?? pendingStarts(items, uid, wasSeen)[0];
    if (!candidate) return;
    if (document.querySelector("dialog[open], .modalOverlay:not(.hidden)")) {
      clearTimeout(timer);
      timer = setTimeout(nextNotification, 1000);
      return;
    }
    if (!document.querySelector('link[href*="styles/tournament.css"]')) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = new URL("../styles/tournament.css?v=20261117-tournament-polish", import.meta.url);
      style.addEventListener("load", nextNotification, { once: true });
      style.addEventListener("error", nextNotification, { once: true });
      document.head.append(style);
      return;
    }
    const { tournament, testMode } = candidate;
    dialog = document.createElement("dialog");
    dialog.className = "tournamentDialog tournamentNoticeDialog tournamentStartDialog";
    dialog.setAttribute("aria-labelledby", "tournamentStartTitle");
    dialog.innerHTML = `<div class="tournamentDialogHeader"><p class="tournamentKicker">🎯 Tournament</p>
      <form method="dialog"><button type="submit" class="tournamentDialogClose" aria-label="Close">✕</button></form></div>
      <h2 id="tournamentStartTitle"></h2>
      <p class="tournamentNoticeName"></p>
      <p class="tournamentNoticeInstructions"></p>
      <div class="tournamentNoticeActions">
        <a class="tournamentEntryButton tournamentEntryView" autofocus>Open Matches <span aria-hidden="true">→</span></a>
      </div>`;
    const activeDialog = dialog;
    dialog.querySelector(".tournamentNoticeName").textContent = tournament.title;
    const link = dialog.querySelector("a");
    link.href = new URL(`../${candidate.href ?? tournamentUrl(tournament.id, testMode, "fixtures")}`, import.meta.url);
    if (candidate.label) link.firstChild.textContent = candidate.label + " ";
    const title = dialog.querySelector("h2");
    const instructions = dialog.querySelector(".tournamentNoticeInstructions");
    const online = tournament.settings.playMode === "online";
    const startAt = tournamentStartTime(tournament);
    function tick() {
      const remaining = startAt - Date.now();
      title.textContent = candidate.title ?? (remaining > 0 ? `Starts in ${countdownLabel(remaining)}` : "Your tournament has started");
      instructions.textContent = candidate.instructions ?? (online
        ? "Open Matches to find your opponent and see when your fixture is ready."
        : "Open Matches and wait for You’re up. Then go to the board shown and choose how to score.");
      if (!candidate.event && remaining > 0) timer = setTimeout(tick, Math.min(1000, remaining));
    }
    dialog.addEventListener("close", () => {
      clearTimeout(timer);
      activeDialog.remove();
      dialog = null;
      nextNotification();
    }, { once: true });
    document.body.append(dialog);
    markSeen(candidate.event ?? key(candidate));
    tick();
    dialog.showModal();
  }

  document.addEventListener("visibilitychange", nextNotification);
  authSdk.onAuthStateChanged(auth, async account => {
    const request = ++generation;
    stops.forEach(stop => stop());
    stops = [];
    lists.clear();
    uid = null;
    clearTimeout(timer);
    if (dialog?.open) dialog.close();
    if (!account) return;
    try {
      const user = await firebase.loadOwnUser();
      if (request !== generation || user?.status !== "Active" || user.uid !== account.uid) return;
      const modes = canManage(user) ? [false, true] : [false];
      const stores = await Promise.all(modes.map(tournamentStore));
      if (request !== generation) return;
      uid = user.uid;
      stops = stores.map((store, index) => {
        const testMode = modes[index];
        return store.watchLive(items => {
          if (request !== generation) return;
          lists.set(testMode, items.map(tournament => ({ tournament, testMode })));
          nextNotification();
        }, () => {});
      });
    } catch {
      // Notification failures should leave the rest of the app usable.
    }
  });
}
