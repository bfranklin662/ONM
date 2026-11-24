(function () {
  "use strict";

  const LIMIT = 12;
  const GROUPS = ["Selected", "Available", "Not sure", "Not updated", "Unavailable"];
  const normal = value => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const person = value => normal(value).replace(/\s*\((?:c|vc)\)$/, "");

  function parseCsv(text) {
    const rows = [[]];
    let value = "";
    let quoted = false;
    text = text.replace(/^\uFEFF/, "");
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') { value += '"'; index++; }
        else quoted = !quoted;
      } else if (!quoted && (char === "," || char === "\n" || char === "\r")) {
        rows.at(-1).push(value);
        value = "";
        if (char !== ",") {
          if (char === "\r" && text[index + 1] === "\n") index++;
          rows.push([]);
        }
      } else {
        value += char;
      }
    }
    if (quoted) throw new Error("This CSV has an unfinished quoted cell.");
    rows.at(-1).push(value);
    return rows;
  }

  function leagueKey(value) {
    const name = normal(value);
    const cup = /cup|trophy|memorial|charity|\bko\b/.test(name);
    if (name.includes("banks")) return cup ? "banks cup" : "banks league";
    if (name.includes("trafalgar") || /\btdl\b/.test(name)) return cup ? "trafalgar cup" : "trafalgar league";
    return name;
  }

  function opponentKey(value) {
    const name = normal(value);
    return ({ "dogs no more": "bb kings", sliverbacks: "silverbacks" })[name] || name;
  }

  function sideKey(value) {
    const side = normal(value);
    return ({ h: "home", a: "away", n: "neutral" })[side] || side;
  }

  function readSheet(rows, dateKey, fixtureIds = {}) {
    if (!Array.isArray(rows) || rows.length < 8) throw new Error("The availability sheet layout could not be read.");
    const fixtures = [];
    for (let column = 2; column < (rows[0] || []).length; column++) {
      const header = String(rows[0][column] || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const date = header.find(line => /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(line));
      const opponent = rows[1]?.[column];
      if (!date || !opponent || /cancelled|canceled|postponed/i.test([header, opponent, rows[3]?.[column]].join(" "))) continue;
      const responses = new Map();
      const sheetNames = new Map();
      for (const row of rows.slice(7)) {
        const key = person(row[0]);
        if (!key) continue;
        sheetNames.set(key, String(row[0]).trim());
        const status = GROUPS.find(choice => normal(choice) === normal(row[column])) || "Not updated";
        responses.set(key, responses.has(key) ? null : status);
      }
      fixtures.push({ id: fixtureIds[column], date: dateKey(date), league: leagueKey(header[0]), opponent: opponentKey(opponent), side: sideKey(rows[2]?.[column]), responses, sheetNames });
    }
    if (!fixtures.length) throw new Error("No match columns were found in the availability sheet.");
    return fixtures;
  }

  function matchSheet(fixtures, row, dateKey) {
    const matching = fixtures.filter(fixture => fixture.date === dateKey(row.Date) &&
      fixture.league === leagueKey(row.League) && fixture.opponent === opponentKey(row.Opponent) &&
      fixture.side === sideKey(row.HA));
    return matching.length === 1 ? matching[0] : null;
  }

  function playerSheetKey(player, sheetFixture) {
    const names = [player.fullName, player.publicName].map(person);
    const aliases = names.some(name => ["gary hampshire", "gary hampshere", "gary hamshere"].includes(name))
      ? ["Gary Hampshere", "Gary Hamshere"] : names.some(name => ["george m", "george mills"].includes(name)) ? ["George Mills"] : [];
    return [player.availabilitySheetName, player.fullName, player.publicName, ...aliases]
      .map(person).find(key => sheetFixture.responses.has(key));
  }

  function playerStatus(player, sheetFixture) {
    return sheetFixture.responses.get(playerSheetKey(player, sheetFixture)) || "No matching sheet row";
  }

  async function liveRows() {
    const firebase = window.ONMFirebase;
    const user = await firebase.currentFirebaseUser();
    if (!user) throw Object.assign(new Error("Sign in to refresh availability."), { code: "functions/unauthenticated" });
    const { app } = await firebase.ready;
    const sdk = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js");
    const getTeam = sdk.httpsCallable(sdk.getFunctions(app, "europe-west2"), "getTeamAvailability");
    try {
      return (await getTeam({})).data;
    } catch (error) {
      if (error.code !== "functions/unauthenticated") throw error;
      await user.getIdToken(true);
      return (await getTeam({})).data;
    }
  }

  function liveFailureMessage(error, source) {
    const detail = {
      "functions/unauthenticated": "Sign out and back in as an ONM administrator, then refresh availability.",
      "auth/user-token-expired": "Sign out and back in as an ONM administrator, then refresh availability.",
      "functions/permission-denied": "An active ONM admin or owner account is required to load the sheet.",
      "functions/failed-precondition": error.message,
      "functions/unavailable": "The site could not reach the availability sheet. Try Refresh availability again."
    }[error.code] || "Live availability could not be loaded. Try Refresh availability again.";
    return source ? `${detail} Showing ${source.toLowerCase()}.` : detail;
  }

  function init({ upcoming, roster, appearances, dateKey, rowFor, photo, escape, save, toast, linked, archived, setArchived, link, editPlayer }) {
    const el = id => document.getElementById(id);
    const picker = el("pickTeamFixture");
    const groups = el("pickTeamGroups");
    const folder = el("pickTeamArchive");
    const archiveCards = el("pickTeamArchiveCards");
    const archiveCount = el("pickTeamArchiveCount");
    const archiving = new Set();
    const selection = el("pickTeamSelection");
    const refresh = el("pickTeamRefresh");
    const panel = el("pickTeamFixturePanel");
    let fixtureId = "";
    const status = el("pickTeamStatus");
    const drafts = new Map();
    let sheet = [];
    let sheetTeamSync = false;
    let source = "";
    let message = "";
    let loading = false;
    let saving = false;
    let requested = false;

    function activeFixture() {
      return upcoming().find(item => item.id === fixtureId);
    }

    function chosen(fixture) {
      if (drafts.has(fixture.id)) return drafts.get(fixture.id);
      const row = rowFor(fixture);
      return Array.from({ length: LIMIT }, (_, i) => row[`Player${i + 1}`]).filter(Boolean);
    }

    const displayName = player => player.fullName?.trim() || player.publicName;

    function renderPlayer({ player, count, group }, names, inArchive = false, canOverride = false) {
      const name = escape(displayName(player));
      const selected = names.includes(player.publicName);
      const isLinked = linked(player);
      const key = escape(player.playerKey);
      const body = `<img src="${escape(photo(player))}" width="52" height="52" alt="" loading="lazy">
        <span class="pickTeamPlayerInfo"><strong>${name}${isLinked ? ' <span class="pickTeamLinked" role="img" aria-label="Account linked" title="Account linked"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span>' : ""}</strong>
        <span class="pickTeamApps">Apps: ${count}</span></span>`;
      return `<article class="pickTeamPlayerCard">
        ${inArchive ? `<div class="pickTeamPlayer">${body}</div>` :
          `<button type="button" class="pickTeamPlayer" data-pick-player="${escape(player.publicName)}" aria-pressed="${selected}"${saving ? " disabled" : ""}>${body}</button>`}
        <details class="pickTeamSettings">
          <summary aria-label="Settings for ${name}" title="Player settings">⚙</summary>
          <div>
            <a href="player-profile.html?name=${encodeURIComponent(player.publicName)}">View player</a>
            <button type="button" data-pick-edit="${key}">Edit player</button>
            ${isLinked ? "" : `<button type="button" data-pick-link="${key}">Link account</button>`}
            ${canOverride ? `<button type="button" data-pick-status="${key}">${group === "Selected" ? "Change sheet response" : "Mark Selected on sheet"}</button>` : ""}
            <button type="button" data-pick-archive="${key}"${archiving.has(player.playerKey) || saving ? " disabled" : ""}>${inArchive ? "Restore to list" : "Archive from list"}</button>
          </div>
        </details>
      </article>`;
    }

    function renderSelection(fixture) {
      const names = chosen(fixture);
      const match = matchSheet(sheet, rowFor(fixture), dateKey);
      const needsSheetSync = sheetTeamSync && match?.id && names.some(name => {
        const player = roster().find(item => item.publicName === name);
        return player && playerStatus(player, match) !== "Selected";
      });
      selection.innerHTML = `<div><strong>Selected team · ${names.length}/${LIMIT}</strong>
        <span>${names.length ? names.map(name => escape(displayName(roster().find(player => player.publicName === name) || { publicName: name }))).join(" · ") : "Select players below in playing order."}</span></div>
        <button type="button" class="btn btnPrimary" data-pick-team-save${saving || (!drafts.has(fixture.id) && !needsSheetSync) ? " disabled" : ""}>${saving ? "Saving…" : "Save team"}</button>`;
    }

    function render() {
      const fixtures = upcoming();
      if (!fixtures.some(item => item.id === fixtureId)) fixtureId = fixtures[0]?.id || "";
      picker.innerHTML = fixtures.map((item, index) => {
        const row = rowFor(item);
        const active = item.id === fixtureId;
        const side = sideKey(row.HA).charAt(0).toUpperCase();
        const category = leagueKey(row.League).replace(" league", "").replace(/ /g, "-");
        return `<button type="button" role="tab" class="pickTeamFixture ${escape(category)}" id="pickFixtureTab${index}"
          data-fixture-id="${escape(item.id)}" aria-controls="pickTeamFixturePanel" aria-selected="${active}"
          tabindex="${active ? 0 : -1}"${saving ? " disabled" : ""}>
          <span class="pickTeamLeague">${escape(row.League)}</span>
          <strong>${escape(row.Opponent)}${side ? ` · ${escape(side)}` : ""}</strong>
          <span>${escape(row.Date)}${row.Time ? ` · ${escape(row.Time)}` : ""}</span>
          <span>${escape(row.Location || "")}</span>
        </button>`;
      }).join("");
      const activeTab = picker.querySelector('[aria-selected="true"]');
      if (activeTab) panel.setAttribute("aria-labelledby", activeTab.id);
      else panel.removeAttribute("aria-labelledby");
      const fixture = activeFixture();
      const archivedPlayers = roster().filter(archived).sort((a, b) => displayName(a).localeCompare(displayName(b)));
      archiveCount.textContent = archivedPlayers.length;
      archiveCards.innerHTML = archivedPlayers.map(player =>
        renderPlayer({ player, count: appearances(player, fixture?.season || "26-27") }, [], true)
      ).join("") || '<p class="pickTeamEmpty">No archived players</p>';
      if (!fixture) {
        status.textContent = "No upcoming match fixtures.";
        selection.replaceChildren();
        groups.replaceChildren();
        return;
      }

      const match = matchSheet(sheet, rowFor(fixture), dateKey);
      status.textContent = loading ? "Loading availability…" : message ||
        (match ? source : sheet.length ? "No unique match for this fixture in the availability sheet." : "Availability isn’t loaded yet.");
      renderSelection(fixture);
      const names = chosen(fixture);
      const players = roster().filter(player => !archived(player)).map(player => ({
        player,
        count: appearances(player, fixture.season),
        group: match ? playerStatus(player, match) : "Availability not loaded"
      })).sort((a, b) => b.count - a.count || displayName(a.player).localeCompare(displayName(b.player)));
      const linkedNames = new Set(match ? roster().map(player => playerSheetKey(player, match)) : []);
      const unmatched = match ? [...match.sheetNames].filter(([key]) => !linkedNames.has(key)) : [];
      const headings = match ? [...GROUPS, "No matching sheet row"] : ["Availability not loaded"];
      groups.innerHTML = headings.map(heading => {
        const entries = players.filter(entry => entry.group === heading);
        return `<section class="pickTeamGroup" data-status="${escape(heading)}"><h3>${escape(heading)} <span>${entries.length}</span></h3>${entries.length ? `<div class="pickTeamCards">${entries.map(entry => renderPlayer(entry, names, false, Boolean(match?.id && heading !== "No matching sheet row"))).join("")}</div>` : '<p class="pickTeamEmpty">No players</p>'}</section>`;
      }).join("") + (unmatched.length ? `<section class="pickTeamGroup"><h3>Sheet names without a player profile</h3>
        <p class="pickTeamEmpty">Link these names to a club player before selecting them.</p>
        <ul>${unmatched.map(([key, name]) => `<li>${escape(name)} · ${escape(match.responses.get(key) || "Duplicate sheet row")}</li>`).join("")}</ul></section>` : "");
    }

    async function refreshSheet() {
      if (loading) return;
      requested = true;
      loading = true;
      refresh.disabled = true;
      message = "";
      render();
      try {
        const { rows, fixtureIds, sheetTeamSync: enabled } = await liveRows();
        sheetTeamSync = enabled === true;
        sheet = readSheet(rows, dateKey, fixtureIds);
        source = "Live availability sheet";
      } catch (error) {
        message = liveFailureMessage(error, source);
      } finally {
        loading = false;
        refresh.disabled = false;
        render();
      }
    }

    function activateTab(tab) {
      fixtureId = tab.dataset.fixtureId;
      render();
      picker.querySelector('[aria-selected="true"]')?.focus();
    }

    picker.addEventListener("click", event => {
      const tab = event.target.closest("[data-fixture-id]");
      if (tab) activateTab(tab);
    });
    picker.addEventListener("keydown", event => {
      const tabs = [...picker.querySelectorAll('[role="tab"]')];
      const current = tabs.indexOf(event.target);
      if (saving || current < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = { Home: 0, End: tabs.length - 1, ArrowLeft: (current - 1 + tabs.length) % tabs.length,
        ArrowRight: (current + 1) % tabs.length }[event.key];
      activateTab(tabs[next]);
    });
    refresh.addEventListener("click", refreshSheet);

    groups.addEventListener("click", event => {
      const button = event.target.closest("[data-pick-player]");
      const fixture = activeFixture();
      if (!button || !fixture || saving) return;
      const name = button.dataset.pickPlayer;
      const previous = chosen(fixture);
      const selected = previous.includes(name);
      if (!selected && previous.length >= LIMIT) {
        toast("You can select up to 12 players.", true);
        return;
      }
      drafts.set(fixture.id, selected ? previous.filter(player => player !== name) : [...previous, name]);
      button.setAttribute("aria-pressed", String(!selected));
      renderSelection(fixture);
    });
    groups.addEventListener("click", async event => {
      const action = event.target.closest("[data-pick-status]");
      if (!action || saving) return;
      const key = action.dataset.pickStatus;
      const player = roster().find(item => item.playerKey === key);
      if (!player) return;
      const fixture = activeFixture();
      const match = fixture && matchSheet(sheet, rowFor(fixture), dateKey);
      const previous = match && playerStatus(player, match);
      let status;
      if (action.dataset.pickStatus) {
        if (message || loading || !match || previous === "No matching sheet row") {
          toast("Refresh availability before changing the sheet.", true);
          return;
        }
        if (previous === "Selected") {
          const response = window.prompt("Replace Selected with Available, Unavailable or Not sure, or leave blank to clear.", "");
          if (response === null) return;
          status = ["Available", "Unavailable", "Not sure", ""].find(choice => normal(choice) === normal(response));
          if (status === undefined) { toast("Choose Available, Unavailable or Not sure.", true); return; }
        } else {
          if (!window.confirm(`Mark ${player.publicName} as Selected on the availability sheet?`)) return;
          status = "Selected";
        }
      }
      saving = true;
      render();
      try {
        await window.ONMFirebase.availability("setTeamAvailability", {
          playerKey: key, fixtureId: match.id, status, previousStatus: previous === "Not updated" ? "" : previous
        });
        toast("Sheet response updated.");
        await refreshSheet();
      } catch (error) {
        toast(error.message || "Could not update the player.", true);
      } finally {
        saving = false;
        render();
      }
    });
    async function handleRosterAction(event) {
      const edit = event.target.closest("[data-pick-edit]");
      if (edit) {
        edit.closest("details").open = false;
        const player = roster().find(item => item.playerKey === edit.dataset.pickEdit);
        if (player) editPlayer(player);
        return;
      }
      const linkButton = event.target.closest("[data-pick-link]");
      const archiveButton = event.target.closest("[data-pick-archive]");
      const key = linkButton?.dataset.pickLink || archiveButton?.dataset.pickArchive;
      const player = roster().find(item => item.playerKey === key);
      if (!player) return;
      if (linkButton) {
        link(player);
        return;
      }
      if (saving || archiving.has(key)) return;
      const toArchive = !archived(player);
      archiving.add(key);
      archiveButton.disabled = true;
      try {
        await setArchived(player, toArchive);
        await refreshSheet();
        toast(toArchive ? "Player archived." : "Player restored.");
      } catch (error) {
        toast(error.message || "Could not update the archive.", true);
      } finally {
        archiving.delete(key);
        render();
      }
    }

    groups.addEventListener("click", handleRosterAction);
    folder.addEventListener("click", handleRosterAction);
    selection.addEventListener("click", async event => {
      const fixture = activeFixture();
      if (!event.target.closest("[data-pick-team-save]") || !fixture || saving) return;
      saving = true;
      render();
      try {
        const names = chosen(fixture);
        const match = matchSheet(sheet, rowFor(fixture), dateKey);
        if (sheetTeamSync && names.length) {
          if (loading || message || !match?.id) throw new Error("Refresh availability and check that this fixture matches the sheet before saving.");
          const playerKeys = names.map(name => roster().find(player => player.publicName === name)?.playerKey);
          if (playerKeys.some(key => !key)) throw new Error("Every selected player needs a club profile.");
          await window.ONMFirebase.availability("selectTeamAvailability", { fixtureId: match.id, playerKeys });
        }
        await save(fixture, names);
        drafts.delete(fixture.id);
        toast(sheetTeamSync ? "Team saved and sheet updated." : "Team saved. Sheet sync is pending deployment.");
        await refreshSheet();
      } catch (error) {
        toast(error.message || "Could not save the team.", true);
      } finally {
        saving = false;
        render();
      }
    });
    return { open() { render(); if (!requested && upcoming().length) void refreshSheet(); } };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { parseCsv, readSheet, matchSheet, playerStatus };
  } else {
    window.ONMPickTeam = { init };
  }
})();
