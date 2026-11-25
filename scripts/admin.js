(function () {
  "use strict";
  const DEFAULT_MATCH_TIME = "18:30";
  const pendingDeletions = new Set();

  const state = {
    user: null,
    fixtures: [],
    results: [],
    players: [],
    linkedPlayerKeys: new Set(),
    finePayments: [],
    playerPhotos: {},
    adminRequests: [],
    activeTab: "fixtures",
    editor: null,
    pickTeamArchived: new Set(),
    pickTeamLinkTarget: ""
  };

  const gate = document.getElementById("adminGate");
  const app = document.getElementById("adminApp");
  const overlay = document.getElementById("adminEditorOverlay");
  const form = document.getElementById("adminEditorForm");
  const title = document.getElementById("adminEditorTitle");
  const typeLabel = document.getElementById("adminEditorType");
  const toast = document.getElementById("adminToast");

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message, error = false) {
    toast.textContent = message;
    toast.style.background = error ? "#842f38" : "#126b5d";
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 3500);
  }

  function rowFor(item) {
    return item?.sheetRow && typeof item.sheetRow === "object" ? item.sheetRow : {};
  }

  function playerValue(row, index) {
    return row[`Player${index}`] ?? row[`Player ${index}`] ?? "";
  }

  function playerPhoto(profile) {
    const stored = clean(profile.photoUrl || profile.photo);
    if (stored && !/^\/?images\/players\//i.test(stored)) return stored;
    const key = window.PlayerData?.photoKey?.(profile.publicName) || "";
    return state.playerPhotos[key] || "images/default.jpg";
  }

  function dateValue(value) {
    const text = clean(value).replace(/(\d+)(st|nd|rd|th)/i, "$1");
    let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12).getTime();
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).getTime();
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function inputDate(value) {
    const text = clean(value).replace(/(\d+)(st|nd|rd|th)/i, "$1");
    let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return text;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return "";
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${parsed.getFullYear()}-${month}-${day}`;
  }

  function resultDate(value) {
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : clean(value);
  }

  function ordinal(number) {
    const n = Number(number);
    const ending = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    return `${n}${ending}`;
  }

  function fixtureDate(value) {
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return clean(value);
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    return `${ordinal(date.getDate())} ${date.toLocaleString("en-GB", { month: "short" })} ${date.getFullYear()}`;
  }

  function dayName(value) {
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
      .toLocaleString("en-GB", { weekday: "long" });
  }

  function numericOrBlank(value) {
    const text = clean(value);
    if (!text) return "";
    const number = Number(text);
    return Number.isNaN(number) ? text : number;
  }

  function normaliseTeam(value) {
    const name = clean(value).toLowerCase().replace(/&/g, "and").replace(/[’']/g, "").replace(/\s+/g, " ");
    return name === "dogs no more" ? "bb kings" : name;
  }

  function fixtureHasResult(item) {
    const fixture = rowFor(item);
    if (fixture.EventType === "social") return false;
    const fixtureDate = inputDate(fixture.Date);
    const away = clean(fixture.HA).toLowerCase() === "away";
    const expectedHome = away ? fixture.Opponent : "Oche Ness Monsters";
    const expectedAway = away ? "Oche Ness Monsters" : fixture.Opponent;
    return state.results.some(resultItem => {
      const result = rowFor(resultItem);
      return inputDate(result.Date) === fixtureDate &&
        normaliseTeam(result.HomeTeam) === normaliseTeam(expectedHome) &&
        normaliseTeam(result.AwayTeam) === normaliseTeam(expectedAway);
    });
  }

  function fixtureTitle(row) {
    if (row.EventType === "social") return row.Opponent || "Social event";
    const side = clean(row.HA).toLowerCase() === "away" ? "A" : clean(row.HA).toLowerCase() === "neutral" ? "N" : "H";
    return `${row.Opponent || "Opponent TBA"} (${side})`;
  }

  function resultOutcome(row) {
    const explicit = clean(row.Result).toLowerCase();
    if (explicit.startsWith("won") || explicit === "win" || explicit === "w") return "win";
    if (explicit.startsWith("lost") || explicit === "loss" || explicit === "l") return "loss";
    if (explicit.startsWith("draw") || explicit === "d") return "draw";
    const home = Number(row.HomeScore);
    const away = Number(row.AwayScore);
    if (!Number.isFinite(home) || !Number.isFinite(away)) return "";
    const onmHome = normaliseTeam(row.HomeTeam) === "oche ness monsters";
    const ourScore = onmHome ? home : away;
    const theirScore = onmHome ? away : home;
    return ourScore > theirScore ? "win" : ourScore < theirScore ? "loss" : "draw";
  }

  function matchTable(entries, nextId) {
    const rows = entries.map(({ item, type }) => {
      const isResult = type === "result";
      const isNext = !isResult && item.id === nextId;
      const row = rowFor(item);
      const home = normaliseTeam(row.HomeTeam) === "oche ness monsters";
      const opponent = isResult ? (home ? row.AwayTeam : row.HomeTeam) : row.Opponent;
      const side = isResult ? (home ? "H" : "A") : (clean(row.HA).toLowerCase() === "away" ? "A" : clean(row.HA).toLowerCase() === "neutral" ? "N" : "H");
      const outcome = isResult ? resultOutcome(row) : "";
      const score = isResult && clean(row.HomeScore) !== "" && clean(row.AwayScore) !== ""
        ? `${row.HomeScore} - ${row.AwayScore}` : "—";
      const timestamp = dateValue(row.Date);
      const date = timestamp ? new Date(timestamp) : null;
      const prettyDate = date ? `${ordinal(date.getDate())} ${date.toLocaleString("en-GB", { month: "short" })}` : "Date TBA";
      return `<tr class="adminMatchRow--${type}"${isNext ? ' data-next-fixture="true"' : ""}>
        <td>${escapeHtml((isResult ? row.Competition : row.League) || "Competition TBA")}</td>
        <td><span class="adminOpponent">${escapeHtml(opponent || "Opponent TBA")}</span> <span class="adminSide">(${side})</span>${isNext ? ' <span class="adminNextFixture">Next</span>' : ""}</td>
        <td><time datetime="${escapeHtml(inputDate(row.Date))}" title="${escapeHtml(row.Date)}">${escapeHtml(prettyDate)}</time></td>
        <td>${isResult ? `<span class="adminScoreBox ${escapeHtml(outcome)}" aria-label="${escapeHtml(outcome || "Result")} ${escapeHtml(score)}">${escapeHtml(score)}</span>` : '<span class="adminPending">—</span>'}</td>
        <td><div class="adminRowActions"><button class="adminSmallBtn" type="button" data-edit-${type}="${escapeHtml(item.id)}">${!isResult && row.EventType !== "social" ? "Edit / pick team" : `Edit ${type}`}</button><button class="adminSmallBtn danger" type="button" data-delete-${type}="${escapeHtml(item.id)}">Delete</button></div></td>
      </tr>`;
    }).join("");
    return `<div class="adminTableScroll adminMatchTimeline" tabindex="0" role="region" aria-label="Fixtures and results">
      <table class="adminMatchTable"><caption class="adminVisuallyHidden">Fixtures and results</caption><thead><tr><th scope="col">League</th><th scope="col">Opponent</th><th scope="col">Date</th><th scope="col">Result</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }

  function filtered(items, seasonId, searchId, haystack) {
    const season = document.getElementById(seasonId).value;
    const query = clean(document.getElementById(searchId).value).toLowerCase();
    return items.filter(item => {
      const seasonMatches = season === "all" || item.season === season;
      return seasonMatches && (!query || haystack(item).toLowerCase().includes(query));
    });
  }

  function centreNextFixture() {
    const scroll = document.querySelector(".adminMatchTimeline");
    if (!scroll?.clientHeight) return;
    const next = scroll.querySelector("[data-next-fixture]");
    if (!next) {
      scroll.scrollTop = scroll.scrollHeight;
      return;
    }
    const row = next.getBoundingClientRect();
    const viewport = scroll.getBoundingClientRect();
    scroll.scrollTop += row.top + row.height / 2 - viewport.top - scroll.clientHeight / 2;
  }

  function renderFixtures({ centre = false } = {}) {
    const list = document.getElementById("fixturesList");
    const previousScroll = list.querySelector(".adminMatchTimeline")?.scrollTop ?? 0;
    const fixtures = filtered(state.fixtures, "fixtureSeasonFilter", "fixtureSearch", item => {
      const row = rowFor(item);
      return `${row.Opponent || ""} ${row.League || ""} ${row.Location || ""}`;
    }).filter(item => !fixtureHasResult(item));
    const results = filtered(state.results, "fixtureSeasonFilter", "fixtureSearch", item => {
      const row = rowFor(item);
      return `${row.HomeTeam || ""} ${row.AwayTeam || ""} ${row.Competition || ""} ${Array.from({ length: 12 }, (_, index) => playerValue(row, index + 1)).join(" ")}`;
    });
    const entries = [
      ...fixtures.map(item => ({ item, type: "fixture" })),
      ...results.map(item => ({ item, type: "result" }))
    ].sort((a, b) => dateValue(rowFor(a.item).Date) - dateValue(rowFor(b.item).Date));

    if (!entries.length) {
      list.innerHTML = '<div class="adminEmpty">No fixtures or results match these filters.</div>';
      return;
    }
    const fixtureIds = new Set(fixtures.map(item => item.id));
    const next = upcomingTeamFixtures().find(item => fixtureIds.has(item.id));
    list.innerHTML = matchTable(entries, next?.id);
    if (centre) centreNextFixture();
    else list.querySelector(".adminMatchTimeline").scrollTop = previousScroll;
  }

  function playerFineAccount(player, season = "26-27") {
    let issued = 0;
    state.results.filter(item => item.season === season).forEach(item => {
      const row = rowFor(item);
      for (let index = 1; index <= 12; index++) {
        if (clean(playerValue(row, index)).toLowerCase() !== clean(player.publicName).toLowerCase()) continue;
        const amount = Number(clean(row[`F${index}`] ?? row[`F ${index}`]).replace(/[£,\s]/g, ""));
        if (Number.isFinite(amount) && amount > 0) issued += Math.round(amount * 100);
      }
    });
    const paid = Number(finePaymentFor(player.playerKey, season));
    return { issued, paid, owed: issued - paid };
  }

  function hasPlayedMatch(player, results = state.results) {
    const normal = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
    const names = new Set([player.publicName, player.fullName].filter(Boolean).map(normal));
    return results.filter(item => item.season === "26-27").some(item => Array.from({ length: 12 }, (_, index) => playerValue(rowFor(item), index + 1)).some(name => names.has(normal(name))));
  }

  const appearanceNameKey = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");

  function seasonAppearances(season) {
    const appearances = new Map();
    state.results.filter(item => item.season === season).forEach(item => {
      const names = new Set(Array.from({ length: 12 }, (_, index) =>
        appearanceNameKey(playerValue(rowFor(item), index + 1))).filter(Boolean));
      names.forEach(name => appearances.set(name, (appearances.get(name) || 0) + 1));
    });
    return appearances;
  }

  function upcomingTeamFixtures() {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
    return state.fixtures.filter(item => {
      const row = rowFor(item);
      const date = inputDate(row.Date);
      return date && date >= today && row.EventType !== "social" &&
        !/cancelled|canceled|postponed/i.test(`${row.League} ${row.Opponent} ${row.Location}`) && !fixtureHasResult(item);
    }).sort((a, b) => {
      const first = rowFor(a);
      const second = rowFor(b);
      return inputDate(first.Date).localeCompare(inputDate(second.Date)) ||
        clean(first.Time).localeCompare(clean(second.Time)) || clean(first.Opponent).localeCompare(clean(second.Opponent));
    });
  }

  async function savePickedTeam(fixture, names, { captain, override }) {
    const { db, firestoreSdk } = await window.ONMFirebase.ready;
    const lineup = Object.fromEntries(Array.from({ length: 12 }, (_, index) =>
      [`Player${index + 1}`, names[index] || ""]));
    lineup.Captain = names.includes(captain) ? captain : "";
    lineup.CaptainOverride = names.includes(override) ? override : "";
    const updates = Object.fromEntries(Object.entries(lineup).map(([slot, name]) => [`sheetRow.${slot}`, name]));
    await firestoreSdk.updateDoc(firestoreSdk.doc(db, "fixtures", fixture.id), {
      ...updates, updatedBy: state.user.uid, updatedAt: firestoreSdk.serverTimestamp()
    });
    const local = state.fixtures.find(item => item.id === fixture.id);
    if (local) local.sheetRow = { ...rowFor(local), ...lineup };
  }

  function renderPlayers() {
    const accounts = state.players.map(player => playerFineAccount(player));
    document.getElementById("totalFinesCollected").textContent = currencyForToast(
      state.finePayments.filter(item => item.season === "26-27").reduce((sum, item) => sum + Number(item.amountPaidPence || 0), 0));
    document.getElementById("totalFinesOwed").textContent = currencyForToast(accounts.reduce((sum, item) => sum + Math.max(0,item.owed), 0));
    const registered = state.players.filter(player => player.registrationPaidSeasons?.includes("26-27")).length;
    document.getElementById("totalRegistrationsCollected").textContent = currencyForToast(registered * 1500);
    document.getElementById("totalRegistrationsCount").textContent = `${registered} players × £15 · 2026/27`;
    document.getElementById("totalActivePlayers").textContent = state.players.filter(player => hasPlayedMatch(player)).length;
    const list = document.getElementById("playersList");
    const query = clean(document.getElementById("playerSearch").value).toLowerCase();
    const appearances = seasonAppearances("26-27");
    const played = player => appearances.get(appearanceNameKey(player.publicName)) || 0;
    const registration = document.getElementById("playerRegistrationFilter").value;
    const account = document.getElementById("playerAccountFilter").value;
    const fines = document.getElementById("playerFinesFilter").value;
    const players = state.players
      .filter(player => {
        return document.getElementById("playerListView").value === "all" || hasPlayedMatch(player);
      })
      .filter(player => {
        const paid = player.registrationPaidSeasons?.includes("26-27");
        const linked = state.linkedPlayerKeys.has(player.playerKey);
        const balance = playerFineAccount(player);
        return (registration === "all" || (registration === "paid") === Boolean(paid))
          && (account === "all" || (account === "linked") === linked)
          && (fines === "all" || fines === "owed" && balance.owed > 0
            || fines === "paid" && balance.paid > 0 && balance.owed <= 0
            || fines === "part" && balance.paid > 0 && balance.owed > 0
            || fines === "none" && balance.issued === 0 && balance.paid === 0);
      })
      .filter(player => !query || `${player.fullName || ""} ${player.publicName || ""} ${player.nickname || ""} ${player.role || ""}`.toLowerCase().includes(query))
      .sort((a, b) => played(b) - played(a) || clean(a.publicName).localeCompare(clean(b.publicName)));
    if (!players.length) {
      list.innerHTML = '<div class="adminEmpty">No players match this search.</div>';
      return;
    }
    list.innerHTML = `<div class="adminTableScroll"><table class="adminMatchTable adminPlayersTable"><caption class="adminVisuallyHidden">Players and fines, most appearances first, 2026/27</caption><thead><tr><th scope="col"><span class="adminVisuallyHidden">Photo</span></th><th scope="col">Name</th><th scope="col"><span class="desktopLabel">Appearances</span><span class="mobileLabel">Apps</span></th><th scope="col"><span class="desktopLabel">Registration</span><span class="mobileLabel">Reg</span></th><th scope="col"><span class="desktopLabel">Account linked</span><span class="mobileLabel">Link</span></th><th scope="col">Fines owed</th><th scope="col">Paid</th><th scope="col"><span class="adminVisuallyHidden">Actions</span></th></tr></thead><tbody>${players.map(player => {
      const paid = player.registrationPaidSeasons?.includes("26-27");
      const balance = playerFineAccount(player);
      const linked = state.linkedPlayerKeys.has(player.playerKey);
      const fullName = clean(player.fullName || player.publicName) || "Unnamed player";
      const nickname = clean(player.nickname);
      return `<tr>
        <td class="adminPlayerThumb"><img src="${escapeHtml(playerPhoto(player))}" alt=""></td>
        <td class="adminPlayerName${played(player) === 0 ? " hasNoAppearances" : ""}"><strong>${escapeHtml(fullName)}</strong>${nickname ? `<small>${escapeHtml(nickname)}</small>` : ""}</td>
        <td class="adminPlayerAppearances"><strong>${played(player)}</strong></td>
        <td><button class="adminRegistrationButton ${paid ? "isPaid" : "isOutstanding"}" type="button" data-toggle-player-registration="${escapeHtml(player.playerKey)}" data-registration-paid="${paid ? "false" : "true"}" aria-label="${paid ? "Registration paid. Mark unpaid" : "Registration outstanding. Mark £15 registration paid"}" title="${paid ? "Mark registration unpaid" : "Mark £15 registration paid"}"><span class="desktopLabel" aria-hidden="true">${paid ? "Paid" : "Outstanding"}</span><span class="mobileLabel" aria-hidden="true">${paid ? "✓" : "✕"}</span></button></td>
        <td><span class="adminLinkStatus ${linked ? "isLinked" : "isUnlinked"}"><span class="desktopLabel">${linked ? "Linked" : "Not linked"}</span><span class="mobileLabel" aria-hidden="true">${linked ? "✓" : "✕"}</span><span class="adminVisuallyHidden mobileLabel">${linked ? "Account linked" : "Account not linked"}</span></span></td>
        <td class="adminFineOwed ${balance.owed<0?'fineCredit':''}">${balance.owed<0?`+${currencyForToast(-balance.owed)} credit`:currencyForToast(balance.owed)}</td>
        <td>${currencyForToast(balance.paid)}</td>
        <td class="adminPlayerEdit"><button class="adminSmallBtn" type="button" data-edit-player="${escapeHtml(player.playerKey)}">Edit</button></td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function finePaymentFor(playerKey, season) {
    return state.finePayments.find(item => item.playerKey === playerKey && item.season === season)?.amountPaidPence || 0;
  }

  function renderFines() {
    const season = document.getElementById("finesSeasonFilter").value;
    const query = clean(document.getElementById("finesSearch").value).toLowerCase();
    const totals = new Map();
    state.results.filter(item => season === "all" || item.season === season).forEach(item => {
      const row = rowFor(item);
      for (let index = 1; index <= 12; index += 1) {
        const name = clean(playerValue(row, index));
        if (!name) continue;
        const key = name.toLowerCase().replace(/\s+/g, " ");
        const amount = Number(clean(row[`F${index}`] ?? row[`F ${index}`]).replace(/[£,\s]/g, ""));
        const pence = Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
        const profile = state.players.find(player => clean(player.publicName).toLowerCase().replace(/\s+/g, " ") === key);
        if (!totals.has(key)) totals.set(key, { name, playerKey: profile?.playerKey || key.replace(/[^a-z0-9]+/g, "-"), pence: 0, matches: new Set() });
        const total = totals.get(key);
        total.pence += pence;
        total.matches.add(item.id);
      }
    });
    const players = [...totals.values()]
      .map(player => {
        const paidPence = season === "all"
          ? state.finePayments.filter(item => item.playerKey === player.playerKey).reduce((sum, item) => sum + Number(item.amountPaidPence || 0), 0)
          : Number(finePaymentFor(player.playerKey, season));
        return { ...player, paidPence, outstandingPence: player.pence - paidPence };
      })
      .filter(player => player.name.toLowerCase().includes(query))
      .sort((a, b) => b.outstandingPence - a.outstandingPence || a.name.localeCompare(b.name));
    const currency = pence => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
    document.getElementById("finesTotal").textContent = currency(players.reduce((sum, player) => sum + Math.max(0,player.outstandingPence), 0));
    document.getElementById("finesList").innerHTML = players.length
      ? `<div class="adminTableScroll"><table class="adminMatchTable adminFinesTable"><caption class="adminVisuallyHidden">Player fines and payments</caption><thead><tr><th scope="col">Player</th><th scope="col">Matches</th><th scope="col">Fines</th><th scope="col">Paid</th><th scope="col">Outstanding</th><th scope="col">Record payment</th></tr></thead><tbody>${players.map(player => `<tr><td>${escapeHtml(player.name)}</td><td>${player.matches.size}</td><td>${currency(player.pence)}</td><td>${currency(player.paidPence)}</td><td class="${player.outstandingPence>0 ? "fineOutstanding" : player.outstandingPence<0 ? "fineCredit" : "fineClear"}">${player.outstandingPence<0?`+${currency(-player.outstandingPence)} credit`:currency(player.outstandingPence)}</td><td>${season === "all" ? '<span class="adminPending">Choose a season</span>' : `<div class="adminFinePayment"><label class="adminVisuallyHidden" for="fine-payment-${escapeHtml(player.playerKey)}">Payment from ${escapeHtml(player.name)}</label><span>£</span><input id="fine-payment-${escapeHtml(player.playerKey)}" type="number" min="0.01" step="0.01" placeholder="0.00" data-fine-payment-input="${escapeHtml(player.playerKey)}"><button class="adminSmallBtn" type="button" data-record-fine-payment="${escapeHtml(player.playerKey)}" data-player-name="${escapeHtml(player.name)}" data-outstanding-pence="${player.outstandingPence}">Add payment</button></div>`}</td></tr>`).join("")}</tbody></table></div>`
      : '<div class="adminEmpty">No player fines match these filters.</div>';
  }

  async function loadAdminRequests() {
    if (!["owner", "admin"].includes(state.user.role)) return;
    const list = document.getElementById("adminRequestsList");
    list.innerHTML = '<div class="adminEmpty">Loading site accounts…</div>';
    try {
      const { db, firestoreSdk } = await window.ONMFirebase.ready;
      const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, "users"));
      state.adminRequests = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      renderAdminRequests();
    } catch (error) {
      list.innerHTML = '<div class="adminEmpty">Could not load accounts. Try Refresh accounts.</div>';
      showToast(error.message || "Could not load accounts.", true);
    }
  }

  function renderAdminRequests() {
    const query = clean(document.getElementById("accountSearch").value).toLowerCase();
    const accounts = state.adminRequests.filter(user => `${user.firstName || ""} ${user.surname || ""} ${user.email || ""}`.toLowerCase().includes(query))
      .sort((a, b) => clean(a.firstName || a.email).localeCompare(clean(b.firstName || b.email)));
    document.getElementById("adminRequestsTab").textContent = `Accounts (${state.adminRequests.length})`;
    document.getElementById("adminRequestsList").innerHTML = accounts.length
      ? `<div class="adminTableScroll"><table class="adminMatchTable"><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Player</th><th>Status</th><th>Access</th><th>Admin access</th><th>Player link</th></tr></thead><tbody>${accounts.map(user => `<tr>
        <td>${escapeHtml(`${user.firstName || ""} ${user.surname || ""}`.trim() || "Unnamed")}</td>
        <td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.accountType || "player")}</td>
        <td>${escapeHtml(user.linkedPlayerName || "Not linked")}</td><td>${escapeHtml(user.status)}</td><td>${escapeHtml(user.role || "member")}</td>
        <td><div class="adminRowActions">${state.user.role !== "owner" ? "—" : user.role === "owner" ? "Site owner" : user.role === "admin" ? `<button class="adminSmallBtn" type="button" data-review-admin="${escapeHtml(user.id)}" data-decision="rejected">Remove admin</button>` : user.role === "member" && user.status === "Active" ? `<button class="adminSmallBtn" type="button" data-review-admin="${escapeHtml(user.id)}" data-decision="approved">Assign as admin</button>` : "—"}</div></td>
        <td>${accountPlayerControl(user)}</td></tr>`).join("")}</tbody></table></div>`
      : '<div class="adminEmpty">No accounts match this search.</div>';
  }

  function accountPlayerControl(user) {
    if (user.role === "owner" && state.user.role !== "owner") return "—";
    return `<button type="button" class="adminSmallBtn" data-link-account="${escapeHtml(user.id)}">${user.linkedPlayerKey ? "Change link" : "Link player"}</button>`;
  }

  function openAccountLinker(button) {
    const user = state.adminRequests.find(account => account.id === button.dataset.linkAccount);
    if (!user || (user.role === "owner" && state.user.role !== "owner")) return;
    state.editor = { type: "accountLink", id: user.id, expectedPlayerKey: user.linkedPlayerKey || "" };
    typeLabel.textContent = "Oche Ness Monsters";
    title.textContent = "Link player account";
    const preferredPlayer = user.linkedPlayerKey || state.pickTeamLinkTarget;
    state.pickTeamLinkTarget = "";
    const options = [...state.players].sort((a, b) => clean(a.fullName || a.publicName).localeCompare(clean(b.fullName || b.publicName))).map(player => {
      const key = player.playerKey || player.id;
      const taken = state.adminRequests.some(account => account.id !== user.id && account.linkedPlayerKey === key);
      return `<option value="${escapeHtml(key)}"${preferredPlayer === key && !taken ? " selected" : ""}${taken ? " disabled" : ""}>${escapeHtml(player.fullName || player.publicName)}${taken ? " (already linked)" : ""}</option>`;
    }).join("");
    form.innerHTML = `<p>${escapeHtml(`${user.firstName || ""} ${user.surname || ""}`.trim() || user.email)}${user.email ? ` · ${escapeHtml(user.email)}` : ""}</p>
      <p>${escapeHtml(user.linkedPlayerName ? `Currently linked to ${user.linkedPlayerName}. Saving will replace this link.` : "Choose their Monsters player profile, or create one below.")}</p>
      <label>Link to<select name="linkMode"><option value="existing">Existing Monster</option><option value="new">Create new Monster</option></select></label>
      <fieldset id="existingMonsterFields" class="adminGrid"><label class="wide">Monster player<select name="playerKey" required><option value="">Choose a Monster…</option>${options}</select></label></fieldset>
      <fieldset id="newMonsterFields" class="adminGrid" hidden disabled><label>Full name<input name="monsterFullName" maxlength="120" required value="${escapeHtml(`${user.firstName || ""} ${user.surname || ""}`.trim())}"></label><label>Display name<input name="monsterPublicName" maxlength="80" required placeholder="e.g. Phil L"></label><p class="wide">No appearances needed. Starts with no match records or registration payment recorded.</p></fieldset>
      <p id="accountLinkError" role="alert"></p><div class="adminFormActions"><button class="btn btnGhost" type="button" data-cancel-editor>Cancel</button><button class="btn btnPrimary" type="submit">Link player</button></div>`;
    form.elements.linkMode.addEventListener("change", () => {
      const creating = form.elements.linkMode.value === "new";
      for (const [id, enabled] of [["newMonsterFields", creating], ["existingMonsterFields", !creating]]) {
        const fields = document.getElementById(id);
        fields.hidden = !enabled;
        fields.disabled = !enabled;
      }
      form.querySelector('[type="submit"]').textContent = creating ? "Create & link Monster" : "Link player";
    });
    showEditor();
  }

  let accountLinkFunctions;
  async function saveAccountLink(data) {
      const creating = data.get("linkMode") === "new";
      const accountId = state.editor.id;
      const payload = { accountId, expectedPlayerKey: state.editor.expectedPlayerKey,
        ...(creating ? { newPlayer: { fullName: clean(data.get("monsterFullName")), publicName: clean(data.get("monsterPublicName")) } } : { playerKey: clean(data.get("playerKey")) }) };
      const { app } = await window.ONMFirebase.ready;
      accountLinkFunctions ||= import("https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js");
      const sdk = await accountLinkFunctions;
      const { data: result } = await sdk.httpsCallable(sdk.getFunctions(app, "europe-west2"), "linkAccountToPlayer")(payload);
      if (result.player) state.players.push({ ...result.player, id: result.player.playerKey });
      state.adminRequests = state.adminRequests.map(user => user.id === accountId ? { ...user, linkedPlayerKey: result.linkedPlayerKey, linkedPlayerName: result.linkedPlayerName, accountType: "player" } : user);
      renderAdminRequests();
      state.linkedPlayerKeys = new Set(state.adminRequests.map(user => user.linkedPlayerKey).filter(Boolean));
      renderPlayers();
  }

  async function reviewAdminRequest(button) {
    if (state.user.role !== "owner") return;
    const uid = button.dataset.reviewAdmin;
    const decision = button.dataset.decision;
    if (!["approved", "rejected"].includes(decision)) return;
    const account = state.adminRequests.find(user => user.id === uid);
    if (!account || !window.confirm(`${decision === "approved" ? "Grant admin access to" : "Remove admin access from"} ${account.email || account.firstName}?`)) return;
    const buttons = button.closest(".adminRowActions").querySelectorAll("button");
    buttons.forEach(item => { item.disabled = true; });
    try {
      const { db, firestoreSdk } = await window.ONMFirebase.ready;
      const ref = firestoreSdk.doc(db, "users", uid);
      await firestoreSdk.runTransaction(db, async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error("That account no longer exists.");
        const user = snapshot.data();
        if (user.role !== (decision === "approved" ? "member" : "admin") || user.status !== "Active") {
          throw new Error("That account has changed. Refresh accounts and try again.");
        }
        transaction.update(ref, {
          role: decision === "approved" ? "admin" : "member",
          adminRequestStatus: decision,
          adminReviewedBy: state.user.uid,
          adminReviewedAt: firestoreSdk.serverTimestamp()
        });
      });
      state.adminRequests = state.adminRequests.map(user => user.id === uid ? { ...user, role: decision === "approved" ? "admin" : "member" } : user);
      renderAdminRequests();
      showToast(decision === "approved" ? "Admin access assigned." : "Admin access removed.");
    } catch (error) {
      showToast(error.message || "Could not update account access.", true);
      buttons.forEach(item => { item.disabled = false; });
    }
  }

  function selectOptions(selected) {
    return ["26-27", "25-26", "24-25"].map(value =>
      `<option value="${value}"${value === selected ? " selected" : ""}>${value.replace("-", "/")}</option>`
    ).join("");
  }

  function fixtureLineupFields(row) {
    const roster = state.players
      .filter(player => clean(player.publicName))
      .sort((a, b) => clean(a.publicName).localeCompare(clean(b.publicName)));
    const fields = Array.from({ length: 12 }, (_, index) => {
      const slot = index + 1;
      const selected = clean(row[`Player${slot}`]);
      const options = roster.map(player => {
        const name = clean(player.publicName);
        const label = player.fullName && player.fullName !== name ? `${name} · ${player.fullName}` : name;
        return `<option value="${escapeHtml(name)}"${name === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
      }).join("");
      const previous = selected && !roster.some(player => clean(player.publicName) === selected)
        ? `<option selected>${escapeHtml(selected)}</option>` : "";
      return `<label>Player ${slot}<select name="lineupPlayer${slot}"><option value="">Unselected</option>${previous}${options}</select></label>`;
    });
    const expanded = fields.slice(6).some((_, index) => clean(row[`Player${index + 7}`]));
    return `<fieldset class="wide adminFixtureLineup" data-match-field>
      <legend>Pick the team</legend>
      <p>Save your lineup with the fixture. For Banks and Trafalgar matches, the Match tracker fills in these names and lets you make late swaps.</p>
      <div class="adminGrid">${fields.slice(0, 6).join("")}</div>
      <details${expanded ? " open" : ""}>
        <summary>Additional players</summary>
        <div class="adminGrid">${fields.slice(6).join("")}</div>
      </details>
    </fieldset>`;
  }

  function openFixtureEditor(item = null) {
    const row = rowFor(item);
    state.editor = { type: "fixture", id: item?.id || null };
    typeLabel.textContent = "Fixture";
    title.textContent = item ? "Edit fixture" : "Add fixture";
    form.innerHTML = `<div class="adminGrid">
      <label>Type<select name="eventType"><option value="fixture">Match fixture</option><option value="social"${row.EventType === "social" ? " selected" : ""}>Social event</option></select></label>
      <label>Season<select name="season" required>${selectOptions(item?.season || document.getElementById("fixtureSeasonFilter").value || "26-27")}</select></label>
      <label>Date<input name="date" type="date" required value="${escapeHtml(inputDate(row.Date))}"></label>
      <label data-match-field>Competition<input name="league" required value="${escapeHtml(row.League)}" placeholder="Banks League"></label>
      <label><span id="fixtureNameLabel">Opponent</span><input name="opponent" required value="${escapeHtml(row.Opponent)}"></label>
      <label data-match-field>Home or away<select name="ha"><option${row.HA === "Home" ? " selected" : ""}>Home</option><option${row.HA === "Away" ? " selected" : ""}>Away</option><option${row.HA === "Neutral" ? " selected" : ""}>Neutral</option></select></label>
      <label>Time<input name="time" type="time" value="${escapeHtml(clean(row.Time) || DEFAULT_MATCH_TIME)}"></label>
      <label class="wide">Venue<input name="location" value="${escapeHtml(row.Location)}"></label>
      <label class="wide" data-social-field>Details<textarea name="eventDetails" maxlength="2000">${escapeHtml(row.EventDetails || "")}</textarea></label>
      ${fixtureLineupFields(row)}
    </div>
    <div class="adminFormActions">
      ${item?.id ? `<button class="btn btnGhost adminDeleteFixture" type="button" data-delete-fixture="${escapeHtml(item.id)}">Delete fixture</button>` : ""}
      <button class="btn btnGhost" type="button" data-cancel-editor>Cancel</button>
      <button class="btn btnPrimary" type="submit">Save fixture</button>
    </div>`;
    const updateEventFields = () => {
      const social = form.elements.eventType.value === "social";
      form.querySelectorAll("[data-match-field]").forEach(label => { label.style.display = social ? "none" : ""; });
      form.querySelector("[data-social-field]").style.display = social ? "" : "none";
      form.elements.league.required = !social;
      document.getElementById("fixtureNameLabel").textContent = social ? "Event name" : "Opponent";
      title.textContent = `${item ? "Edit" : "Add"} ${social ? "social event" : "fixture"}`;
    };
    form.elements.eventType.addEventListener("change", updateEventFields);
    updateEventFields();
    showEditor();
  }

  function playerInputs(row) {
    return Array.from({ length: 12 }, (_, offset) => {
      const index = offset + 1;
      return `<div class="adminPlayerRow">
        <label>Player ${index}<input name="player${index}" value="${escapeHtml(playerValue(row, index))}"></label>
        <label>Checkouts<input name="c${index}" type="number" min="0" step="1" value="${escapeHtml(row[`C${index}`])}"></label>
        <label>Fine £<input name="f${index}" type="number" min="0" step="0.01" value="${escapeHtml(row[`F${index}`])}"></label>
        <label class="doubleFine">Double fine<input name="d${index}" type="checkbox"${[true, "true", "yes", "TRUE", "Yes"].includes(row[`D${index}`]) ? " checked" : ""}></label>
        <label>180s<input name="o${index}" type="number" min="0" step="1" value="${escapeHtml(row[`O${index}`])}"></label>
        <label>Bulls<input name="b${index}" type="number" min="0" step="1" value="${escapeHtml(row[`B${index}`])}"></label>
        <label>Ton outs<input name="t${index}" type="number" min="0" step="1" value="${escapeHtml(row[`T${index}`])}"></label>
      </div>`;
    }).join("");
  }

  function openResultEditor(item = null) {
    const row = rowFor(item);
    state.editor = { type: "result", id: item?.id || null };
    typeLabel.textContent = "Result";
    title.textContent = item ? "Edit result" : "Add result";
    form.innerHTML = `<div class="adminGrid">
      <label>Season<select name="season" required>${selectOptions(item?.season || document.getElementById("fixtureSeasonFilter").value || "26-27")}</select></label>
      <label>Date<input name="date" type="date" required value="${escapeHtml(inputDate(row.Date))}"></label>
      <label class="wide">Competition<input name="competition" required value="${escapeHtml(row.Competition)}"></label>
      <label>Home team<input name="homeTeam" required value="${escapeHtml(row.HomeTeam)}"></label>
      <label>Away team<input name="awayTeam" required value="${escapeHtml(row.AwayTeam)}"></label>
      <label>Home score<input name="homeScore" type="number" min="0" value="${escapeHtml(row.HomeScore)}"></label>
      <label>Away score<input name="awayScore" type="number" min="0" value="${escapeHtml(row.AwayScore)}"></label>
      <label>Result<input name="result" value="${escapeHtml(row.Result)}" placeholder="Win, Loss or Draw"></label>
      <label>Venue<input name="venue" value="${escapeHtml(row.Venue)}"></label>
      <label>Stage<input name="stage" value="${escapeHtml(row.Stage)}"></label>
      <label class="adminCheckbox">Cup match<input name="cup" type="checkbox"${[true, "true", "yes", "TRUE", "Yes"].includes(row["Cup?"]) ? " checked" : ""}></label>
      <label>Home points<input name="homePoints" type="number" min="0" value="${escapeHtml(row.HomePoints)}"></label>
      <label>Away points<input name="awayPoints" type="number" min="0" value="${escapeHtml(row.AwayPoints)}"></label>
      <label class="wide">Image folder or image URLs<textarea name="imageFolder" rows="3">${escapeHtml(row.IMGFOLDER)}</textarea></label>
    </div>
    <h3 class="adminPlayersTitle">Players and fines</h3>
    ${playerInputs(row)}
    <div class="adminFormActions">
      <button class="btn btnGhost" type="button" data-cancel-editor>Cancel</button>
      <button class="btn btnPrimary" type="submit">Save result</button>
    </div>`;
    showEditor();
  }

  function openPlayerEditor(player) {
    if (!player) return;
    state.editor = { type: "player", id: player.playerKey };
    typeLabel.textContent = "Player profile";
    title.textContent = `Edit ${player.publicName}`;
    form.innerHTML = `<div class="adminPhotoEditRow wide">
      <img id="adminPlayerPhotoPreview" class="adminPlayerPhotoPreview" src="${escapeHtml(playerPhoto(player))}" alt="${escapeHtml(player.publicName)}">
      <label>Replace photo<input name="photoFile" type="file" accept="image/jpeg,image/png,image/webp"><span class="adminFieldHelp">The original Drive photo remains the default until you upload a replacement.</span></label>
    </div>
    <div class="adminGrid">
      <label>Full name<input name="fullName" maxlength="120" value="${escapeHtml(player.fullName || player.publicName)}" required></label>
      <label>Shortened name<input name="publicName" maxlength="80" value="${escapeHtml(player.publicName)}" required><span class="adminFieldHelp">Corrections also update previous match results.</span></label>
      <label>Nickname<input name="nickname" maxlength="80" value="${escapeHtml(player.nickname)}"></label>
      <label>Club role<input name="role" maxlength="50" value="${escapeHtml(player.role)}"></label>
      <label>Highest checkout<input name="highestCheckout" type="number" min="0" max="170" value="${escapeHtml(player.highestCheckout)}"></label>
      <label>Walkout song link<input name="song" type="url" maxlength="500" value="${escapeHtml(player.song)}"></label>
      <fieldset class="wide"><legend>Accolades</legend>${Object.entries({guthrie_cup_winner_25_26:"Guthrie Cup winner 2025/26",banks_winner_24_25:"Banks Div 2 winner 2024/25",alex_beckett_winner_25:"Alex Beckett winner 2024/25",mpl_winner_25:"MPL winner 2025"}).map(([key,label])=>`<label class="adminCheckbox"><input type="checkbox" name="accoladeKey" value="${key}"${(player.accolades||[]).includes(key)?" checked":""}>${label}</label>`).join("")}</fieldset>
      <label class="wide">Bio<textarea name="bio" rows="5" maxlength="1000">${escapeHtml(player.bio)}</textarea></label>
      <label class="adminCheckbox">Gooch<input name="gooch" type="checkbox"${[true, "yes", "true"].includes(player.gooch) ? " checked" : ""}></label>
      <label class="adminCheckbox">Visible on website<input name="profileVisible" type="checkbox"${player.profileVisible !== false ? " checked" : ""}></label>
      <label class="adminCheckbox wide">2026/27 registration payment received<input name="registrationPaid" type="checkbox"${player.registrationPaidSeasons?.includes("26-27") ? " checked" : ""}></label>
    </div>
    <div class="adminFormActions">
      <button class="btn btnGhost" type="button" data-cancel-editor>Cancel</button>
      <button class="btn btnPrimary" type="submit">Save player</button>
    </div>`;
    form.elements.photoFile.addEventListener("change", () => {
      const file = form.elements.photoFile.files?.[0];
      if (file) document.getElementById("adminPlayerPhotoPreview").src = URL.createObjectURL(file);
    });
    showEditor();
  }

  function showEditor() {
    form.dataset.editorType = state.editor.type;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    form.querySelector("input,select")?.focus();
  }

  function closeEditor() {
    if (state.editor?.saving) return;
    state.editor = null;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function saveFixture(data) {
    const { db, firestoreSdk } = await window.ONMFirebase.ready;
    const existing = state.fixtures.find(item => item.id === state.editor.id);
    const id = existing?.id || firestoreSdk.doc(firestoreSdk.collection(db, "fixtures")).id;
    const date = clean(data.get("date"));
    const names = Array.from({ length: 12 }, (_, index) =>
      data.get("eventType") === "social" ? "" : clean(data.get(`lineupPlayer${index + 1}`)));
    const selectedNames = names.filter(Boolean).map(name => name.toLowerCase().replace(/\s+/g, " "));
    if (new Set(selectedNames).size !== selectedNames.length) {
      throw new Error("Pick each player only once in the lineup.");
    }
    const lineup = Object.fromEntries(names.map((name, index) => [`Player${index + 1}`, name]));
    const sheetRow = {
      ...rowFor(existing),
      ...lineup,
      Captain: names.includes(rowFor(existing).Captain) ? rowFor(existing).Captain : "",
      CaptainOverride: names.includes(rowFor(existing).CaptainOverride) ? rowFor(existing).CaptainOverride : "",
      EventType: data.get("eventType") === "social" ? "social" : "fixture",
      EventDetails: data.get("eventType") === "social" ? clean(data.get("eventDetails")) : "",
      League: data.get("eventType") === "social" ? "Social" : clean(data.get("league")),
      Day: dayName(date),
      Date: fixtureDate(date),
      Time: clean(data.get("time")) || (data.get("eventType") === "social" ? "" : DEFAULT_MATCH_TIME),
      Opponent: clean(data.get("opponent")),
      HA: data.get("eventType") === "social" ? "" : clean(data.get("ha")),
      Location: clean(data.get("location"))
    };
    const saved = {
      sheetRow,
      season: clean(data.get("season")),
      updatedBy: state.user.uid,
      updatedAt: firestoreSdk.serverTimestamp()
    };
    if (!existing) saved.createdAt = firestoreSdk.serverTimestamp();
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "fixtures", id), saved, { merge: true });
    const local = { ...(existing || {}), id, ...saved, sheetRow };
    state.fixtures = existing ? state.fixtures.map(item => item.id === id ? local : item) : [...state.fixtures, local];
    renderFixtures();
    renderPlayers();
  }

  async function saveResult(data) {
    const { db, firestoreSdk } = await window.ONMFirebase.ready;
    const existing = state.results.find(item => item.id === state.editor.id);
    const id = existing?.id || firestoreSdk.doc(firestoreSdk.collection(db, "results")).id;
    const sheetRow = {
      ...rowFor(existing),
      Competition: clean(data.get("competition")),
      Date: resultDate(data.get("date")),
      HomeTeam: clean(data.get("homeTeam")),
      AwayTeam: clean(data.get("awayTeam")),
      HomeScore: numericOrBlank(data.get("homeScore")),
      AwayScore: numericOrBlank(data.get("awayScore")),
      Result: clean(data.get("result")),
      Venue: clean(data.get("venue")),
      "Cup?": data.get("cup") === "on",
      Stage: clean(data.get("stage")),
      HomePoints: numericOrBlank(data.get("homePoints")),
      AwayPoints: numericOrBlank(data.get("awayPoints")),
      IMGFOLDER: clean(data.get("imageFolder"))
    };
    for (let index = 1; index <= 12; index += 1) {
      const previousPlayer = clean(sheetRow[`Player${index}`] || sheetRow[`Player ${index}`]);
      if (previousPlayer !== clean(data.get(`player${index}`)) || Number(data.get(`t${index}`)) <= 0) {
        sheetRow[`HighestCheckout${index}`] = "";
        sheetRow[`PlayerKey${index}`] = "";
      }
      delete sheetRow[`Player ${index}`];
      sheetRow[`Player${index}`] = clean(data.get(`player${index}`));
      sheetRow[`C${index}`] = numericOrBlank(data.get(`c${index}`));
      sheetRow[`F${index}`] = numericOrBlank(data.get(`f${index}`));
      sheetRow[`D${index}`] = data.get(`d${index}`) === "on";
      sheetRow[`O${index}`] = numericOrBlank(data.get(`o${index}`));
      sheetRow[`B${index}`] = numericOrBlank(data.get(`b${index}`));
      sheetRow[`T${index}`] = numericOrBlank(data.get(`t${index}`));
    }
    const saved = {
      sheetRow,
      season: clean(data.get("season")),
      updatedBy: state.user.uid,
      updatedAt: firestoreSdk.serverTimestamp()
    };
    if (!existing) saved.createdAt = firestoreSdk.serverTimestamp();
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "results", id), saved, { merge: true });
    const local = { ...(existing || {}), id, ...saved, sheetRow };
    state.results = existing ? state.results.map(item => item.id === id ? local : item) : [...state.results, local];
    renderFines();
    renderFixtures();
    renderPlayers();
  }

  function fileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(file);
    });
  }

  async function savePlayer(data) {
    const player = state.players.find(item => item.playerKey === state.editor.id);
    if (!player) throw new Error("That player profile could not be found.");
    let photoUrl = player.photoUrl || player.photo || "";
    const file = form.elements.photoFile?.files?.[0];
    if (file) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP image.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
      const uploaded = await window.ONMFirebase.post({
        action: "uploadPlayerPhoto",
        playerKey: player.playerKey,
        fileName: file.name,
        mimeType: file.type,
        imageBase64: await fileAsBase64(file)
      });
      if (!uploaded.success) throw new Error(uploaded.error || "Could not upload that photo.");
      photoUrl = uploaded.photoUrl;
    }
    const profile = {
      fullName: clean(data.get("fullName")),
      publicName: clean(data.get("publicName")),
      nickname: clean(data.get("nickname")),
      photoUrl,
      bio: clean(data.get("bio")),
      accolades: [...new Set([...data.getAll("accoladeKey"), ...(player.accolades || []).filter(key => !["guthrie_cup_winner_25_26", "banks_winner_24_25", "alex_beckett_winner_25", "mpl_winner_25"].includes(key))])],
      role: clean(data.get("role")),
      song: clean(data.get("song")),
      highestCheckout: clean(data.get("highestCheckout")),
      gooch: data.get("gooch") === "on",
      profileVisible: data.get("profileVisible") === "on",
      registrationPaid: data.get("registrationPaid") === "on"
    };
    if (player.historicalOnly) {
      const { db, firestoreSdk: sdk } = await window.ONMFirebase.ready;
      const ref = sdk.doc(db, "players", player.playerKey);
      await sdk.runTransaction(db, async transaction => {
        if (!(await transaction.get(ref)).exists()) {
          transaction.set(ref, { playerKey: player.playerKey, publicName: player.publicName, fullName: player.fullName });
        }
      });
      player.historicalOnly = false;
    }
    const result = await window.ONMFirebase.post({ action: "updatePlayerProfile", playerKey: player.playerKey, profile });
    if (!result.success) throw new Error(result.error || "Could not save that player.");
    state.players = state.players.map(item => item.playerKey === player.playerKey
      ? { ...item, ...profile, registrationPaidSeasons: profile.registrationPaid
          ? [...new Set([...(item.registrationPaidSeasons || []), "26-27"])]
          : (item.registrationPaidSeasons || []).filter(season => season !== "26-27"), gooch: profile.gooch ? "yes" : "" }
      : item);
    if (profile.publicName !== player.publicName) {
      state.results = await loadCollection("results");
      renderFixtures();
      renderFines();
    }
    renderPlayers();
  }

  function registrationProfile(player, registrationPaid) {
    return {
      nickname: player.nickname || "",
      photoUrl: player.photoUrl || player.photo || "",
      bio: player.bio || "",
      accolades: player.accolades || [],
      role: player.role || "",
      song: player.song || "",
      highestCheckout: player.highestCheckout || player["highest-checkout"] || "",
      gooch: [true, "yes", "true"].includes(player.gooch),
      profileVisible: player.profileVisible !== false,
      registrationPaid
    };
  }

  async function togglePlayerRegistration(button) {
    const player = state.players.find(item => item.playerKey === button.dataset.togglePlayerRegistration);
    if (!player) return;
    const paid = button.dataset.registrationPaid === "true";
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const result = await window.ONMFirebase.post({ action: "updatePlayerProfile", playerKey: player.playerKey, profile: registrationProfile(player, paid) });
      if (!result.success) throw new Error(result.error || "Could not update the registration payment.");
      player.registrationPaidSeasons = paid
        ? [...new Set([...(player.registrationPaidSeasons || []), "26-27"])]
        : (player.registrationPaidSeasons || []).filter(season => season !== "26-27");
      renderPlayers();
      showToast(`${player.publicName}'s registration is now marked ${paid ? "paid" : "unpaid"}.`);
    } catch (error) {
      showToast(error.message || "Could not update the registration payment.", true);
      button.disabled = false;
      button.textContent = paid ? "Mark £15 registration paid" : "Mark registration unpaid";
    }
  }

  function currencyForToast(pence) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
  }

  function attachPaymentSearch() {
    const input = document.getElementById("quickFinePlayer");
    const list = document.getElementById("quickFineSuggestions");
    let matches = [], active = -1;
    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
    const choose = player => {
      input.value = `${player.fullName || player.publicName}${player.fullName && player.fullName !== player.publicName ? " (" + player.publicName + ")" : ""}`;
      input.dataset.playerKey = player.playerKey;
      close();
      document.getElementById("quickFineAmount").focus();
    };
    input.addEventListener("input", () => {
      delete input.dataset.playerKey;
      const query = clean(input.value).toLowerCase();
      matches = query ? state.players.filter(player => `${player.fullName || ""} ${player.publicName || ""}`.toLowerCase().includes(query))
        .sort((a, b) => clean(a.fullName || a.publicName).localeCompare(clean(b.fullName || b.publicName))) : [];
      active = -1;
      list.innerHTML = matches.map((player, index) => `<li role="option" id="payment-option-${index}" aria-selected="false" data-player-index="${index}"><strong>${escapeHtml(player.fullName || player.publicName)}</strong><small>${escapeHtml(player.publicName)} · ${currencyForToast(playerFineAccount(player).owed)} owed</small></li>`).join("");
      list.hidden = !matches.length;
      input.setAttribute("aria-expanded", String(matches.length > 0));
      input.removeAttribute("aria-activedescendant");
    });
    list.addEventListener("mousedown", event => event.preventDefault());
    list.addEventListener("click", event => {
      const option = event.target.closest("[data-player-index]");
      if (option) choose(matches[Number(option.dataset.playerIndex)]);
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") { close(); return; }
      if (list.hidden) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        active = (active + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length;
        [...list.children].forEach((option, index) => option.setAttribute("aria-selected", String(index === active)));
        input.setAttribute("aria-activedescendant", `payment-option-${active}`);
        list.children[active]?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter" && matches.length) {
        event.preventDefault();
        choose(matches[Math.max(0, active)]);
      }
    });
    input.addEventListener("blur", close);
  }

  async function saveQuickFinePayment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.saving || !form.reportValidity()) return;
    const select = document.getElementById("quickFinePlayer");
    const input = document.getElementById("quickFineAmount");
    const status = document.getElementById("quickFineStatus");
    const player = state.players.find(item => item.playerKey === select.dataset.playerKey);
    const pence = Math.round(Number(input.value) * 100);
    if (!player) { status.textContent = "Choose a player from the name suggestions."; select.focus(); return; }
    if (!Number.isSafeInteger(pence) || pence <= 0) return;
    const button = form.querySelector('button[type="submit"]');
    form.dataset.saving = "true";
    button.disabled = true;
    status.textContent = "Saving…";
    try {
      const { db, firestoreSdk } = await window.ONMFirebase.ready;
      const id = `26-27__${player.playerKey}`;
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "finePayments", id), {
        season: "26-27", playerKey: player.playerKey, playerName: player.publicName,
        amountPaidPence: firestoreSdk.increment(pence),
        updatedAt: firestoreSdk.serverTimestamp(), updatedBy: state.user.uid
      }, { merge: true });
      const existing = state.finePayments.find(item => item.id === id);
      if (existing) existing.amountPaidPence = Number(existing.amountPaidPence || 0) + pence;
      else state.finePayments.push({ id, season: "26-27", playerKey: player.playerKey, amountPaidPence: pence });
      renderPlayers();
      renderFines();
      input.value = "";
      status.textContent = `${currencyForToast(pence)} recorded for ${player.publicName}.`;
      input.focus();
    } catch (error) {
      status.textContent = error.message || "Payment could not be saved.";
    } finally {
      delete form.dataset.saving;
      button.disabled = false;
    }
  }

  async function recordFinePayment(button) {
    const season = document.getElementById("finesSeasonFilter").value;
    const playerKey = button.dataset.recordFinePayment;
    const input = document.querySelector(`[data-fine-payment-input="${CSS.escape(playerKey)}"]`);
    const amount = Number(input?.value || 0);
    if (season === "all" || !Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a payment amount greater than £0.", true);
      return;
    }
    const pence = Math.round(amount * 100), id = `${season}__${playerKey}`;
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const { db, firestoreSdk } = await window.ONMFirebase.ready;
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "finePayments", id), {
        season,
        playerKey,
        playerName: button.dataset.playerName,
        amountPaidPence: firestoreSdk.increment(pence),
        updatedAt: firestoreSdk.serverTimestamp(),
        updatedBy: state.user.userId || state.user.id || ""
      }, { merge: true });
      const existing = state.finePayments.find(item => item.id === id);
      if (existing) existing.amountPaidPence = Number(existing.amountPaidPence || 0) + pence;
      else state.finePayments.push({ id, season, playerKey, playerName: button.dataset.playerName, amountPaidPence: pence });
      renderFines();
      showToast(`${currencyForToast(pence)} payment recorded for ${button.dataset.playerName}.`);
    } catch (error) {
      showToast(error.message || "Could not record that fine payment.", true);
      button.disabled = false;
      button.textContent = "Add payment";
    }
  }

  async function deleteItem(type, id) {
    const deletionKey = `${type}:${id}`;
    if (pendingDeletions.has(deletionKey)) return;
    const items = type === "fixture" ? state.fixtures : state.results;
    const item = items.find(entry => entry.id === id);
    if (!item) return;
    const row = rowFor(item);
    const description = type === "fixture"
      ? `${row.Opponent || "this fixture"} on ${row.Date || "the selected date"}`
      : `${row.HomeTeam || "Home"} v ${row.AwayTeam || "Away"} on ${row.Date || "the selected date"}`;
    const consequence = type === "fixture"
      ? "This removes the fixture from the live website. Any submitted result will remain. This cannot be undone."
      : "This removes the result from the live website and cannot be undone.";
    if (!window.confirm(`Delete ${description}?\n\n${consequence}`)) return;
    pendingDeletions.add(deletionKey);
    try {
      const { db, firestoreSdk } = await window.ONMFirebase.ready;
      await firestoreSdk.deleteDoc(firestoreSdk.doc(db, type === "fixture" ? "fixtures" : "results", id));
      if (type === "fixture") {
        state.fixtures = state.fixtures.filter(entry => entry.id !== id);
        renderFixtures();
      } else {
        state.results = state.results.filter(entry => entry.id !== id);
        renderFines();
        renderFixtures();
        renderPlayers();
      }
      if (state.editor?.type === type && state.editor.id === id) closeEditor();
      showToast(`${type === "fixture" ? "Fixture" : "Result"} deleted.`);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not delete that item.", true);
    } finally {
      pendingDeletions.delete(deletionKey);
    }
  }

  async function loadCollection(name) {
    const { db, firestoreSdk } = await window.ONMFirebase.ready;
    const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, name));
    return snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
  }

  function requestedMatchCandidates(items, params, type) {
    const id = params.get("id");
    if (id) return items.filter(item => item.id === id);
    const normalise = value => clean(value).toLowerCase().replace(/\s+/g, " ");
    return items.filter(item => {
      const row = rowFor(item);
      if (params.get("season") && item.season !== params.get("season")) return false;
      if (inputDate(row.Date) !== params.get("date")) return false;
      const league = type === "result" ? row.Competition : row.League;
      if (normalise(league) !== normalise(params.get("league"))) return false;
      if (type === "fixture") return normalise(row.Opponent) === normalise(params.get("opponent")) && normalise(row.HA) === normalise(params.get("side"));
      const home = /^oche ness monsters(?: [ab])?$/i.test(clean(row.HomeTeam));
      return normalise(home ? row.AwayTeam : row.HomeTeam) === normalise(params.get("opponent")) && (home ? "home" : "away") === normalise(params.get("side"));
    });
  }

  function openRequestedMatchEditor(pickTeam) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("edit");
    if (!["fixture", "result"].includes(type)) return;
    const matches = requestedMatchCandidates(type === "fixture" ? state.fixtures : state.results, params, type);
    if (matches.length !== 1) { showToast(matches.length ? "More than one match fits this link. Choose the correct match in the list." : "This match could not be found. Refresh and choose it from the list.", true); return; }
    if (type === "fixture" && params.get("tab") === "pickTeam") {
      if (!upcomingTeamFixtures().some(item => item.id === matches[0].id)) {
        showToast("This fixture is no longer available for team selection.", true);
        return;
      }
      pickTeam.open(matches[0].id);
      document.querySelector('[data-admin-tab="pickTeam"]').click();
      return;
    }
    document.querySelector('[data-admin-tab="fixtures"]')?.click();
    if (type === "fixture") openFixtureEditor(matches[0]);
    else openResultEditor(matches[0]);
  }

  async function pickTeamSettings() {
    const { db, firestoreSdk } = await window.ONMFirebase.ready;
    return { ref: firestoreSdk.doc(db, "seasons", "26-27"), firestoreSdk };
  }

  async function setPickTeamArchived(player, archived) {
    await window.ONMFirebase.availability("archiveTeamAvailabilityPlayer", { playerKey: player.playerKey, archived });
    const { ref, firestoreSdk } = await pickTeamSettings();
    const operation = archived ? firestoreSdk.arrayUnion(player.playerKey) : firestoreSdk.arrayRemove(player.playerKey);
    await firestoreSdk.setDoc(ref, { pickTeamArchivedPlayerKeys: operation }, { merge: true });
    if (archived) state.pickTeamArchived.add(player.playerKey);
    else state.pickTeamArchived.delete(player.playerKey);
  }

  function attachListeners() {
    let countSeason;
    let counts;
    const pickTeam = window.ONMPickTeam.init({
      upcoming: upcomingTeamFixtures,
      roster: () => state.players,
      linked: player => state.linkedPlayerKeys.has(player.playerKey),
      archived: player => state.pickTeamArchived.has(player.playerKey),
      setArchived: setPickTeamArchived,
      editPlayer: openPlayerEditor,
      link(player) {
        state.pickTeamLinkTarget = player.playerKey;
        document.querySelector('[data-admin-tab="requests"]').click();
        document.getElementById("accountSearch").value = clean(player.fullName || player.publicName);
        renderAdminRequests();
        document.getElementById("accountSearch").focus();
      },
      appearances(player, season) {
        if (season !== countSeason) {
          countSeason = season;
          counts = seasonAppearances(season);
        }
        return counts?.get(appearanceNameKey(player.publicName)) || 0;
      },
      dateKey: inputDate,
      rowFor,
      photo: playerPhoto,
      escape: escapeHtml,
      save: savePickedTeam,
      toast: showToast
    });
    document.querySelectorAll("[data-admin-tab]").forEach(button => button.addEventListener("click", () => {
      state.activeTab = button.dataset.adminTab;
      document.querySelectorAll("[data-admin-tab]").forEach(item => item.classList.toggle("active", item === button));
      document.getElementById("fixturesPanel").classList.toggle("hidden", state.activeTab !== "fixtures");
      if (state.activeTab === "fixtures") centreNextFixture();
      document.getElementById("pickTeamPanel").classList.toggle("hidden", state.activeTab !== "pickTeam");
      if (state.activeTab === "pickTeam") pickTeam.open();
      document.getElementById("playersPanel").classList.toggle("hidden", state.activeTab !== "players");
      document.getElementById("finesPanel").classList.toggle("hidden", state.activeTab !== "fines");
      document.getElementById("requestsPanel").classList.toggle("hidden", state.activeTab !== "requests");
      document.getElementById("bankPanel").classList.toggle("hidden", state.activeTab !== "bank");
    }));
    document.getElementById("fixtureSeasonFilter").addEventListener("change", () => renderFixtures({ centre: true }));
    document.getElementById("fixtureSearch").addEventListener("input", () => renderFixtures({ centre: true }));
    document.getElementById("playerSearch").addEventListener("input", renderPlayers);
    document.getElementById("playerListView").addEventListener("change", renderPlayers);
    ["playerRegistrationFilter", "playerAccountFilter", "playerFinesFilter"].forEach(id => document.getElementById(id).addEventListener("change", renderPlayers));
    document.getElementById("quickFinePayment").addEventListener("submit", saveQuickFinePayment);
    attachPaymentSearch();
    document.getElementById("finesSeasonFilter").addEventListener("change", renderFines);
    document.getElementById("finesSearch").addEventListener("input", renderFines);
    document.getElementById("refreshAdminRequests").addEventListener("click", loadAdminRequests);
    document.getElementById("accountSearch").addEventListener("input", renderAdminRequests);
    document.getElementById("addFixtureBtn").addEventListener("click", () => openFixtureEditor());
    document.getElementById("addResultBtn").addEventListener("click", () => openResultEditor());
    document.getElementById("closeAdminEditor").addEventListener("click", closeEditor);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeEditor(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.classList.contains("hidden")) closeEditor(); });
    document.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.hasAttribute("data-cancel-editor")) closeEditor();
      if (button.dataset.reviewAdmin) reviewAdminRequest(button);
      if (button.dataset.linkAccount) openAccountLinker(button);
      if (button.dataset.editFixture) openFixtureEditor(state.fixtures.find(item => item.id === button.dataset.editFixture));
      if (button.dataset.editResult) openResultEditor(state.results.find(item => item.id === button.dataset.editResult));
      if (button.dataset.editPlayer) openPlayerEditor(state.players.find(item => item.playerKey === button.dataset.editPlayer));
      if (button.dataset.togglePlayerRegistration) togglePlayerRegistration(button);
      if (button.dataset.recordFinePayment) recordFinePayment(button);
      if (button.dataset.deleteFixture) deleteItem("fixture", button.dataset.deleteFixture);
      if (button.dataset.deleteResult) deleteItem("result", button.dataset.deleteResult);
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = "Saving…";
      state.editor.saving = true;
      try {
        const data = new FormData(form);
        if (state.editor.type === "fixture") await saveFixture(data);
        else if (state.editor.type === "result") await saveResult(data);
        else if (state.editor.type === "accountLink") await saveAccountLink(data);
        else await savePlayer(data);
        const label = state.editor.type === "accountLink" ? "Player link" : state.editor.type === "fixture" ? "Fixture" : state.editor.type === "result" ? "Result" : "Player";
        state.editor.saving = false;
        closeEditor();
        showToast(`${label} saved. The live website has been updated.`);
      } catch (error) {
        console.error(error);
        state.editor.saving = false;
        if (state.editor.type === "accountLink") document.getElementById("accountLinkError").textContent = error.message || "Could not link this account.";
        showToast(error.message || "Could not save those changes.", true);
        submit.disabled = false;
        submit.textContent = state.editor.type === "accountLink" ? (form.elements.linkMode.value === "new" ? "Create & link Monster" : "Link player") : state.editor.type === "fixture" ? "Save fixture" : state.editor.type === "result" ? "Save result" : "Save player";
      }
    });
    return pickTeam;
  }

  async function initialise() {
    try {
      if (!window.ONMFirebase) throw new Error("Firebase did not load.");
      state.user = await window.ONMFirebase.loadOwnUser();
      if (!state.user) {
        gate.innerHTML = '<h2>Sign in required</h2><p>Please sign in on the website first, then return to this page.</p><a class="btn btnPrimary" href="index.html">Go to sign in</a>';
        return;
      }
      if (!["owner", "admin"].includes(state.user.role)) {
        gate.innerHTML = '<h2>Administrator access required</h2><p>This area is only available to club owners and administrators.</p><a class="btn btnGhost" href="index.html">Back to website</a>';
        return;
      }
      document.getElementById("adminIdentity").textContent = `Signed in as ${state.user.firstName || state.user.email}`;
      const profilesRequest = window.ONMFirebase.post({ action: "getPublicPlayerProfiles" });
      const photosRequest = window.PlayerData?.fetchPlayerPhotosFromDrive?.().catch(() => ({})) || Promise.resolve({});
      const [fixtures, results, finePayments, privatePlayers, users, profileResult, photos, teamSettings] = await Promise.all([
        loadCollection("fixtures"), loadCollection("results"), loadCollection("finePayments"), loadCollection("players"), loadCollection("users"), profilesRequest, photosRequest,
        pickTeamSettings().then(({ ref, firestoreSdk }) => firestoreSdk.getDoc(ref))
      ]);
      state.fixtures = fixtures;
      state.results = results;
      state.finePayments = finePayments;
      const playerMap = new Map(privatePlayers.map(player => [player.playerKey || player.id, { ...player, playerKey: player.playerKey || player.id }]));
      (profileResult.success ? profileResult.profiles : []).forEach(profile => {
        const key = profile.playerKey;
        playerMap.set(key, { ...(playerMap.get(key) || {}), ...profile, playerKey: key });
      });
      state.players = [...playerMap.values()].filter(player => player.publicName);
      if (!playerMap.has("george-m") && !state.players.some(player =>
        [player.publicName, player.fullName].some(name => ["george m", "george mills"].includes(clean(name).toLowerCase())))) {
        state.players.push({ playerKey: "george-m", publicName: "George M", fullName: "George Mills", historicalOnly: true });
      }
      state.linkedPlayerKeys = new Set(users.map(account => account.linkedPlayerKey).filter(Boolean));
      state.playerPhotos = photos || {};
      state.pickTeamArchived = new Set(teamSettings.data()?.pickTeamArchivedPlayerKeys || []);
      gate.classList.add("hidden");
      app.classList.remove("hidden");
      const pickTeam = attachListeners();
      renderFixtures({ centre: true });
      renderPlayers();
      renderFines();
      openRequestedMatchEditor(pickTeam);
      if (["owner", "admin"].includes(state.user.role)) {
        document.getElementById("adminRequestsTab").classList.remove("hidden");
        await loadAdminRequests();
      }
    } catch (error) {
      console.error(error);
      gate.innerHTML = `<h2>Could not open the admin area</h2><p>${escapeHtml(error.message || "Please try again.")}</p>`;
    }
  }

  initialise();
})();
