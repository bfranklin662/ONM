import { bracketSize, structures, tournamentView } from "./tournament-engine.mjs";
import { canManage, scorerUrl, tournamentError, tournamentStore, tournamentUrl } from "./tournament-store.mjs";

const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");
const form = $("tournamentForm");
const fields = form.elements;
const content = $("tournamentContent");
const seedInputs = new Map();
const statusLabels = { open: "Open for entries", live: "In progress", complete: "Past tournaments" };
const explanations = {
  knockout: "Every loss eliminates a player.",
  groups: "Play everyone in your group and compete for the top spot.",
  combined: "Play everyone in your group, then qualify for the knockout rounds."
};

let store;
let user;
let current;
let lobby = [];
let loaded = false;
let busy = false;

function escape(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function message(value) {
  $("tournamentMessage").textContent = value;
}

function toggleField(id, visible) {
  const field = $(id);
  field.hidden = !visible;
  const input = field.querySelector("input, select");
  if (input) input.disabled = !visible;
}

function updateFields() {
  const structure = fields.structure.value;
  const knockout = structure === "knockout";
  const combined = structure === "combined";
  toggleField("bracketField", knockout);
  toggleField("capacityField", !knockout);
  toggleField("groupField", !knockout);
  toggleField("qualifierField", combined);
  toggleField("customField", fields.startScore.value === "custom");
  fields.legsCount.step = fields.gameType.value === "bestOf" ? "2" : "1";
  fields.customScore.min = fields.inMode.value === "double" ? "4" : "2";
  fields.qualifiers.max = fields.capacity.value;
  $("structureHint").textContent = explanations[structure];
  const qualifiers = Number(fields.qualifiers.value);
  const size = bracketSize(qualifiers);
  $("bracketHint").hidden = !combined || qualifiers < 4 || qualifiers > Number(fields.capacity.value);
  $("bracketHint").textContent = size ? `${size}-player knockout grid · ${size - qualifiers} opening byes` : "";
}

function settingsLabel(settings) {
  const format = settings.gameType === "bestOf" ? "Best of" : "First to";
  const opening = settings.inMode === "double" ? "Double in" : "Straight in";
  return `${structures[settings.structure]} · ${Number(settings.startScore)} · ${format} ${Number(settings.legsCount)} · ${opening}`;
}

function renderLobby() {
  content.innerHTML = Object.entries(statusLabels).map(([status, label]) => {
    const tournaments = lobby.filter(item => item.status === status);
    return `<section class="tournamentPanel"><h2>${label}</h2>
      <div class="tournamentList">${tournaments.map(tournament => `
        <a href="${tournamentUrl(tournament.id)}">
          <strong>${escape(tournament.title)}</strong>
          <span>${settingsLabel(tournament.settings)} · ${Object.keys(tournament.entries).length}/${Number(tournament.settings.capacity)} players</span>
        </a>`).join("") || "<p>None yet.</p>"}</div>
    </section>`;
  }).join("");
}

function renderRoster(tournament) {
  const entries = Object.entries(tournament.entries).sort(([, a], [, b]) => a.localeCompare(b));
  const manage = canManage(user);
  const joined = user && Object.hasOwn(tournament.entries, user.uid);
  const seed = manage && tournament.settings.drawMode === "ability";
  const full = entries.length >= tournament.settings.capacity;
  const active = user?.status === "Active";
  const login = `auth.html?redirect=${encodeURIComponent(tournamentUrl(id))}`;
  const action = active
    ? `<button class="btn ${joined ? "btnGhost" : "btnPrimary"}" data-action="${joined ? "leave" : "join"}"
        ${busy || (full && !joined) ? "disabled" : ""}>${joined ? "Leave tournament" : full ? "Tournament full" : "Join tournament"}</button>`
    : `<a class="btn btnPrimary" href="${login}">Sign in to join</a>`;
  const combined = tournament.settings.structure === "combined";
  const minimum = combined ? tournament.settings.qualifiers : 4;
  return `<section class="tournamentPanel">
    <h2>Entries · ${entries.length}/${tournament.settings.capacity}</h2>
    <p>${settingsLabel(tournament.settings)}</p>
    ${combined ? `<p>${minimum} qualify for a ${bracketSize(minimum)}-player knockout grid.</p>` : ""}
    ${action}
    ${seed ? `<p class="tournamentHint">Assign ability seeds before starting. Seed 1 is strongest.
      ${tournament.settings.structure === "knockout" ? "Top seeds are spread through the bracket." : "Players of similar ability are grouped together."}
      Equal seeds are drawn randomly.</p>` : ""}
    <form id="tournamentDrawForm">
      <ul class="tournamentRoster">${entries.map(([uid, name]) => `<li>${seed
        ? `<label>${escape(name)}<input name="${escape(uid)}" type="number" min="1" max="128" required
            value="${escape(seedInputs.get(uid) || "")}"></label>`
        : escape(name)}</li>`).join("")}</ul>
      ${manage ? `<p class="tournamentHint">Starting closes entries and publishes the draw. At least ${minimum} players are needed.</p>
        <button class="btn btnPrimary" type="submit" ${busy || entries.length < minimum ? "disabled" : ""}>Start tournament</button>` : ""}
    </form>
  </section>`;
}

function table(label, headers, rows) {
  return `<div class="tournamentTableWrap" tabindex="0" role="region" aria-label="${label}">
    <table><thead><tr>${headers.map(heading => `<th scope="col">${heading}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(([name, ...values]) => `<tr><th scope="row">${name}</th>${values.map(value => `<td>${escape(value)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
}

function average(points, darts) {
  return darts ? (3 * points / darts).toFixed(2) : "—";
}

function statValues(stats) {
  return [
    average(stats.totalScored, stats.dartsThrown), average(stats.firstNineScored, stats.firstNineDarts),
    `${stats.checkoutHits}/${stats.checkoutAttempts}`, stats.highestOut || "—", stats.oneEightys, stats.bullOuts
  ];
}

const statHeaders = ["3-dart avg.", "First 9 avg.", "Checkouts", "Highest out", "180s", "Bull-outs"];

function renderDraw(tournament) {
  const view = tournamentView(tournament);
  const qualified = new Set(view.qualified);
  const name = uid => escape(tournament.entries[uid]);
  const slot = uid => uid === undefined ? "TBD" : uid === null ? "Bye" : name(uid);
  const manage = canManage(user);
  function matchCard(match, showStats = false) {
    const { a, b, result, bye, winner, ready } = match;
    if (bye && !winner) return `<div class="tournamentMatch"><small>Empty pairing</small></div>`;
    return `<div class="tournamentMatch">
      <span class="${(result?.winnerIndex === 0 || (bye && winner === a)) ? "tournamentWinner" : ""}">${slot(a)} <b>${escape(result?.left.legs ?? "")}</b></span>
      <span class="${(result?.winnerIndex === 1 || (bye && winner === b)) ? "tournamentWinner" : ""}">${slot(b)} <b>${escape(result?.right.legs ?? "")}</b></span>
      ${ready && !result && manage ? `<a class="btn btnPrimary" href="${scorerUrl(id, match.id)}">Score match</a>` : ""}
      ${bye ? "<small>Advances by bye</small>" : ""}
      ${result && showStats ? `<details data-section="${match.id}"><summary>Match stats</summary>
        ${table("Match statistics", ["Player", ...statHeaders], [[name(a), ...statValues(result.left)], [name(b), ...statValues(result.right)]])}
      </details>` : ""}
    </div>`;
  }

  return `
    ${view.complete ? `<section class="tournamentPanel"><h2 class="tournamentWinner">${view.winners.length === 1 ? "Winner" : "Group winners"}</h2>
      <p>${view.winners.map(name).join(" · ")}</p></section>` : ""}
    ${view.groups.length ? `<section class="tournamentPanel"><h2>Group stage</h2>
      <p class="tournamentHint">Standings use wins, leg difference, legs won, then draw order.
      ${view.rounds.length ? "Knockout places go by group position, then win rate, leg difference per match, legs won per match and draw order." : ""}</p>
      ${view.groups.map(group => `<div class="tournamentGroup">
        <h3>Group ${escape(group.name)}</h3>
        ${table(`Group ${escape(group.name)} standings`, ["Player", "P", "W", "L", "Leg diff."],
          group.rows.map(row => [name(row.id) + (qualified.has(row.id) ? ' <span class="tournamentWinner">· Qualified</span>' : ""),
            row.played, row.wins, row.played - row.wins, row.legsFor - row.legsAgainst]))}
        <details data-section="group-${escape(group.name)}">
          <summary>Matches · ${group.matches.filter(match => match.result).length}/${group.matches.length} played</summary>
          <div class="tournamentMatches">${group.matches.map(match => matchCard(match, true)).join("")}</div>
        </details>
      </div>`).join("")}</section>` : ""}
    ${view.rounds.length ? `<section class="tournamentPanel">
      <h2>Knockout bracket</h2>
      <p class="tournamentHint">${view.groups.length && !view.qualified.length ? "The bracket fills when the group stage finishes." : "Scroll across to see all rounds."}</p>
      <div class="tournamentBracket" tabindex="0" role="region" aria-label="Knockout rounds">${view.rounds.map(matches => `<div class="tournamentRound">
        <h3>${({ 1: "Final", 2: "Semi-finals", 4: "Quarter-finals" })[matches.length] || `Round of ${matches.length * 2}`}</h3>
        ${matches.map(match => matchCard(match, true)).join("")}
      </div>`).join("")}</div>
    </section>` : ""}
    <section class="tournamentPanel"><h2>Player statistics</h2>
      ${table("Tournament statistics", ["Player", "P", "W", ...statHeaders],
        [...view.players].sort((a, b) => tournament.entries[a.id].localeCompare(tournament.entries[b.id]))
          .map(row => [name(row.id), row.played, row.wins, ...statValues(row)]))}
    </section>`;
}

function render() {
  $("tournamentSetup").hidden = Boolean(id) || !canManage(user);
  if (!loaded) return;
  if (!id) {
    renderLobby();
    return;
  }
  if (!current) {
    content.replaceChildren();
    message("Tournament not found.");
    return;
  }
  const expanded = new Set([...content.querySelectorAll("details[open]")].map(detail => detail.dataset.section));
  const scrollLeft = content.querySelector(".tournamentBracket")?.scrollLeft;
  document.title = `Oche Ness Monsters | ${current.title}`;
  $("tournamentTitle").textContent = current.title;
  $("tournamentIntro").textContent = `${current.status === "complete" ? "Completed" : statusLabels[current.status]} · ${settingsLabel(current.settings)}`;
  content.innerHTML = current.status === "open" ? renderRoster(current) : renderDraw(current);
  content.querySelectorAll("details[data-section]").forEach(detail => { detail.open = expanded.has(detail.dataset.section); });
  if (scrollLeft) content.querySelector(".tournamentBracket").scrollLeft = scrollLeft;
}

async function action(button, work) {
  if (busy) return;
  busy = true;
  if (button) button.disabled = true;
  message("");
  try {
    await work();
  } catch (error) {
    message(tournamentError(error));
    $("tournamentMessage").scrollIntoView({ block: "nearest" });
  } finally {
    busy = false;
    if (button) button.disabled = false;
    if (id) render();
  }
}

form.addEventListener("input", updateFields);
form.addEventListener("submit", event => {
  event.preventDefault();
  if (!canManage(user)) return;
  const structure = fields.structure.value;
  const settings = {
    structure,
    capacity: Number(structure === "knockout" ? fields.bracket.value : fields.capacity.value),
    groupSize: structure === "knockout" ? null : Number(fields.groupSize.value),
    qualifiers: structure === "combined" ? Number(fields.qualifiers.value) : null,
    gameType: fields.gameType.value,
    legsCount: Number(fields.legsCount.value),
    startScore: Number(fields.startScore.value === "custom" ? fields.customScore.value : fields.startScore.value),
    inMode: fields.inMode.value,
    drawMode: fields.drawMode.value
  };
  action(event.submitter, async () => {
    location.href = tournamentUrl(await store.create(fields.title.value.trim(), settings, user));
  });
});

content.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button || user?.status !== "Active") return;
  action(button, () => store.joinOrLeave(id, user, button.dataset.action === "join"));
});

