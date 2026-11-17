import { bracketSize, countdownLabel, entryCapacity, fixtureSchedule, groupPoints, laterRoundLegs, matchSettings, maxBoards, maxDummyEntrants, playModes, simulateTournamentResults, structures, tournamentStartTime, tournamentView } from "./tournament-engine.mjs";
import { canDeleteTournament, canManage, editableLegFields, entryName, scorerUrl, tournamentActivityTimeout, tournamentError, tournamentStore, tournamentUrl } from "./tournament-store.mjs";

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const id = params.get("id");
const testMode = Boolean(id) && params.get("test") === "1";
const lobbyUrl = tournamentUrl();
const back = $("tournamentBack");
if (id) {
  back.href = lobbyUrl;
  back.setAttribute("aria-label", "Back to lobby");
  back.title = "Back to lobby";
}
const deleteButton = $("tournamentDelete");
const rulesButton = $("tournamentEditRules");
const infoButton = $("tournamentInfo");
const playerCount = $("tournamentPlayerCount");
const winnerPanel = $("tournamentWinners");
const form = $("tournamentForm");
const fields = form.elements;
const setupButton = $("tournamentSetupButton");
const accessMessage = $("tournamentAccessMessage");
const createLabel = "Create a tournament";
const content = $("tournamentContent");
const dialog = $("tournamentDialog");
const seedInputs = new Map();
const statusLabels = {
  open: "Open for entries",
  live: "In progress",
  complete: "Past tournaments",
  completedTests: "Completed tests"
};
const explanations = {
  knockout: "Every loss eliminates a player.",
  groups: "Play everyone in your group and compete for the top spot.",
  combined: "Play everyone in your group, then qualify for the knockout rounds."
};

let store;
let testStore;
let testLobby = [];
let user;
let current;
let lobby = [];
let loaded = false;
let busy = false;
let simulatedResults = null;
let selectedBracket = "main";

