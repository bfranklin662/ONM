export const normalisePlayerName = value => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function playerResultNamePatch(record, names, publicName, playerKey) {
  const previous = new Set(names.map(normalisePlayerName).filter(Boolean));
  const matches = value => previous.has(normalisePlayerName(value));
  const patch = {};
  const row = record.sheetRow || record;
  const prefix = record.sheetRow ? "sheetRow." : "";
  for (const [field, value] of Object.entries(row)) {
    if (/^(?:Player|P)\s*\d+$/i.test(field) && matches(value) && value !== publicName) {
      patch[prefix + field] = publicName;
    }
  }
  for (const side of ["playerOne", "playerTwo"]) {
    const id = record[side + "Id"];
    if ((id ? id === playerKey : matches(record[side + "Name"])) &&
        record[side + "Name"] !== undefined && record[side + "Name"] !== publicName) {
      patch[side + "Name"] = publicName;
    }
  }
  return patch;
}