content.addEventListener("input", event => {
  if (event.target.form?.id === "tournamentDrawForm") seedInputs.set(event.target.name, event.target.value);
});

content.addEventListener("submit", event => {
  if (event.target.id !== "tournamentDrawForm") return;
  event.preventDefault();
  if (!canManage(user)) return;
  const seeds = Object.fromEntries([...new FormData(event.target)].map(([uid, seed]) => [uid, Number(seed)]));
  if (!window.confirm("Start the tournament and close entries?")) return;
  action(event.submitter, () => store.start(id, seeds));
});

async function initialise() {
  updateFields();
  store = await tournamentStore();
  const { auth, authSdk } = await window.ONMFirebase.authReady;
  authSdk.onAuthStateChanged(auth, async account => {
    try {
      const profile = account ? await window.ONMFirebase.loadOwnUser() : null;
      if ((account?.uid ?? null) !== (auth.currentUser?.uid ?? null)) return;
      user = profile;
      render();
    } catch (error) {
      message(tournamentError(error));
    }
  });
  const onError = error => message(tournamentError(error));
  if (id) {
    $("tournamentBack").href = tournamentUrl();
    $("tournamentBack").textContent = "← Tournament lobby";
    store.watchTournament(id, tournament => {
      current = tournament;
      if (!loaded) message("");
      loaded = true;
      render();
    }, onError);
  } else {
    store.watchLobby(tournaments => {
      lobby = tournaments;
      if (!loaded) message("");
      loaded = true;
      render();
    }, onError);
  }
}

initialise().catch(error => message(tournamentError(error)));
