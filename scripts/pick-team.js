(function () {
  "use strict";

  const LIMIT = 12;
  const RESPONSE_ACTIONS = ["Selected", "Available", "Not sure", "Unavailable"];
  const GROUPS = ["Selected", "Available", "Not sure", "Unavailable", "Not updated"];
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
      const counts = Object.fromEntries(GROUPS.map(status => [status, 0]));
      for (const row of rows.slice(7)) {
        const key = person(row[0]);
        if (!key) continue;
        sheetNames.set(key, String(row[0]).trim());
        const status = GROUPS.find(choice => normal(choice) === normal(row[column])) || "Not updated";
        responses.set(key, responses.has(key) ? null : status);
        counts[status] += 1;
      }
      fixtures.push({ id: fixtureIds[column], date: dateKey(date), league: leagueKey(header[0]), opponent: opponentKey(opponent), side: sideKey(rows[2]?.[column]), responses, sheetNames, counts });
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

  function defaultCaptain(names) {
    for (const aliases of [["nick", "nick horne"], ["ricky", "ricky plows"], ["rob", "rob piesse"], ["phil", "phil l", "phil lee"]]) {
      const name = names.find(player => aliases.includes(normal(player)));
      if (name) return name;
    }
    return "";
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
    const summary = el("pickTeamSummary");
    const fixtureSummary = el("pickTeamFixtureSummary");
    const refresh = el("pickTeamRefresh");
    const panel = el("pickTeamFixturePanel");
    let fixtureId = "";
    const status = el("pickTeamStatus");
    const drafts = new Map();
    const captainDrafts = new Map();
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
      return savedNames(fixture);
    }

    function savedNames(fixture) {
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
      return `<article class="pickTeamPlayerCard" data-status="${escape(group || "")}">
        ${inArchive ? `<div class="pickTeamPlayer">${body}</div>` :
          `<button type="button" role="checkbox" class="pickTeamPlayer" data-pick-player="${escape(player.publicName)}" aria-checked="${selected}"${saving ? " disabled" : ""}>
            <span class="pickTeamCheckbox" aria-hidden="true">✓</span>${body}
          </button>`}
        <details class="pickTeamSettings">
          <summary aria-label="Settings for ${name}" title="Player settings">⚙</summary>
          <div>
            <a href="player-profile.html?name=${encodeURIComponent(player.publicName)}">View player</a>
            <button type="button" data-pick-edit="${key}">Edit player</button>
            ${isLinked ? "" : `<button type="button" data-pick-link="${key}">Link account</button>`}
            ${canOverride ? RESPONSE_ACTIONS.map(status => `<button type="button" data-pick-status="${key}" data-availability-status="${status}">Mark ${status}</button>`).join("") : ""}
            <button type="button" data-pick-archive="${key}"${archiving.has(player.playerKey) || saving ? " disabled" : ""}>${inArchive ? "Restore to list" : "Archive from list"}</button>
          </div>
        </details>
      </article>`;
    }

    function requiredPlayers(fixture) {
      return ["banks league", "trafalgar league"].includes(leagueKey(rowFor(fixture).League)) ? 6 : 0;
    }

    function captainFor(fixture, names) {
      const requested = captainDrafts.get(fixture.id) ?? rowFor(fixture).CaptainOverride;
      const override = names.includes(requested) ? requested : "";
      return { override, captain: override || defaultCaptain(names) };
    }

    function canSave(fixture, names) {
      if (drafts.has(fixture.id)) return true;
      const { captain, override } = captainFor(fixture, names);
      const row = rowFor(fixture);
      return captain !== (row.Captain || "") || override !== (row.CaptainOverride || "");
    }

    function renderSelection(fixture) {
      const names = chosen(fixture);
      const row = rowFor(fixture);
      const minimum = requiredPlayers(fixture);
      const { captain, override } = captainFor(fixture, names);
      const automatic = defaultCaptain(names);
      const emptySlots = Array.from({ length: Math.max(0, minimum - names.length) }, (_, i) =>
        `<li class="pickTeamSelectedName pickTeamEmptySlot">Slot ${names.length + i + 1}</li>`).join("");
      selection.innerHTML = `<div class="pickTeamSelectionHeader"><strong>Selected team · ${names.length}/${LIMIT}</strong>
        <span>${escape(row.Opponent || "Opponent TBA")} · ${escape(row.League || "")}</span></div>
        <ol class="pickTeamSelectedNames">${names.map(name => {
          const player = roster().find(item => item.publicName === name) || { publicName: name };
          const label = escape(displayName(player));
          const nickname = String(player.nickname || "").trim().replace(/^["“]|["”]$/g, "");
          return `<li class="pickTeamSelectedName">
            <a href="player-profile.html?name=${encodeURIComponent(name)}">
              <img src="${escape(photo(player))}" width="40" height="40" alt="" loading="lazy">
              <span>${label}${name === captain ? " (c)" : ""}${nickname ? ` <em>“${escape(nickname)}”</em>` : ""}</span>
            </a>
            <button type="button" data-pick-remove="${escape(name)}" aria-label="Remove ${label} from team"${saving ? " disabled" : ""}>×</button>
          </li>`;
        }).join("")}${emptySlots}</ol>
        <div class="pickTeamSelectionFooter">
          ${names.length ? `<label>Captain
            <select data-pick-captain${saving ? " disabled" : ""}>
              <option value="">${automatic ? `Auto · ${escape(automatic)}` : "Choose captain"}</option>
              ${names.map(name => `<option value="${escape(name)}"${name === override ? " selected" : ""}>${escape(displayName(roster().find(player => player.publicName === name) || { publicName: name }))}</option>`).join("")}
            </select>
          </label>` : ""}
          ${minimum && names.length < minimum ? `<small>${names.length} of ${minimum} players picked. You can save this lineup and add more later.</small>` : ""}
          <button type="button" class="btn btnPrimary" data-pick-team-save${saving || !canSave(fixture, names) ? " disabled" : ""}>${saving ? "Saving…" : "Save team"}</button>
        </div>`;
    }

    const responded = match => RESPONSE_ACTIONS.reduce((total, status) => total + match.counts[status], 0);
    const sheetTotal = match => responded(match) + match.counts["Not updated"];

    function renderSummary(match, season) {
      const active = roster().filter(player => !archived(player) && appearances(player, season) > 0).length;
      const total = sheet.length ? sheetTotal(sheet[0]) : "—";
      const cards = metrics => metrics.map(([label, count]) =>
        `<div data-label="${escape(label)}"><dt>${escape(label)}</dt><dd>${count}</dd></div>`
      ).join("");
      summary.innerHTML = cards([["On sheet", total], ["Active · played this season", active]]);
      fixtureSummary.hidden = !match;
      fixtureSummary.innerHTML = match ? cards([
        ["Responded", `${responded(match)}/${sheetTotal(match)}`],
        ["Available", match.counts.Available + match.counts.Selected],
        ["Unavailable", match.counts.Unavailable],
        ["Not sure", match.counts["Not sure"]]
      ]) : "";
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
      if (!sheet.length || loading) {
        archiveCount.textContent = "0";
        folder.hidden = true;
        archiveCards.replaceChildren();
        selection.replaceChildren();
        groups.replaceChildren();
        renderSummary(null, fixture?.season || "26-27");
        status.textContent = loading ? "Loading availability…" : message || "Availability isn’t loaded yet.";
        return;
      }
      folder.hidden = false;
      const archivedPlayers = roster().filter(archived).sort((a, b) => displayName(a).localeCompare(displayName(b)));
      archiveCount.textContent = archivedPlayers.length;
      archiveCards.innerHTML = archivedPlayers.map(player =>
        renderPlayer({ player, count: appearances(player, fixture?.season || "26-27") }, [], true)
      ).join("") || '<p class="pickTeamEmpty">No archived players</p>';
      if (!fixture) {
        renderSummary(null, "26-27");
        status.textContent = "No upcoming match fixtures.";
        selection.replaceChildren();
        groups.replaceChildren();
        return;
      }

      const match = matchSheet(sheet, rowFor(fixture), dateKey);
      renderSummary(match, fixture.season);
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
      const headings = match ? [...GROUPS.filter(group => group !== "Selected"), "No matching sheet row"] : ["Availability not loaded"];
      groups.innerHTML = headings.map(heading => {
        const entries = players.filter(entry => entry.group === heading || (heading === "Available" && entry.group === "Selected"));
        if (heading === "No matching sheet row" && !entries.length) return "";
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
        const data = await liveRows();
        sheetTeamSync = data.sheetTeamSync === true;
        sheet = readSheet(data.rows, dateKey, data.fixtureIds);
        if (data.sheetRosterSync && sheet.length) {
          const playerKeys = roster().filter(player => {
            const onSheet = playerSheetKey(player, sheet[0]);
            return archived(player) ? onSheet : !onSheet;
          }).map(player => player.playerKey);
          if (playerKeys.length) {
            const { added, removed } = await window.ONMFirebase.availability("syncAvailabilityRoster", { playerKeys });
            if (added || removed) {
              const updated = await liveRows();
              sheet = readSheet(updated.rows, dateKey, updated.fixtureIds);
            }
          }
        }
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
    refresh.addEventListener("click", () => { if (!saving) void refreshSheet(); });
    document.addEventListener("click", event => {
      const current = event.target.closest(".pickTeamSettings");
      document.querySelectorAll("#pickTeamPanel .pickTeamSettings[open]").forEach(menu => {
        if (menu !== current) menu.open = false;
      });
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      const menu = document.querySelector("#pickTeamPanel .pickTeamSettings[open]");
      if (menu) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    });

    function updatePick(fixture, names) {
      const saved = savedNames(fixture);
      if (saved.length === names.length && saved.every((name, index) => name === names[index])) drafts.delete(fixture.id);
      else drafts.set(fixture.id, names);
      for (const card of groups.querySelectorAll("[data-pick-player]")) {
        const selected = names.includes(card.dataset.pickPlayer);
        card.setAttribute("aria-checked", String(selected));
      }
      renderSelection(fixture);
    }

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
      updatePick(fixture, selected ? previous.filter(player => player !== name) : [...previous, name]);
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
      if (message || loading || !match || previous === "No matching sheet row") {
        toast("Refresh availability before changing the sheet.", true);
        return;
      }
      const status = action.dataset.availabilityStatus;
      if (status === previous) return;
      const sheetKey = playerSheetKey(player, match);
      function moveResponse(from, to) {
        match.responses.set(sheetKey, to);
        match.counts[from] -= 1;
        match.counts[to] += 1;
      }
      saving = true;
      moveResponse(previous, status);
      render();
      try {
        await window.ONMFirebase.availability("setTeamAvailability", {
          playerKey: key, fixtureId: match.id, status, previousStatus: previous === "Not updated" ? "" : previous
        });
        toast("Sheet response updated.");
      } catch (error) {
        moveResponse(status, previous);
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
    selection.addEventListener("change", event => {
      const fixture = activeFixture();
      if (!fixture || saving || !event.target.matches("[data-pick-captain]")) return;
      captainDrafts.set(fixture.id, event.target.value);
      renderSelection(fixture);
      selection.querySelector("[data-pick-captain]")?.focus();
    });
    selection.addEventListener("click", async event => {
      const fixture = activeFixture();
      if (!fixture || saving) return;
      const remove = event.target.closest("[data-pick-remove]");
      if (remove) {
        updatePick(fixture, chosen(fixture).filter(name => name !== remove.dataset.pickRemove));
        [...groups.querySelectorAll("[data-pick-player]")]
          .find(card => card.dataset.pickPlayer === remove.dataset.pickRemove)?.focus({ preventScroll: true });
        return;
      }
      if (!event.target.closest("[data-pick-team-save]") || !canSave(fixture, chosen(fixture))) return;
      const lineupChanged = drafts.has(fixture.id);
      saving = true;
      render();
      try {
        const names = chosen(fixture);
        const match = matchSheet(sheet, rowFor(fixture), dateKey);
        const removed = savedNames(fixture).filter(name => !names.includes(name));
        if (lineupChanged && sheetTeamSync && (names.length || removed.length)) {
          if (loading || message || !match?.id) throw new Error("Refresh availability and check that this fixture matches the sheet before saving.");
          const playerKeys = names.map(name => roster().find(player => player.publicName === name)?.playerKey);
          if (playerKeys.some(key => !key)) throw new Error("Every selected player needs a club profile.");
          if (playerKeys.length) {
            await window.ONMFirebase.availability("selectTeamAvailability", { fixtureId: match.id, playerKeys });
          }
          const removedPlayers = roster().filter(player =>
            removed.includes(player.publicName) && playerStatus(player, match) === "Selected");
          await Promise.all(removedPlayers.map(player => window.ONMFirebase.availability("setTeamAvailability", {
            playerKey: player.playerKey, fixtureId: match.id, previousStatus: "Selected", status: ""
          })));
        }
        await save(fixture, names, captainFor(fixture, names));
        drafts.delete(fixture.id);
        captainDrafts.delete(fixture.id);
        toast(!lineupChanged ? "Captain saved." : sheetTeamSync ? "Team saved and sheet updated." : "Team saved. Sheet sync is pending deployment.");
        await refreshSheet();
      } catch (error) {
        toast(error.message || "Could not save the team.", true);
        if (sheetTeamSync) await refreshSheet();
      } finally {
        saving = false;
        render();
      }
    });
    return {
      open(id) {
        if (id) fixtureId = id;
        render();
        if (!requested && upcoming().length) void refreshSheet();
      }
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { parseCsv, readSheet, matchSheet, playerStatus, defaultCaptain };
  } else {
    window.ONMPickTeam = { init };
  }
})();
