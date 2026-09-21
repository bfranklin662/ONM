const LEAGUE_STATS_URL =
  "data/won-lost-25-26.json";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "0";
}

async function fetchLeagueStats(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load league stats: ${res.status}`);
  const [stats = {}] = await res.json();

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
    },
    smithfield: {
      P: stats["Played Smithfield"] || 0,
      W: stats["Won Smithfield"] || 0,
      L: stats["Lost Smithfield"] || 0,
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

    setText("smithfield-p", data.smithfield.P);
    setText("smithfield-w", data.smithfield.W);
    setText("smithfield-l", data.smithfield.L);
  } catch (err) {
    console.warn("Failed to load league stats:", err);
  }
}

document.addEventListener("DOMContentLoaded", initCompsPWL);
