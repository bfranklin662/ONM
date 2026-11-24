(function () {
  "use strict";

  const LIMIT = 12;
  const GROUPS = ["Available", "Not sure", "Not updated", "Unavailable"];
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

  function readSheet(rows, dateKey) {
    if (!Array.isArray(rows) || rows.length < 8) throw new Error("Choose the CSV for the Availability tab.");
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
      fixtures.push({ date: dateKey(date), league: leagueKey(header[0]), opponent: opponentKey(opponent), side: sideKey(rows[2]?.[column]), responses, sheetNames });
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
    return [player.availabilitySheetName, player.fullName, player.publicName]
      .map(person).find(key => sheetFixture.responses.has(key));
  }

  function playerStatus(player, sheetFixture) {
    return sheetFixture.responses.get(playerSheetKey(player, sheetFixture)) || "No matching sheet row";
  }

  async function liveRows() {
    const { app } = await window.ONMFirebase.ready;
    const sdk = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js");
    return (await sdk.httpsCallable(sdk.getFunctions(app, "europe-west2"), "getTeamAvailability")({})).data.rows;
  }

  function init({ upcoming, roster, appearances, dateKey, rowFor, photo, escape, save, toast }) {
    const el = id => document.getElementById(id);
    const picker = el("pickTeamFixture");
    const groups = el("pickTeamGroups");
    const selection = el("pickTeamSelection");
    const refresh = el("pickTeamRefresh");
    const csv = el("pickTeamCsv");
    const status = el("pickTeamStatus");
    const drafts = new Map();
    let sheet = [];
    let source = "";
    let message = "";
    let loading = false;
    let saving = false;
    let requested = false;
    let requestVersion = 0;

    function activeFixture() {
      return upcoming().find(item => item.id === picker.value);
    }

    function chosen(fixture) {
      if (drafts.has(fixture.id)) return drafts.get(fixture.id);
      const row = rowFor(fixture);
      return Array.from({ length: LIMIT }, (_, i) => row[`Player${i + 1}`]).filter(Boolean);
    }

    function renderSelection(fixture) {
      const names = chosen(fixture);
      selection.innerHTML = `<div><strong>Selected team · ${names.length}/${LIMIT}</strong>
        <span>${names.length ? names.map(escape).join(" · ") : "Select players below in playing order."}</span></div>
        <button type="button" class="btn btnPrimary" data-pick-team-save${saving || !drafts.has(fixture.id) ? " disabled" : ""}>${saving ? "Saving…" : "Save team"}</button>`;
    }

    function render() {
      const fixtures = upcoming();
      const previous = picker.value;
      picker.replaceChildren(...fixtures.map(item => {
        const row = rowFor(item);
        return new Option(`${row.Date} · ${row.League} · ${row.Opponent} (${sideKey(row.HA).charAt(0).toUpperCase()})`, item.id);
      }));
      if (fixtures.some(item => item.id === previous)) picker.value = previous;
      picker.disabled = saving || !fixtures.length;
      const fixture = activeFixture();
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
      const players = roster().map(player => ({
        player,
        count: appearances(player, fixture.season),
        group: match ? playerStatus(player, match) : "Availability not loaded"
      })).sort((a, b) => b.count - a.count || a.player.publicName.localeCompare(b.player.publicName));
      const linkedNames = new Set(match ? players.map(({ player }) => playerSheetKey(player, match)) : []);
      const unmatched = match ? [...match.sheetNames].filter(([key]) => !linkedNames.has(key)) : [];
      const headings = match ? [...GROUPS, "No matching sheet row"] : ["Availability not loaded"];
      groups.innerHTML = headings.map(heading => {
        const entries = players.filter(entry => entry.group === heading);
        return `<section class="pickTeamGroup"><h3>${escape(heading)} <span>${entries.length}</span></h3>${entries.length ? `<div class="pickTeamCards">${entries.map(({ player, count }) => {
          const selected = names.includes(player.publicName);
          return `<button type="button" class="pickTeamPlayer" data-pick-player="${escape(player.publicName)}" aria-pressed="${selected}"${saving ? " disabled" : ""}>
            <img src="${escape(photo(player))}" width="52" height="52" alt="" loading="lazy">
            <strong>${escape(player.publicName)}</strong>
            <span>${count} ${count === 1 ? "appearance" : "appearances"}</span>
          </button>`;
        }).join("")}</div>` : '<p class="pickTeamEmpty">No players</p>'}</section>`;
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
      const version = ++requestVersion;
      render();
      try {
        const next = readSheet(await liveRows(), dateKey);
        if (version === requestVersion) {
          sheet = next;
          source = "Live availability sheet";
        }
      } catch {
        if (version === requestVersion) {
          message = sheet.length ? `Live availability is unavailable. Showing ${source.toLowerCase()}.` :
            "Live availability is unavailable. Import a CSV from the Availability tab to see the responses.";
        }
      } finally {
        loading = false;
        refresh.disabled = false;
        render();
      }
    }

    picker.addEventListener("change", render);
    refresh.addEventListener("click", refreshSheet);
    csv.addEventListener("change", async () => {
      const file = csv.files[0];
      if (!file) return;
      if (file.size > 2_000_000) {
        toast("Choose the CSV for the Availability tab (under 2 MB).", true);
        csv.value = "";
        return;
      }
      const version = ++requestVersion;
      try {
        const rows = readSheet(parseCsv(await file.text()), dateKey);
        if (version !== requestVersion) return;
        sheet = rows;
        source = "Imported availability CSV";
        message = "";
      } catch (error) {
        toast(error.message, true);
      } finally {
        csv.value = "";
        render();
      }
    });
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
    selection.addEventListener("click", async event => {
      const fixture = activeFixture();
      if (!event.target.closest("[data-pick-team-save]") || !fixture || saving) return;
      saving = true;
      render();
      try {
        await save(fixture, chosen(fixture));
        drafts.delete(fixture.id);
        toast("Team saved. The Match tracker will load these players.");
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
