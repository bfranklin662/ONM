(function () {
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbwXZp0rgR2xYo1S7P-512FzoOlWjMfJaRcRPpRVzTkBiWGUEWEbQ25V3_vcLBse_rt5wA/exec";
  const FALLBACK_URL = "data/result-data-26-27.json";
  const FIXTURES_FALLBACK_URL = "data/fixtures-26-27.json";
  let resultsPromise = null;
  let fixturesPromise = null;

  function num(value) {
    const parsed = Number(String(value ?? "").replace(/[£,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function playerValue(row, prefix, index) {
    return row[`${prefix}${index}`] ?? row[`${prefix} ${index}`] ?? "";
  }

  async function fetchResults() {
    if (resultsPromise) return resultsPromise;

    resultsPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "getPublicSeasonResults" }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const payload = await response.json();
        if (!payload.success || !Array.isArray(payload.results)) {
          throw new Error(payload.error || "Live results are unavailable.");
        }
        return payload.results;
      } catch (error) {
        console.warn("Using the packaged 26/27 result data.", error);
        const fallback = await fetch(`${FALLBACK_URL}?t=${Date.now()}`);
        if (!fallback.ok) throw new Error(`Failed to load 26/27 results: ${fallback.status}`);
        return fallback.json();
      }
    })();

    return resultsPromise;
  }

  async function fetchFixtures() {
    if (fixturesPromise) return fixturesPromise;

    fixturesPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "getPublicSeasonFixtures" }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const payload = await response.json();
        if (!payload.success || !Array.isArray(payload.fixtures)) {
          throw new Error(payload.error || "Live fixtures are unavailable.");
        }
        return payload.fixtures;
      } catch (error) {
        console.warn("Using the packaged 26/27 fixture data.", error);
        const fallback = await fetch(`${FIXTURES_FALLBACK_URL}?t=${Date.now()}`);
        if (!fallback.ok) throw new Error(`Failed to load 26/27 fixtures: ${fallback.status}`);
        return fallback.json();
      }
    })();

    return fixturesPromise;
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
    const rows = await fetchResults();
    if (source === "onm-live:results") return rows;
    if (source === "onm-live:stats:all") return buildPlayerStats(rows);
    if (source === "onm-live:stats:banks") return buildPlayerStats(rows, "Banks League");
    if (source === "onm-live:stats:trafalgar") return buildPlayerStats(rows, "Trafalgar League");
    if (source === "onm-live:won-lost") return buildWonLost(rows);
    return [];
  }

  window.ONMSeasonData = { fetchResults, fetchFixtures, fetchSource };
})();
