(function (root) {
  const banks = { "26-27": "Premier", "25-26": "Division 1", "24-25": "Division 2" };
  function label(league, season) {
    if (/^trafalgar(?: league)?$/i.test(String(league).trim()) && ["26-27", "25-26"].includes(season)) return "Trafalgar Division 1";
    return /^banks(?: league)?$/i.test(String(league).trim()) && banks[season]
      ? `Banks ${banks[season]}` : league;
  }
  function seasonFromDate(value) {
    const text = String(value || "").trim();
    const uk = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const date = value instanceof Date ? value : uk ? new Date(+uk[3], +uk[2] - 1, +uk[1]) : new Date(text);
    if (isNaN(date)) return "";
    const year = date.getFullYear() - (date.getMonth() < 6 ? 1 : 0);
    return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
  }
  function isCup(row) { return [true, "true", "yes", "1"].includes(typeof row["Cup?"] === "string" ? row["Cup?"].toLowerCase() : row["Cup?"]) || /cup|guthrie/i.test(row.Competition || ""); }
  function shortLabel(league, season, cup = false) {
    const text = cup ? String(league).replace(/ league/i, "").replace(/ cup/i, "") + " Cup" : label(league, season);
    return text.replace(/Premier/g, "Prem").replace(/Division/g, "Div").replace(/ League/g, "");
  }
  const api = { label, seasonFromDate, isCup, shortLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ONMLeagueDivisions = api;
})(typeof window !== "undefined" ? window : globalThis);
