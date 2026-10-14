(function () {
  const RESULTS_FALLBACKS = {
    "26-27": "data/result-data-26-27.json",
    "25-26": "data/result-data-25-26.json",
    "24-25": "data/result-data-24-25.json"
  };
  const FIXTURE_FALLBACKS = {
    "26-27": "data/fixtures-26-27.json",
    "25-26": "data/fixtures-25-26.json"
  };
  const resultsPromises = new Map();
  const fixturesPromises = new Map();

  function num(value) {
    const parsed = Number(String(value ?? "").replace(/[£,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function playerValue(row, prefix, index) {
    return row[`${prefix}${index}`] ?? row[`${prefix} ${index}`] ?? "";
  }

  async function fetchResults(season = "26-27") {
    if (resultsPromises.has(season)) return resultsPromises.get(season);

    const promise = (async () => {
      try {
        if (!window.ONMFirebase?.post) throw new Error("Firebase is not ready.");
        const payload = await window.ONMFirebase.post({ action: "getPublicSeasonResults", season });
        if (!payload.success || !Array.isArray(payload.results)) {
          throw new Error(payload.error || "Live results are unavailable.");
        }
        if (!payload.results.length) throw new Error("Firebase results have not been imported yet.");
        return payload.results;
      } catch (error) {
        const fallbackUrl = RESULTS_FALLBACKS[season];
        if (!fallbackUrl) throw error;
        console.warn(`Using the packaged ${season.replace("-", "/")} result data.`, error);
        const fallback = await fetch(`${fallbackUrl}?t=${Date.now()}`);
        if (!fallback.ok) throw new Error(`Failed to load ${season} results: ${fallback.status}`);
        return fallback.json();
      }
    })();
    resultsPromises.set(season, promise);
    return promise;
  }

  async function fetchFixtures(season = "26-27") {
    if (fixturesPromises.has(season)) return fixturesPromises.get(season);

    const promise = (async () => {
      try {
        if (!window.ONMFirebase?.post) throw new Error("Firebase is not ready.");
        const payload = await window.ONMFirebase.post({ action: "getPublicSeasonFixtures", season });
        if (!payload.success || !Array.isArray(payload.fixtures)) {
          throw new Error(payload.error || "Live fixtures are unavailable.");
        }
        if (!payload.fixtures.length) throw new Error("Firebase fixtures have not been imported yet.");
        return payload.fixtures;
      } catch (error) {
        const fallbackUrl = FIXTURE_FALLBACKS[season];
        if (!fallbackUrl) throw error;
        console.warn(`Using the packaged ${season.replace("-", "/")} fixture data.`, error);
        const fallback = await fetch(`${fallbackUrl}?t=${Date.now()}`);
        if (!fallback.ok) throw new Error(`Failed to load ${season} fixtures: ${fallback.status}`);
        return fallback.json();
      }
    })();
    fixturesPromises.set(season, promise);
    return promise;
  }

  function buildPlayerStats(rows, competition = "all") {
    const players = new Map();

    rows
      .filter(row => competition === "all" || row.Competition === competition)
      .forEach(row => {
        for (let index = 1; index <= 12; index += 1) {
          const name = String(playerValue(row, "Player", index)).trim();
          if (!name) continue;

          if (!players.has(name)) {
            players.set(name, {
              Player: name,
              Played: 0,
              Checkouts: 0,
              Fines: 0,
              "Double Fines": 0,
              "180s": 0,
              "Bull-outs": 0,
              "Ton+ Outs": 0
            });
          }

          const stats = players.get(name);
          stats.Played += 1;
          stats.Checkouts += num(playerValue(row, "C", index));
          stats.Fines += num(playerValue(row, "F", index));
          stats["Double Fines"] += /^(true|yes|1)$/i.test(String(playerValue(row, "D", index)));
          stats["180s"] += num(playerValue(row, "O", index));
          stats["Bull-outs"] += num(playerValue(row, "B", index));
          stats["Ton+ Outs"] += num(playerValue(row, "T", index));
        }
      });

    return Array.from(players.values())
      .map(stats => ({
        ...stats,
        "Checkouts/game": stats.Played ? Number((stats.Checkouts / stats.Played).toFixed(2)) : 0,
        Fines: `£${stats.Fines.toFixed(2)}`,
        "Fines/game": `£${(stats.Played ? stats.Fines / stats.Played : 0).toFixed(2)}`
      }))
      .sort((a, b) => b.Checkouts - a.Checkouts || a.Player.localeCompare(b.Player));
  }

  function buildWonLost(rows) {
    const result = {};
    const competitions = {
      "Banks League": "Banks",
      "Trafalgar League": "Trafalgar"
    };

    Object.entries(competitions).forEach(([competition, suffix]) => {
      const matches = rows.filter(row => row.Competition === competition);
      result[`Played ${suffix}`] = matches.length;
      result[`Won ${suffix}`] = matches.filter(row => /^won$/i.test(String(row.Result))).length;
      result[`Lost ${suffix}`] = matches.filter(row => /^lost$/i.test(String(row.Result))).length;
    });

    result["Played All"] = rows.length;
    result["Won All"] = rows.filter(row => /^won$/i.test(String(row.Result))).length;
    result["Lost All"] = rows.filter(row => /^lost$/i.test(String(row.Result))).length;
    return [result];
  }

  async function fetchSource(source) {
    const parts = String(source || "").split(":");
    const season = /^\d{2}-\d{2}$/.test(parts.at(-1)) ? parts.at(-1) : "26-27";
    const rows = await fetchResults(season);
    if (parts[1] === "results") return rows;
    if (parts[1] === "stats" && parts[2] === "all") return buildPlayerStats(rows);
    if (parts[1] === "stats" && parts[2] === "banks") return buildPlayerStats(rows, "Banks League");
    if (parts[1] === "stats" && parts[2] === "trafalgar") return buildPlayerStats(rows, "Trafalgar League");
    if (parts[1] === "stats" && parts[2] === "smithfield") return buildPlayerStats(rows, "Smithfield League");
    if (parts[1] === "stats" && parts[2] === "colda-a") return buildPlayerStats(rows, "COLDA A");
    if (parts[1] === "stats" && parts[2] === "colda-b") return buildPlayerStats(rows, "COLDA B");
    if (parts[1] === "won-lost") return buildWonLost(rows);
    return [];
  }

  window.ONMSeasonData = { fetchResults, fetchFixtures, fetchSource };
})();