function escape(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function message(value) {
  $("tournamentMessage").textContent = value;
}

let settingsToastTimeout;
function showSettingsToast() {
  const toast = $("tournamentSettingsToast");
  clearTimeout(settingsToastTimeout);
  toast.textContent = "✓ Tournament settings updated";
  settingsToastTimeout = setTimeout(() => { toast.textContent = ""; }, 4000);
}

function setCreateForm(open, label = open ? "Hide tournament settings" : createLabel, status = "") {
  form.hidden = !open;
  setupButton.textContent = label;
  setupButton.setAttribute("aria-expanded", String(open));
  accessMessage.textContent = status;
}

function showCreateError(error) {
  const status = error.code === "permission-denied"
    ? "Firebase denied tournament creation access. If you are signed in as an owner or admin, check that the latest Tournament Firestore rules are deployed."
    : "Could not check tournament access with Firebase. Try again.";
  setCreateForm(false, "Retry tournament access", status);
}

setupButton.addEventListener("click", async () => {
  if (!canManage(user)) return;
  if (!form.hidden) {
    setCreateForm(false);
    return;
  }
  const account = user;
  setupButton.disabled = true;
  setCreateForm(false, "Checking tournament access…");
  try {
    await store.checkCreateAccess();
    if (user !== account) return;
    setCreateForm(true);
    fields.playMode.focus();
  } catch (error) {
    if (user === account) showCreateError(error);
  } finally {
    if (user === account) setupButton.disabled = false;
  }
});

function toggleField(id, visible) {
  const field = $(id);
  field.hidden = !visible;
  const input = field.querySelector("input, select");
  if (input) input.disabled = !visible;
}

function updateFields() {
  const playMode = fields.playMode.value;
  const settings = $("tournamentSettings");
  settings.hidden = settings.disabled = !Object.hasOwn(playModes, playMode);
  $("tournamentFormatHint").textContent = playMode === "inPerson"
    ? "Play at the same board. An administrator can score both players on one phone."
    : "Play remotely. Fixtures and results are listed in Matches.";
  const structure = fields.structure.value;
  const knockout = structure === "knockout";
  const combined = structure === "combined";
  const inPerson = playMode === "inPerson";
  const capacity = inPerson ? null : Number(knockout ? fields.bracket.value : fields.capacity.value);
  toggleField("bracketField", knockout && !inPerson);
  toggleField("capacityField", !knockout && !inPerson);
  toggleField("groupField", !knockout);
  toggleField("qualifierField", combined);
  toggleField("plateField", combined);
  toggleField("customField", fields.startScore.value === "custom");
  toggleField("dummyField", fields.testTournament.checked);
  $("tournamentSetupHint").textContent = fields.testTournament.checked
    ? "Dummy entrants are added on creation. Leave a spot for your own account to test joining and Matches."
    : "All matches finish on a double. Entries open as soon as you create the tournament.";
  toggleField("boardField", playMode === "inPerson");
  toggleField("startDelayField", playMode === "online");
  const platePlaces = combined && fields.plate.checked ? 2 : 0;
  fields.dummyCount.min = (combined ? Number(fields.qualifiers.value) : 4) + platePlaces - 1;
  fields.dummyCount.max = capacity ?? maxDummyEntrants;
  const bestOf = fields.gameType.value === "bestOf";
  fields.legsCount.step = bestOf && structure !== "groups" ? "2" : "1";
  toggleField("groupLegsField", combined);
  $("groupLegsHint").hidden = knockout || !bestOf;
  $("laterLegsHint").hidden = structure === "groups";
  for (const field of Object.values(laterRoundLegs)) {
    toggleField(`${field}Field`, structure !== "groups");
    fields[field].step = bestOf ? "2" : "1";
  }
  fields.customScore.min = fields.inMode.value === "double" ? "4" : "2";
  fields.qualifiers.max = capacity === null ? "" : capacity - platePlaces;
  $("structureHint").textContent = explanations[structure];
  const qualifiers = Number(fields.qualifiers.value);
  const size = bracketSize(qualifiers);
  $("bracketHint").hidden = !combined || qualifiers < 4 || !size || (capacity !== null && qualifiers + platePlaces > capacity);
  $("bracketHint").textContent = size ? `${size}-player knockout grid · ${size - qualifiers} opening byes` : "";
}

function settingsLabel(settings) {
  const format = settings.gameType === "bestOf" ? "Best of" : "First to";
  const opening = settings.inMode === "double" ? "Double in" : "Straight in";
  return [playModes[settings.playMode ?? "inPerson"], structures[settings.structure], Number(settings.startScore),
    `${format} ${Number(settings.legsCount)}`, opening].join(" · ");
}

function entrantCount(tournament) {
  const count = Object.keys(tournament.entries).length;
  const capacity = entryCapacity(tournament.settings);
  return capacity === null ? String(count) : `${count}/${capacity}`;
}

function hasJoined(tournament) {
  return user?.status === "Active" && Object.hasOwn(tournament.entries, user.uid);
}

function entryControls(tournament) {
  const joined = hasJoined(tournament);
  const capacity = entryCapacity(tournament.settings);
  const full = capacity !== null && Object.keys(tournament.entries).length >= capacity;
  const url = tournamentUrl(tournament.id ?? id, tournament.isTest ?? testMode);
  const status = joined ? "Joined" : "Not joined";
  const entriesOpen = tournament.status === "open";
  const marking = user && tournament.markers?.[user.uid];
  const profileStatus = marking ? "Marker" : entriesOpen ? status : tournament.status === "live" ? "Playing" : "Played";
  const entrantName = !id && user ? tournament.entries[user.uid] || entryName(user) : "";
  const markerAction = user?.status === "Active" && !joined && tournament.status !== "complete" &&
    tournament.settings.playMode !== "online" ? `<button type="button" class="tournamentEntryButton tournamentEntryView"
      data-action="${marking ? "leave-marker" : "marker"}" ${busy ? "disabled" : ""}>${marking ? "Leave marker role" : "Join as marker"}</button>` : "";
  let action = "";
  if (entriesOpen && !marking && (!joined || id)) {
    if (user?.status === "Active") {
      action = `<button type="button" class="tournamentEntryButton ${joined ? "tournamentEntryLeave" : "tournamentEntryJoin"}" data-action="${joined ? "leave" : "join"}"
        ${busy || (full && !joined) ? "disabled" : ""}>${joined ? "Leave tournament" : full ? "Tournament full" : "Join tournament"}</button>`;
    } else if (!user) {
      action = `<a class="tournamentEntryButton tournamentEntryJoin" href="auth.html?redirect=${encodeURIComponent(url)}">Sign in to join</a>`;
    } else {
      action = '<span class="tournamentHint">An active site account is required to enter.</span>';
    }
  }
  return `<div class="tournamentEntryFooter">
    ${id ? `<dl class="tournamentEntryStatus">
      <div class="tournamentEntryMetric"><dt>Players</dt><dd>${entrantCount(tournament)}</dd></div>
      <div class="tournamentEntryMetric"><dt>My entry</dt><dd class="${joined ? "tournamentJoined" : ""}">${status}</dd></div>
    </dl>` : entrantName && (entriesOpen || joined || (marking && tournament.status === "live")) ? `<div class="tournamentEntryProfile">
        ${avatar(user.uid, entrantName)}
        <div><strong>${escape(entrantName)}</strong>
          <span class="tournamentEntryProfileStatus${joined || marking ? " tournamentJoined" : ""}">${profileStatus}</span>
        </div>
    </div>` : ""}
    <div class="tournamentEntryLinks">
      ${action}
      ${markerAction}
      ${tournament.id && !id ? `<a class="tournamentEntryButton tournamentEntryView tournamentLobbyView" href="${url}" aria-label="View ${escape(tournament.title)}">View <span aria-hidden="true">→</span></a>` : ""}
    </div>
  </div>`;
}

function winnerMarkup(tournament, view) {
  if (!view) return "";
  const names = players => players.map(uid => escape(tournament.entries[uid])).join(" · ");
  const label = view.winners.length > 1 ? "Group winners" : "Tournament winner";
  return `${view.winners.length ? `<span><strong>${label}</strong> ${names(view.winners)}</span>` : ""}
    ${view.plateWinner ? `<span><strong>Plate winner</strong> ${names([view.plateWinner])}</span>` : ""}`.trim();
}

function renderLobby() {
  const allTournaments = canManage(user)
    ? [...lobby, ...testLobby].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    : lobby;
  if (!allTournaments.length) {
    content.innerHTML = '<p class="tournamentLobbyEmpty">No tournaments yet.</p>';
    return;
  }
  content.innerHTML = Object.entries(statusLabels).map(([section, label]) => {
    const status = section === "completedTests" ? "complete" : section;
    const tournaments = allTournaments.filter(item => item.status === status &&
      (status !== "complete" || Boolean(item.isTest) === (section === "completedTests")));
    if (!tournaments.length) return "";
    const badge = { open: "Entries open", live: "Live", complete: "Finished" }[status];
    return `<section class="tournamentLobbySection"><h2>${label}</h2>
      <div class="tournamentList">${tournaments.map(tournament => {
        const winners = status === "open" ? "" : winnerMarkup(tournament, tournamentView(tournament));
        const count = Object.keys(tournament.entries).length;
        const entryLabel = count === 1 ? "entry" : "entries";
        return `
        <article class="tournamentLobbyCard" data-tournament="${escape(tournament.id)}" data-test="${Boolean(tournament.isTest)}" data-status="${status}">
          <header class="tournamentLobbyHeading">
            <div>
              <h3>${escape(tournament.title)} ${tournament.isTest ? '<span class="tournamentTestBadge">Test</span>' : ""}</h3>
              <ul class="tournamentLobbyDetails" aria-label="Match settings">${settingsLabel(tournament.settings).split(" · ")
                .map(value => `<li>${escape(value)}</li>`).join("")}</ul>
            </div>
            <div class="tournamentLobbyHeaderMeta">
              <span class="tournamentLobbyBadge">${badge}</span>
              <button type="button" class="tournamentPlayerCount tournamentEntryButton tournamentLobbyEntryCount" data-players
                aria-label="View ${count} ${entryLabel}" aria-haspopup="dialog">${entrantCount(tournament)} ${entryLabel}</button>
            </div>
          </header>
          ${winners ? `<div class="tournamentWinners">${winners}</div>` : ""}
          ${entryControls(tournament)}
        </article>`;
      }).join("")}</div>
    </section>`;
  }).join("");
}

function renderRoster(tournament) {
  const entries = Object.entries(tournament.entries).sort(([, a], [, b]) => a.localeCompare(b));
  const manage = canManage(user);
  const joined = hasJoined(tournament);
  const seed = manage && tournament.settings.drawMode === "ability";
  const combined = tournament.settings.structure === "combined";
  const qualifiers = combined ? tournament.settings.qualifiers : 4;
  const minimum = qualifiers + (tournament.settings.plate ? 2 : 0);
  return `<section class="tournamentPanel">
    <h2>Entries</h2>
    <p>${settingsLabel(tournament.settings)}</p>
    ${tournament.settings.playMode === "online" ? "" : `<p>Boards available · ${Number(tournament.settings.boardCount ?? 1)}</p>`}
    <p>${testMode ? "Join with your own account to test the player view alongside the dummy entrants." : "Each player joins using their own site account."}</p>
    ${combined ? `<p>${qualifiers} qualify for a ${bracketSize(qualifiers)}-player main bracket.
      ${tournament.settings.plate ? "The remaining players enter the Plate." : ""}</p>` : ""}
    ${entryControls(tournament)}
    ${joined ? '<p class="tournamentHint">The Matches tab will appear once the draw starts.</p>' : ""}
  </section>
  ${manage ? `<section class="tournamentPanel tournamentAdmin">
    <h2>Start tournament</h2>
    ${seed ? `<p class="tournamentHint">Assign ability seeds before starting. Seed 1 is strongest.
      ${tournament.settings.structure === "knockout" ? "Top seeds are spread through the bracket." : "Players of similar ability are grouped together."}
      Equal seeds are drawn randomly.</p>` : ""}
    <form id="tournamentDrawForm">
      ${seed ? `<ul class="tournamentRoster">${entries.map(([uid, name]) => `<li>
        <label>${escape(name)}<input name="${escape(uid)}" type="number" min="1" required
            value="${escape(seedInputs.get(uid) ?? (testMode && /^dummy-\d+$/.test(uid) ? Number(uid.slice(6)) : ""))}"></label>
      </li>`).join("")}</ul>` : ""}
      <p class="tournamentHint">${entries.length < minimum ? `Wait for ${minimum - entries.length} more ${minimum - entries.length === 1 ? "player" : "players"}.` :
        seed ? "Set the ability seeds above, then start the tournament when everyone is ready." : "Start the tournament when everyone is ready."}</p>
      <button class="tournamentEntryButton tournamentEntryView" type="submit" ${busy || entries.length < minimum ? "disabled" : ""}>Start tournament</button>
    </form>
  </section>` : ""}`;
}

function table(label, headers, rows, compact = false, rowClasses = []) {
  return `<div class="tournamentTableWrap${compact ? " tournamentStandings" : ""}" ${compact ? "" : 'tabindex="0" role="region"'} aria-label="${label}">
    <table><thead><tr>${headers.map(heading => `<th scope="col">${heading}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(([name, ...values], index) => `<tr${rowClasses[index] ? ` class="${rowClasses[index]}"` : ""}><th scope="row">${name}</th>${values.map(value => `<td>${escape(value)}</td>`).join("")}</tr>`).join("")}</tbody>
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

const tabLabels = { bracket: "Bracket", groups: "Groups", fixtures: "Matches", stats: "Stats" };
const tabIcons = {
  bracket: '<path d="M8 3h8v5a4 4 0 0 1-8 0Zm4 9v7m-4 2h8M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4"/>',
  groups: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m2-15a3 3 0 0 1 0 6m1 3a4 4 0 0 1 3 4v2"/>',
  fixtures: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2"/>',
  stats: '<path d="M4 20h16M7 16v-4m5 4V8m5 8V4"/>'
};
let selectedTab = params.get("tab") === "mine" ? "fixtures" : params.get("tab");
let selectedMatches = "fixtures";
let matchScope = "all";
let photos = {};
let photoRequest;
let openRosterId;

function loadPhotos() {
  const playerData = window.PlayerData;
  if (!playerData || photoRequest) return;
  photoRequest = Promise.allSettled([playerData.fetchPlayerPhotosFromDrive(), playerData.fetchPublicPlayerProfiles()])
    .then(([drive, profiles]) => {
      photos = {
        ...drive.value,
        ...Object.fromEntries(Object.entries(profiles.value ?? {})
          .filter(([, profile]) => profile.photo)
          .map(([name, profile]) => [playerData.photoKey(name), profile.photo]))
      };
      if (openRosterId) renderPlayerList(findTournament(openRosterId.id, openRosterId.isTest));
      if (!id || (current && current.status !== "open")) render();
    });
}

function avatar(uid, name) {
  const photo = (uid && uid === user?.uid ? user.photoUrl : "") ||
    (name && !/^dummy-\d+$/.test(uid) && photos[window.PlayerData?.photoKey(name)]);
  const initials = name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  return `<span class="tournamentAvatar" aria-hidden="true">${escape(initials || "—")}
    ${photo ? `<img src="${escape(photo)}" alt="" loading="lazy">` : ""}
  </span>`;
}

function findTournament(tournamentId, isTest) {
  return id ? current : (isTest ? testLobby : lobby).find(tournament => tournament.id === tournamentId);
}

function remainingPlayers(view, total) {
  if (!view) return { main: total };
  const survivors = (rounds, entrants) => entrants - rounds.flat().filter(match => match.result).length;
  if (!view.groups.length) return { main: `${survivors(view.rounds, total)}/${total}` };
  if (!view.rounds.length) {
    const remaining = view.groups.reduce((sum, group) =>
      sum + (group.matches.every(match => match.result) ? 1 : group.rows.length), 0);
    return { main: `${remaining}/${total}` };
  }
  if (!view.groupsDone) return { main: `${total}/${total}` };
  const main = `${survivors(view.rounds, view.qualified.length)}/${total}`;
  const plateTotal = total - view.qualified.length;
  const plate = view.plateRounds.length ? `${survivors(view.plateRounds, plateTotal)}/${plateTotal}` : null;
  return { main, plate };
}

function rosterStatuses(view) {
  const statuses = new Map();
  const set = (uid, label, tone = "active") => statuses.set(uid, { label, tone });
  if (!view) return statuses;
  const qualified = new Set(view.qualified);

  for (const group of view.groups) {
    const done = group.matches.every(match => match.result);
    group.rows.forEach(({ id: uid }, index) => {
      if (!done) set(uid, `Playing in Group ${group.name}`);
      else if (!view.rounds.length) {
        if (index === 0) set(uid, "Group winner", "winner");
        else if (index === 1) set(uid, "Group runner-up", "finished");
        else set(uid, `Group ${group.name} · Place ${index + 1}`, "finished");
      } else if (!view.groupsDone) set(uid, "Awaiting group results");
      else if (qualified.has(uid)) set(uid, "Qualified for main bracket");
      else if (view.plateRounds.length) set(uid, "Qualified for Plate");
      else set(uid, "Out in group stage", "finished");
    });
  }

  for (const [rounds, plate] of [[view.rounds, false], [view.plateRounds, true]]) {
    const prefix = plate ? "Plate " : "";
    for (const match of rounds.flat()) {
      const stage = { 2: "final", 4: "semi-finals", 8: "quarter-finals" }[match.roundSize] ?? `round of ${match.roundSize}`;
      for (const uid of [match.a, match.b].filter(Boolean)) {
        if (match.roundSize === 2 && match.winner === uid) set(uid, plate ? "Plate winner" : "Winner", "winner");
        else if (match.result && match.winner !== uid) {
          const label = match.roundSize === 2 ? (plate ? "Plate runner-up" : "Runner-up") : `Out in ${prefix}${stage}`;
          set(uid, label, "finished");
        } else set(uid, plate ? `Plate · ${stage}` : stage[0].toUpperCase() + stage.slice(1));
      }
    }
  }
  return statuses;
}

function renderPlayerList(tournament) {
  if (!tournament) {
    dialog.close();
    return;
  }
  const entries = Object.entries(tournament.entries).sort(([, a], [, b]) => a.localeCompare(b));
  const preview = id && simulatedResults
    ? { ...tournament, results: { ...tournament.results, ...simulatedResults } }
    : tournament;
  const statuses = tournament.status === "open" ? new Map() : rosterStatuses(tournamentView(preview));
  dialog.classList.remove("tournamentNoticeDialog");
  $("tournamentDialogTitle").textContent = `Players joined (${entries.length})`;
  $("tournamentDialogBody").innerHTML = `<p class="tournamentHint">${escape(tournament.title)}</p>
    ${entries.length ? `<ul class="tournamentPlayerList">${entries.map(([uid, name]) => {
      const status = statuses.get(uid);
      return `<li>${avatar(uid, name)}<div class="tournamentRosterIdentity"><strong>${escape(name)}</strong>
        ${status ? `<span class="tournamentRosterStatus" data-tone="${status.tone}">${escape(status.label)}</span>` : ""}</div></li>`;
    }).join("")}</ul>` : "<p>No players have joined yet.</p>"}`;
}

function showPlayerList(tournament, tournamentId) {
  openRosterId = { id: tournamentId, isTest: tournament.isTest };
  renderPlayerList(tournament);
  if (!dialog.open) dialog.showModal();
  loadPhotos();
}

playerCount.addEventListener("click", () => {
  if (current && id) showPlayerList(current, id);
});

function showJoinConfirmation(tournament, tournamentId) {
  openRosterId = null;
  dialog.classList.add("tournamentNoticeDialog");
  $("tournamentDialogTitle").textContent = "You’re entered";
  $("tournamentDialogBody").innerHTML = `<p class="tournamentNoticeName"><span aria-hidden="true">✓</span>${escape(tournament.title)}</p>
    <p class="tournamentNoticeInstructions">Once the draw starts, open <strong>Matches</strong> to see who you play.</p>
    ${id ? "" : `<div class="tournamentNoticeActions"><a class="tournamentEntryButton tournamentEntryView"
      href="${tournamentUrl(tournamentId, tournament.isTest ?? testMode)}">View tournament <span aria-hidden="true">→</span></a></div>`}`;
  if (!dialog.open) dialog.showModal();
}

dialog.addEventListener("close", () => { openRosterId = null; });

let currentView;
let simulationRun = 0;
const shownOutcomes = new Set();

function showTournamentOutcome() {
  if (!current || !currentView || !hasJoined(current) || document.querySelector("dialog[open]")) return;
  const uid = user.uid;
  const view = currentView;
  const outcomes = [];
  if (view.groups.length && view.groupsDone) {
    if (view.rounds.length && view.qualified.includes(uid)) outcomes.push(["groups", "Group stage complete", "You’ve qualified for the main competition."]);
    else if (view.plateRounds.length) outcomes.push(["groups", "Group stage complete", "You’ve qualified for the Plate."]);
    else if (!view.winners.includes(uid)) outcomes.push(["groups", "Group stage complete", "You’re out of the tournament."]);
  }
  if (view.plateWinner === uid) outcomes.push(["winner", "You won the Plate!", "Congratulations on winning the Plate."]);
  else if (view.winners.includes(uid)) outcomes.push(["winner", view.rounds.length ? "You won the tournament!" : "You won your group!", "Congratulations on your win."]);
  else if (view.matches.some(match => match.roundSize && match.result &&
    (match.a === uid || match.b === uid) && match.winner !== uid)) {
    outcomes.push(["knockout", "You’ve been knocked out", "Your tournament run has ended."]);
  }
  for (const [type, title, detail] of outcomes) {
    const key = `onm-tournament-outcome:${JSON.stringify([testMode, id, uid, type, simulatedResults ? simulationRun : 0])}`;
    if (shownOutcomes.has(key)) continue;
    if (!simulatedResults) {
      try {
        if (sessionStorage.getItem(key)) continue;
        sessionStorage.setItem(key, "1");
      } catch {
        // The in-memory set still prevents repeated notices.
      }
    }
    shownOutcomes.add(key);
    openRosterId = null;
    dialog.classList.add("tournamentNoticeDialog");
    $("tournamentDialogTitle").textContent = title;
    $("tournamentDialogBody").innerHTML = `<p class="tournamentNoticeName">${escape(current.title)}</p>
      <p class="tournamentNoticeInstructions">${simulatedResults ? "Simulation preview · " : ""}${escape(detail)}</p>`;
    dialog.showModal();
    break;
  }
}

document.addEventListener("close", () => queueMicrotask(showTournamentOutcome), true);

infoButton.addEventListener("click", () => {
  if (!current) return;
  openRosterId = null;
  dialog.classList.add("tournamentNoticeDialog");
  const { settings } = current;
  const firstThrow = { bull: "Bull off", coin: "Coin toss", random: "Random" }[settings.firstThrow] ?? "Bull off";
  const rounds = [
    ["Group stage", settings.groupLegs], ["Quarter-finals", settings.quarterFinalLegs],
    ["Semi-finals", settings.semiFinalLegs], ["Final", settings.finalLegs]
  ].filter(([, legs]) => legs != null);
  const format = settings.gameType === "bestOf" ? "Best of" : "First to";
  const rows = [
    ["Format", settingsLabel(settings)],
    ["First throw", firstThrow],
    ...(settings.playMode === "online" ? [] : [["Boards", settings.boardCount ?? 1]]),
    ...rounds.map(([label, legs]) => [label, `${format} ${legs}`])
  ];
  $("tournamentDialogTitle").textContent = "Tournament information";
  $("tournamentDialogBody").innerHTML = `<dl class="tournamentInfoList">${rows.map(([label, value]) =>
    `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>
    <p class="tournamentNoticeInstructions">All legs finish on a double.</p>
    ${settings.structure !== "knockout" ? '<p class="tournamentNoticeInstructions">Group standings are ranked by points, leg difference, then three-dart average. Wins earn 3 points and draws earn 1.</p>' : ""}
    ${settings.structure === "combined" ? `<p class="tournamentNoticeInstructions">${Number(settings.qualifiers)} players progress to the main knockout.${settings.plate ? " The remaining players enter the Plate." : ""}</p>` : ""}`;
  dialog.showModal();
});

rulesButton.addEventListener("click", () => {
  if (!canManage(user) || !current || current.status === "complete") return;
  openRosterId = null;
  dialog.classList.add("tournamentNoticeDialog");
  const { settings } = current;
  const labels = ["Group-stage legs", "Quarter-final legs", "Semi-final legs", "Final legs"];
  $("tournamentDialogTitle").textContent = "Tournament settings";
  $("tournamentDialogBody").innerHTML = `<p class="tournamentNoticeInstructions">Format changes apply to future matches. Matches already in the scorer keep their format. Changing boards reassigns fixtures.</p>
    <form id="tournamentRuleForm">
      <div class="tournamentFields tournamentRuleFields">
        ${settings.playMode !== "online" ? `<label>Number of boards
          <input name="boardCount" type="number" min="1" max="${maxBoards}" value="${Number(settings.boardCount ?? 1)}" required></label>` : ""}
        <label>Match format<select name="gameType">
          <option value="bestOf"${settings.gameType === "bestOf" ? " selected" : ""}>Best of</option>
          <option value="firstTo"${settings.gameType === "firstTo" ? " selected" : ""}>First to</option>
        </select></label>
        <label>Default number of legs<input name="legsCount" type="number" min="1" max="19" value="${Number(settings.legsCount)}" required></label>
        ${current.status === "open" ? `<label>Who throws first?<select name="firstThrow">
          <option value="bull"${(settings.firstThrow ?? "bull") === "bull" ? " selected" : ""}>Bull off</option>
          <option value="coin"${settings.firstThrow === "coin" ? " selected" : ""}>Coin toss</option>
          <option value="random"${settings.firstThrow === "random" ? " selected" : ""}>Random</option>
        </select></label>` : ""}
        ${editableLegFields.map((field, index) => {
          if (index === 0 ? settings.structure !== "combined" : settings.structure === "groups") return "";
          return `<label>${labels[index]}<input name="${field}" type="number" min="1" max="19"
            placeholder="Use default" value="${settings[field] == null ? "" : Number(settings[field])}"></label>`;
        }).join("")}
      </div>
      <p id="tournamentRuleMessage" class="tournamentMessage" role="status"></p>
      <div class="tournamentNoticeActions"><button class="tournamentEntryButton tournamentEntryJoin" type="submit">Save rules</button></div>
    </form>`;
  dialog.showModal();
});

dialog.addEventListener("submit", async event => {
  if (event.target.id !== "tournamentRuleForm") return;
  event.preventDefault();
  if (busy || !canManage(user)) return;
  const changes = Object.fromEntries([...new FormData(event.target)].map(([key, value]) =>
    [key, ["gameType", "firstThrow"].includes(key) ? value : value === "" ? null : Number(value)]));
  busy = true;
  event.submitter.disabled = true;
  try {
    await store.editRules(id, user, changes);
    simulatedResults = null;
    if (dialog.open) dialog.close();
    showSettingsToast();
  } catch (error) {
    const status = $("tournamentRuleMessage");
    if (status) status.textContent = error.code === "permission-denied"
      ? "Firebase denied the settings update. Check that the latest Tournament rules are deployed and your account is an active owner or admin."
      : tournamentError(error);
  } finally {
    busy = false;
    event.submitter.disabled = false;
    render();
  }
});

let bracketScroll = { left: 0, top: 0 };

function bracketDiagram(rounds, entrantTotal, matchCard, player) {
  const final = rounds.at(-1)[0];
  const sides = rounds.slice(0, -1).map(matches => [matches.slice(0, matches.length / 2), matches.slice(matches.length / 2)]);
  const finalists = [final.a, final.b].map((uid, index) => ({
    label: "R2", detail: "Finalist", cards: [player(uid, index ? final.result?.right.legs : final.result?.left.legs, final.winner === uid && Boolean(uid))]
  }));
  const half = side => sides.map(pair => ({
    label: `R${pair[side].length * 4}`,
    detail: ({ 1: "Semi-finals", 2: "Quarter-finals" })[pair[side].length] || "Knockout",
    cards: pair[side].map(matchCard)
  }));
  const split = entrantTotal >= 32;
  const champion = { label: "R1", detail: "Winner", cards: [`<div class="tournamentFinalCard">
      <span class="tournamentKicker">Champion</span>${player(final.winner)}
    </div>`] };
  const columns = split ? [...half(0), finalists[0], champion, finalists[1], ...half(1).reverse()]
    : [...rounds.map(matches => ({
      label: `R${matches.length * 2}`,
      detail: ({ 1: "Final", 2: "Semi-finals", 4: "Quarter-finals" })[matches.length] || "Knockout",
      cards: matches.map(matchCard)
    })), champion];
  const cardWidth = 192;
  const columnStep = 226;
  const rowStep = 126;
  const header = 46;
  const middle = columns.indexOf(champion);
  const height = header + columns[0].cards.length * rowStep;
  const width = (columns.length - 1) * columnStep + cardWidth;
  const centerY = (column, index) => header + (index + 0.5) * (height - header) / column.cards.length;
  const paths = columns.flatMap((column, columnIndex) => {
    if (columnIndex === middle) return [];
    const left = columnIndex < middle;
    const targetIndex = columnIndex + (left ? 1 : -1);
    const target = columns[targetIndex];
    const startX = columnIndex * columnStep + (left ? cardWidth : 0);
    const endX = targetIndex * columnStep + (left ? 0 : cardWidth);
    const elbow = (startX + endX) / 2;
    return column.cards.map((_, index) => {
      const y = centerY(column, index);
      const endY = centerY(target, Math.floor(index * target.cards.length / column.cards.length));
      return `M${startX} ${y}H${elbow}V${endY}H${endX}`;
    });
  }).join(" ");
  return `<div class="tournamentBracket" tabindex="0" role="region" aria-label="Scrollable knockout bracket">
    <div class="tournamentDiagram" style="width:${width}px;height:${height}px">
      <svg aria-hidden="true" width="${width}" height="${height}"><path d="${paths}"/></svg>
      ${columns.map((column, columnIndex) => `<div class="tournamentRound" style="left:${columnIndex * columnStep}px;width:${cardWidth}px">
        <h3><strong>${column.label}</strong><span>${column.detail}</span></h3>
        ${column.cards.map((card, index) => `<div class="tournamentBracketNode" style="top:${centerY(column, index)}px">${card}</div>`).join("")}
      </div>`).join("")}
    </div>
  </div>`;
}

function renderDraw(tournament, view) {
  const remaining = tournamentStartTime(tournament) - Date.now();
  const waitingForStart = remaining > 0;
  const fixtures = fixtureSchedule(view, tournament.settings);
  const byMatch = new Map(fixtures.map(fixture => [fixture.match.id, fixture]));
  const qualified = new Set(view.qualified);
  const projected = new Set(view.projectedQualified);
  const name = uid => escape(tournament.entries[uid]);
  const manage = canManage(user);
  const inPerson = tournament.settings.playMode !== "online";
  const slot = uid => uid === null ? "Bye" : uid === undefined ? "TBD" : name(uid);
  const entrant = hasJoined(tournament);
  const isYou = uid => entrant && user.uid === uid;
  const myFixtures = entrant ? fixtures.filter(({ match }) => match.a === user.uid || match.b === user.uid) : [];
  function fixtureStatus({ match, available }) {
    if (match.result) return "complete";
    const session = tournament.matchSessions?.[match.id];
    if (session?.status === "playing") return "in-play";
    if (session?.status === "invited") return "invited";
    const activity = !simulatedResults && tournament.activeMatches?.[match.id];
    if (activity?.parked || Date.now() - (activity?.updatedAt?.toMillis?.() ?? 0) < tournamentActivityTimeout) return "in-play";
    return available && !waitingForStart ? "ready" : "queued";
  }

  function statusPill(status, board) {
    const label = { complete: "Complete", "in-play": "In play", ready: "Ready", invited: "Awaiting acceptance", queued: "In queue" }[status];
    return `<strong class="tournamentStatusPill" data-status="${status}">${status === "complete" ? "" : board ? `Board ${board} · ` : "Online · "}${label}</strong>`;
  }

  const queuePositions = new Map();
  if (entrant) {
    const boardQueues = new Map();
    for (const fixture of fixtures) {
      if (!fixture.board || fixtureStatus(fixture) !== "queued") continue;
      const position = (boardQueues.get(fixture.board) ?? 0) + 1;
      boardQueues.set(fixture.board, position);
      queuePositions.set(fixture.match.id, position);
    }
  }

  function player(uid, legs, winner, source = "") {
    const label = uid === undefined && source ? escape(source) : slot(uid);
    return `<div class="tournamentPlayer ${winner ? "tournamentWinner" : ""}${isYou(uid) ? " tournamentYou" : ""}">
      ${avatar(uid, tournament.entries[uid])}<div class="tournamentPlayerIdentity">
      <span class="tournamentPlayerName" title="${label}">${label}</span></div>
      ${legs == null ? "" : `<b>${escape(legs)}</b>`}
    </div>`;
  }

  function scoreLinks(match) {
    if (user?.status !== "Active" || waitingForStart || simulatedResults || match.result) return "";
    const session = tournament.matchSessions?.[match.id];
    const participant = [match.a, match.b].includes(user.uid);
    const link = (mode, label) => `<a class="tournamentScore" href="${scorerUrl(id, match.id, testMode, mode)}">${label}</a>`;
    if (session) {
      if (session.mode === "shared" && participant) {
        return link("shared", session.status === "invited"
          ? session.owner === user.uid ? "View invite" : "Accept match"
          : "Open match");
      }
      if (session.mode === "chalk" && session.owner === user.uid) return link("chalk", "Resume scoring");
      return "";
    }
    if (!byMatch.get(match.id)?.available) return "";
    const shared = participant && ![match.a, match.b].some(uid => /^dummy-\d+$/.test(uid));
    const chalk = inPerson && (manage || entrant || tournament.markers?.[user.uid]);
    return [
      shared ? link("shared", inPerson ? "Score on both phones" : "Invite opponent") : "",
      chalk ? link("chalk", participant ? "Score for both" : "Mark match") : ""
    ].filter(Boolean).join("");
  }

  function matchCard(match, bracket = false) {
    const { a, b, result, bye, winner } = match;
    if (bye && !winner) return '<div class="tournamentMatch tournamentEmpty">Empty pairing</div>';
    return `<div class="tournamentMatch">
      ${player(a, result?.left.legs, winner === a && Boolean(a), bracket ? match.openingLabels?.[0] : "")}
      ${player(b, result?.right.legs, winner === b && Boolean(b), bracket ? match.openingLabels?.[1] : "")}
      ${bye ? '<div class="tournamentMatchMeta">Advances by bye</div>' : ""}
    </div>`;
  }

  function fixtureCard(fixture) {
    const { match, stage, board } = fixture;
    const { a, b, result } = match;
    const status = fixtureStatus(fixture);
    const format = result ? result.format : matchSettings(tournament.settings, match);
    const formatLabel = format ? `${format.gameType === "bestOf" ? "Best of" : "First to"} ${Number(format.legsCount)}` : "";
    const actions = scoreLinks(match);
    const queuePosition = matchScope === "mine" ? queuePositions.get(match.id) : null;
    const details = [formatLabel, result?.winnerIndex === -1 ? "Draw" : ""].filter(Boolean).join(" · ");
    return `<article class="tournamentFixture" data-fixture-status="${status}">
      <div class="tournamentFixtureMeta"><div class="tournamentFixtureStage"><strong>${escape(stage)}</strong>
        ${details ? `<span>${details}</span>` : ""}
        ${queuePosition ? `<span>Queue position ${queuePosition}</span>` : ""}</div>
        ${statusPill(status, board)}
      </div>
      ${matchCard(match)}
      ${actions ? `<div class="tournamentScoringLinks">${actions}</div>` : ""}
      ${result ? `<details data-section="${match.id}"><summary>Match stats</summary>
        ${table("Match statistics", ["Player", ...statHeaders], [[name(a), ...statValues(result.left)], [name(b), ...statValues(result.right)]])}
      </details>` : ""}
    </article>`;
  }

  const tabs = [
    "fixtures",
    ...(view.groups.length ? ["groups"] : []),
    ...(view.rounds.length ? ["bracket"] : []),
    "stats"
  ];
  if (!tabs.includes(selectedTab)) selectedTab = tabs[0];
  const tab = selectedTab;
  let panel;
  if (tab === "bracket") {
    const plate = selectedBracket === "plate" && view.plateRounds.length > 0;
    const rounds = plate ? view.plateRounds : view.rounds;
    const mainEntrants = tournament.settings.qualifiers ?? view.players.length;
    const entrantTotal = plate ? view.players.length - mainEntrants : mainEntrants;
    panel = `${view.plateRounds.length ? `<div class="tournamentTabs tournamentBracketSwitch" role="group" aria-label="Select bracket">
        <button type="button" data-bracket="main" aria-pressed="${!plate}"><svg viewBox="0 0 24 24" aria-hidden="true">${tabIcons.bracket}</svg><span>Main tournament</span></button>
        <button type="button" data-bracket="plate" aria-pressed="${plate}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg><span>Plate</span></button>
      </div>` : ""}
      <p class="tournamentHint">Scroll sideways to follow the draw.</p>
      ${bracketDiagram(rounds, entrantTotal, match => matchCard(match, true), player)}`;
  } else if (tab === "groups") {
    const advancing = qualified.size ? qualified : projected;
    const hasPlate = view.plateRounds.length > 0;
    const showPlate = advancing.size > 0 && hasPlate;
    const mainPlaces = tournament.settings.qualifiers;
    const path = uid => advancing.has(uid) ? "Main" : showPlate ? "Plate" : "";
    panel = `<div class="tournamentSectionHeading">
      ${view.rounds.length ? `<p class="tournamentQualificationCounts"><span class="tournamentProgressMain">${Number(mainPlaces)} to Main</span>
        <span class="tournamentProgressPlate">${hasPlate ? view.players.length - mainPlaces : 0} to Plate</span></p>` : ""}
      <button type="button" class="tournamentEntryButton tournamentInfo" data-group-info aria-haspopup="dialog" aria-label="Group qualification rules">i</button></div>
      ${projected.size ? `<p class="tournamentHint">${showPlate ? "Main and Plate positions are" : "Main tournament positions are"} provisional until the group stage finishes.</p>` : ""}
      <div class="tournamentGroups">${view.groups.map(group => {
        const draws = matchSettings(tournament.settings, group.matches[0] ?? { id: "g" }).allowDraw ||
          group.rows.some(row => row.draws);
        const groupMain = group.rows.filter(row => advancing.has(row.id)).length;
        return `<article class="tournamentGroup">
        <h3>Group ${escape(group.name)}</h3>
        ${advancing.size ? `<p class="tournamentQualificationCounts"><span class="tournamentProgressMain">${groupMain} Main</span>
          <span class="tournamentProgressPlate">${hasPlate ? group.rows.length - groupMain : 0} Plate</span></p>` : ""}
        ${table(`Group ${escape(group.name)} standings`, ["Player", "P", "W", ...(draws ? ["D"] : []), "L", "+/-", "Avg", "Pts"],
          group.rows.map(row => [name(row.id) + (path(row.id) ? ` <span class="tournamentProgress tournamentProgress${path(row.id)}">${path(row.id)}</span>` : ""),
            row.played, row.wins, ...(draws ? [row.draws] : []), row.played - row.wins - row.draws,
            (row.legsFor > row.legsAgainst ? "+" : "") + (row.legsFor - row.legsAgainst),
            average(row.totalScored, row.dartsThrown), groupPoints(row)]), true,
          group.rows.map((row, index) => [
            isYou(row.id) ? "tournamentYou" : "",
            path(row.id) === "Main" ? "tournamentMainRow" : "",
            path(row.id) === "Plate" && index > 0 && path(group.rows[index - 1].id) === "Main" ? "tournamentPlateCut" : ""
          ].filter(Boolean).join(" ")))}
      </article>`;
      }).join("")}</div>`;
  } else if (tab === "fixtures") {
    const showResults = selectedMatches === "results";
    const visibleFixtures = (matchScope === "mine" ? myFixtures : fixtures).filter(fixture => Boolean(fixture.match.result) === showResults);
    panel = `<div class="tournamentMatchFilters">
      <div class="tournamentTabs tournamentBracketSwitch" role="group" aria-label="Match view">
        <button type="button" data-matches="fixtures" aria-pressed="${!showResults}"><svg viewBox="0 0 24 24" aria-hidden="true">${tabIcons.fixtures}</svg><span>Fixtures</span></button>
        <button type="button" data-matches="results" aria-pressed="${showResults}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="m8 12 2 2 5-5"/></svg><span>Results</span></button>
      </div>
      <div class="tournamentTabs tournamentBracketSwitch" role="group" aria-label="Which matches to show">
        <button type="button" data-match-scope="all" aria-pressed="${matchScope === "all"}">All</button>
        <button type="button" data-match-scope="mine" aria-pressed="${matchScope === "mine"}">My matches</button>
      </div></div>
      ${visibleFixtures.length ? `<div class="tournamentFixtures">${visibleFixtures.map(fixtureCard).join("")}</div>`
        : `<p>${matchScope === "mine" && !user ? "Sign in to see your matches." : showResults ? "No results yet." : "No upcoming fixtures."}</p>`}`;
  } else {
    panel = `${table("Tournament statistics", ["Player", "P", "W", ...statHeaders],
        [...view.players].sort((a, b) => tournament.entries[a.id].localeCompare(tournament.entries[b.id]))
          .map(row => [name(row.id), row.played, row.wins, ...statValues(row)]))}`;
  }

  return `
    ${waitingForStart ? `<section class="tournamentPanel tournamentCallup"><div>
      <p class="tournamentKicker">Online tournament</p><strong>Starts in <span data-start-countdown>${Number.isFinite(remaining) ? countdownLabel(remaining) : "…"}</span></strong>
    </div></section>` : ""}
    ${inPerson && user?.status === "Active" && !entrant && !view.complete ? `<div class="tournamentMarkerAction">
      <button type="button" class="tournamentEntryButton tournamentEntryView" data-action="${tournament.markers?.[user.uid] ? "leave-marker" : "marker"}">
        ${tournament.markers?.[user.uid] ? "Leave marker role" : "Join as marker"}
      </button></div>` : ""}
    <div class="tournamentTabs" role="tablist" aria-label="Tournament views">
      ${tabs.map(key => `<button id="tournament-tab-${key}" type="button" role="tab" data-tab="${key}"
        aria-selected="${tab === key}" aria-controls="tournamentView" tabindex="${tab === key ? 0 : -1}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${tabIcons[key]}</svg><span>${tabLabels[key]}</span></button>`).join("")}
    </div>
    <section id="tournamentView" class="tournamentPanel" role="tabpanel" aria-labelledby="tournament-tab-${tab}" tabindex="0">${panel}</section>
    ${testMode && manage && (!view.complete || simulatedResults) ? `<div class="tournamentPanel tournamentSimulation">
      ${!view.complete ? '<button type="button" class="tournamentEntryButton tournamentEntryView" data-simulation="next">Simulate next match</button><button type="button" class="tournamentEntryButton" data-simulation="run">Simulate remaining matches</button>' : ""}
      ${simulatedResults ? '<button type="button" class="tournamentEntryButton" data-simulation="undo">Clear last result</button><button type="button" class="tournamentEntryButton" data-simulation="clear">Clear simulated results</button>' : ""}
      <p class="tournamentHint">${simulatedResults ? `${Object.keys(simulatedResults).length} simulated in this preview.` : "Preview results for every entrant, including yourself. Nothing is saved."}</p>
    </div>` : ""}`;
}

let activityExpiry;

function render() {
  clearTimeout(activityExpiry);
  currentView = null;
  winnerPanel.hidden = true;
  $("tournamentPlayerTotals").hidden = true;
  const manage = canManage(user);
  deleteButton.hidden = !id || !canDeleteTournament(current, user);
  rulesButton.hidden = !id || !manage || !current || current.status === "complete";
  infoButton.hidden = playerCount.hidden = !id || !current || (testMode && !manage);
  $("tournamentLiveBadge").hidden = infoButton.hidden || current?.status !== "live";
  $("tournamentSetup").hidden = Boolean(id) || !manage;
  $("tournamentTestBadge").hidden = !testMode || !current || !manage;
  if (testMode && !manage) {
    content.replaceChildren();
    $("tournamentTitle").textContent = "Test tournaments";
    $("tournamentIntro").textContent = "Private tournaments for site administrators.";
    document.title = "Oche Ness Monsters | Test tournaments";
    return;
  }
  if (!loaded) return;
  if (openRosterId) renderPlayerList(findTournament(openRosterId.id, openRosterId.isTest));
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
  const bracket = content.querySelector(".tournamentBracket");
  if (bracket) bracketScroll = { left: bracket.scrollLeft, top: bracket.scrollTop };
  const focusedTab = document.activeElement?.dataset.tab;
  document.title = `Oche Ness Monsters | ${current.title}`;
  $("tournamentTitle").textContent = current.title;
  const count = Object.keys(current.entries).length;
  playerCount.setAttribute("aria-label", `View ${count} ${count === 1 ? "player" : "players"}`);
  const status = simulatedResults ? "Simulation preview" : current.status === "complete" ? "Completed" : statusLabels[current.status];
  $("tournamentIntro").textContent = `${testMode ? "Private test · " : ""}${status} · ${settingsLabel(current.settings)}`;
  const tournament = simulatedResults
    ? { ...current, results: { ...current.results, ...simulatedResults } }
    : current;
  currentView = current.status === "open" ? null : tournamentView(tournament);
  const totals = $("tournamentPlayerTotals");
  const { main, plate } = remainingPlayers(currentView, count);
  totals.innerHTML = `<span>Players <strong>${main}</strong></span>${plate ? `<span>Plate players <strong>${plate}</strong></span>` : ""}`;
  totals.hidden = false;
  if (current.status === "live" && !simulatedResults) {
    const now = Date.now();
    const expiry = Math.min(...Object.entries(current.activeMatches ?? {})
      .filter(([matchId]) => !current.results[matchId])
      .map(([, activity]) => (activity?.updatedAt?.toMillis?.() ?? 0) + tournamentActivityTimeout)
      .filter(time => time > now));
    if (Number.isFinite(expiry)) activityExpiry = setTimeout(render, expiry - now);
  }
  winnerPanel.innerHTML = winnerMarkup(tournament, currentView);
  winnerPanel.hidden = !winnerPanel.innerHTML;
  content.innerHTML = currentView ? renderDraw(tournament, currentView) : renderRoster(current);
  content.querySelectorAll("details[data-section]").forEach(detail => { detail.open = expanded.has(detail.dataset.section); });
  const nextBracket = content.querySelector(".tournamentBracket");
  if (nextBracket) nextBracket.scrollTo(bracketScroll);
  if (focusedTab) $(`tournament-tab-${selectedTab}`)?.focus({ preventScroll: true });
  showTournamentOutcome();
  const countdown = content.querySelector("[data-start-countdown]");
  if (countdown && Number.isFinite(tournamentStartTime(current))) {
    const tick = () => {
      if (!countdown.isConnected) return;
      const remaining = tournamentStartTime(current) - Date.now();
      if (remaining <= 0) render();
      else {
        countdown.textContent = countdownLabel(remaining);
        setTimeout(tick, Math.min(1000, remaining));
      }
    };
    setTimeout(tick, 1000);
  }
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
    if (loaded) render();
  }
}

deleteButton.addEventListener("click", () => {
  if (!id || !canDeleteTournament(current, user)) return;
  if (!window.confirm(`Delete “${current.title}” permanently? Entries and results will be removed.`)) return;
  const account = user;
  action(deleteButton, async () => {
    await store.deleteTournament(id, account);
    location.replace(lobbyUrl);
  });
});

form.addEventListener("input", updateFields);
form.addEventListener("submit", event => {
  event.preventDefault();
  if (form.hidden || !canManage(user)) return;
  const structure = fields.structure.value;
  const roundLengths = Object.fromEntries(["groupLegs", ...Object.values(laterRoundLegs)]
    .filter(field => !fields[field].disabled && fields[field].value !== "")
    .map(field => [field, fields[field].valueAsNumber]));
  const settings = {
    ...roundLengths,
    playMode: fields.playMode.value,
    ...(fields.playMode.value === "online" ? { startDelayMinutes: fields.startDelayMinutes.valueAsNumber } : {}),
    ...(fields.playMode.value === "inPerson" ? { boardCount: fields.boardCount.valueAsNumber } : {}),
    structure,
    capacity: fields.playMode.value === "inPerson" ? null : Number(structure === "knockout" ? fields.bracket.value : fields.capacity.value),
    ...(structure === "combined" ? { plate: fields.plate.checked } : {}),
    groupSize: structure === "knockout" ? null : Number(fields.groupSize.value),
    qualifiers: structure === "combined" ? Number(fields.qualifiers.value) : null,
    gameType: fields.gameType.value,
    legsCount: Number(fields.legsCount.value),
    startScore: Number(fields.startScore.value === "custom" ? fields.customScore.value : fields.startScore.value),
    inMode: fields.inMode.value,
    firstThrow: fields.firstThrow.value,
    drawMode: fields.drawMode.value
  };
  action(event.submitter, async () => {
    const isTest = fields.testTournament.checked;
    const dummyCount = isTest ? fields.dummyCount.valueAsNumber : 0;
    try {
      const creationStore = isTest ? testStore : store;
      location.href = tournamentUrl(await creationStore.create(fields.title.value.trim(), settings, user, dummyCount), isTest);
    } catch (error) {
      if (error.code !== "permission-denied") throw error;
      showCreateError(error);
      setupButton.focus();
    }
  });
});

content.addEventListener("click", event => {
  if (event.target.closest("button[data-group-info]") && current) {
    openRosterId = null;
    dialog.classList.add("tournamentNoticeDialog");
    const { settings } = current;
    $("tournamentDialogTitle").textContent = "Group qualification";
    $("tournamentDialogBody").innerHTML = `<p>Players are ranked within each group by points, then leg difference, then three-dart average.</p>
      ${settings.structure === "combined" ? `<p>The main tournament takes ${Number(settings.qualifiers)} players. Higher group positions are taken first.
        If there are more players at the cutoff position than spaces, those spaces go to the players with the best points per match, then leg difference per match, then average.
        Depending on the draw, some third-place finishers can qualify.</p>
        <p>Lighter green rows mark main-tournament places.${settings.plate ? " The dotted line separates those places from the Plate." : ""} Positions shown during play are provisional.</p>`
      : "<p>Final group standings determine the group winners.</p>"}`;
    dialog.showModal();
    return;
  }
  const scope = event.target.closest("button[data-match-scope]");
  if (scope) {
    matchScope = scope.dataset.matchScope;
    render();
    content.querySelector('button[data-match-scope][aria-pressed="true"]')?.focus({ preventScroll: true });
    return;
  }
  const matches = event.target.closest("button[data-matches]");
  if (matches) {
    selectedMatches = matches.dataset.matches;
    render();
    content.querySelector('button[data-matches][aria-pressed="true"]')?.focus({ preventScroll: true });
    return;
  }
  const simulation = event.target.closest("button[data-simulation]");
  if (simulation && testMode && canManage(user) && current?.status === "live") {
    const mode = simulation.dataset.simulation;
    message("");
    if (mode === "clear") {
      simulatedResults = null;
    } else if (mode === "undo") {
      const resultIds = Object.keys(simulatedResults ?? {});
      if (resultIds.length) delete simulatedResults[resultIds.at(-1)];
      if (resultIds.length <= 1) simulatedResults = null;
    } else {
      const results = { ...current.results, ...simulatedResults };
      const additions = simulateTournamentResults({ ...current, results }, Math.random, mode === "next" ? 1 : Infinity);
      if (Object.keys(additions).length) {
        if (!simulatedResults) simulationRun++;
        simulatedResults = { ...simulatedResults, ...additions };
      } else {
        message("There are no matches ready to simulate.");
      }
    }
    render();
    if (!dialog.open) (content.querySelector(`button[data-simulation="${mode}"]`) ??
      content.querySelector("button[data-simulation]"))?.focus({ preventScroll: true });
    return;
  }
  const bracket = event.target.closest("button[data-bracket]");
  if (bracket) {
    selectedBracket = bracket.dataset.bracket;
    content.querySelector(".tournamentBracket")?.scrollTo(0, 0);
    render();
    content.querySelector('button[data-bracket][aria-pressed="true"]')?.focus();
    return;
  }
  const tab = event.target.closest("button[data-tab]");
  if (tab) {
    selectedTab = tab.dataset.tab;
    render();
    $(`tournament-tab-${selectedTab}`)?.focus({ preventScroll: true });
    return;
  }
  const playersButton = event.target.closest("button[data-players]");
  const button = event.target.closest("button[data-action]");
  if (!playersButton && !button) return;
  const card = event.target.closest("[data-tournament]");
  const tournamentId = id ?? card?.dataset.tournament;
  const isTest = id ? testMode : card?.dataset.test === "true";
  if (isTest && !canManage(user)) return;
  const tournament = findTournament(tournamentId, isTest);
  if (!tournament) return;
  if (playersButton) {
    showPlayerList(tournament, tournamentId);
    return;
  }
  if (!button || user?.status !== "Active") return;
  const join = button.dataset.action === "join";
  const account = user;
  const tournamentApi = isTest && !id ? testStore : store;
  if (["marker", "leave-marker"].includes(button.dataset.action)) {
    action(button, () => tournamentApi.scoring(tournamentId, "marker", { leave: button.dataset.action === "leave-marker" }));
    return;
  }
  action(button, async () => {
    await tournamentApi.joinOrLeave(tournamentId, account, join);
    if (join && user?.uid === account.uid) showJoinConfirmation(tournament, tournamentId);
  });
});

content.addEventListener("keydown", event => {
  const tab = event.target.closest('button[role="tab"]');
  if (!tab) return;
  const tabs = [...tab.parentElement.querySelectorAll("button[data-tab]")];
  const index = tabs.indexOf(tab);
  const next = { Home: 0, End: tabs.length - 1,
    ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  tabs[next].click();
});

for (const root of [content, dialog]) {
  root.addEventListener("error", event => {
    if (event.target.matches(".tournamentAvatar img")) event.target.hidden = true;
  }, true);
}

content.addEventListener("input", event => {
  if (event.target.form?.id === "tournamentDrawForm") seedInputs.set(event.target.name, event.target.value);
});

content.addEventListener("submit", event => {
  if (event.target.id !== "tournamentDrawForm") return;
  event.preventDefault();
  if (!canManage(user)) return;
  const seeds = Object.fromEntries([...new FormData(event.target)].map(([uid, seed]) => [uid, Number(seed)]));
  const delay = current.settings.playMode === "online" ? current.settings.startDelayMinutes : 0;
  if (!window.confirm(delay ? `Close entries and start the ${delay}-minute countdown?` : "Start the tournament and close entries?")) return;
  action(event.submitter, () => store.start(id, seeds));
});

async function initialise() {
  fields.boardCount.max = maxBoards;
  updateFields();
  if (id && !testMode) loadPhotos();
  store = await tournamentStore(testMode);
  if (!id) testStore = await tournamentStore(true);
  setCreateForm(false);
  const onError = error => message(tournamentError(error));
  const watch = () => id
    ? store.watchTournament(id, tournament => {
      if (simulatedResults && Object.keys(current.results).length !== Object.keys(tournament?.results ?? {}).length) {
        simulatedResults = null;
      }
      current = tournament;
      if (!loaded) message("");
      loaded = true;
      render();
    }, onError)
    : store.watchLobby(tournaments => {
      lobby = tournaments;
      if (!loaded) message("");
      loaded = true;
      render();
    }, onError);
  let stopWatching;
  const { auth, authSdk } = await window.ONMFirebase.authReady;
  authSdk.onAuthStateChanged(auth, async account => {
    if (dialog.open) dialog.close();
    openRosterId = null;
    user = null;
    setupButton.disabled = false;
    setCreateForm(false);
    render();
    stopWatching?.();
    stopWatching = undefined;
    testLobby = [];
    if (testMode) {
      current = null;
      simulatedResults = null;
      lobby = [];
      loaded = false;
      render();
      message("Loading test tournaments…");
    }
    try {
      const profile = account ? await window.ONMFirebase.loadOwnUser() : null;
      if ((account?.uid ?? null) !== (auth.currentUser?.uid ?? null)) return;
      user = profile;
      if (!id && user && !user.photoUrl) loadPhotos();
      render();
      if (testMode) {
        if (canManage(user)) stopWatching = watch();
        else message("Sign in as a site administrator to view test tournaments.");
      } else if (!id && canManage(user)) {
        stopWatching = testStore.watchLobby(tournaments => {
          if (!canManage(user)) return;
          testLobby = tournaments.map(tournament => ({ ...tournament, isTest: true }));
          render();
        }, onError);
      }
    } catch (error) {
      message(tournamentError(error));
    }
  });
  if (!testMode) watch();
}

initialise().catch(error => message(tournamentError(error)));
