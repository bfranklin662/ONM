const LEAGUE_STATS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1287781750&single=true&output=csv";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "0";
}

async function fetchLeagueStats(url) {
  const noCacheUrl = `${url}&t=${Date.now()}`;
  const res = await fetch(noCacheUrl);
  const csvText = await res.text();

  const rows = csvText.trim().split("\n").map(r => r.split(","));
  const headers = rows.shift().map(h => h.trim());
  const values = rows[0].map(v => v.trim());

  const stats = {};
  headers.forEach((h, i) => (stats[h] = values[i]));

  return {
    banks: {
      P: stats["Played Banks"] || 0,
      W: stats["Won Banks"] || 0,
      L: stats["Lost Banks"] || 0,
    },
    traf: {
      P: stats["Played Trafalgar"] || 0,
      W: stats["Won Trafalgar"] || 0,
      L: stats["Lost Trafalgar"] || 0,
    }
  };
}

async function initCompsPWL() {
  try {
    const data = await fetchLeagueStats(LEAGUE_STATS_URL);

    setText("banks-p", data.banks.P);
    setText("banks-w", data.banks.W);
    setText("banks-l", data.banks.L);

    setText("traf-p", data.traf.P);
    setText("traf-w", data.traf.W);
    setText("traf-l", data.traf.L);
  } catch (err) {
    console.warn("Failed to load league stats:", err);
  }
}

document.addEventListener("DOMContentLoaded", initCompsPWL);
