"use strict";

const ARCHIVE_NOTE = "ONM availability archive: ";

function archiveRecord(note) {
  if (!note?.startsWith(ARCHIVE_NOTE)) return null;
  return JSON.parse(note.slice(ARCHIVE_NOTE.length));
}

function createRosterSheet({ request, base, sheetId, columnName, choices }) {
  const batch = requests => request(`${base}:batchUpdate`, { method: "POST", data: { requests } });
  const rowRange = (startIndex, endIndex) => ({ sheetId, dimension: "ROWS", startIndex, endIndex });
  const rowVisibility = (index, hiddenByUser) => ({ updateDimensionProperties: {
    range: rowRange(index, index + 1), properties: { hiddenByUser }, fields: "hiddenByUser"
  } });
  const text = value => value ? { stringValue: value } : undefined;

  async function rosterNotes(title) {
    const range = encodeURIComponent(`${title}!A8:A`);
    const response = await request(`${base}?ranges=${range}&includeGridData=true&fields=sheets(data(startRow,rowData(values(note))))`);
    const grid = response.sheets?.[0]?.data?.[0];
    return new Map((grid?.rowData || []).map((row, index) => [grid.startRow + index, row.values?.[0]?.note || ""]));
  }

  async function setRosterName(index, name, note, archived) {
    await batch([
      { updateCells: {
        start: { sheetId, rowIndex: index, columnIndex: 0 }, fields: "userEnteredValue,note",
        rows: [{ values: [{ userEnteredValue: text(name), note }] }]
      } },
      rowVisibility(index, archived)
    ]);
  }

  async function addRosterRows(index, names, columnCount) {
    const end = index + names.length;
    const range = { sheetId, startRowIndex: index, endRowIndex: end, startColumnIndex: 2, endColumnIndex: columnCount };
    const lastColumn = columnName(columnCount - 1);
    await batch([
      { insertDimension: { range: rowRange(index, end), inheritFromBefore: true } },
      { updateDimensionProperties: {
        range: rowRange(index, end), properties: { hiddenByUser: false }, fields: "hiddenByUser"
      } },
      { updateCells: {
        start: { sheetId, rowIndex: index, columnIndex: 0 }, fields: "userEnteredValue",
        rows: names.map((name, offset) => {
          const row = index + offset + 1;
          return { values: [
            { userEnteredValue: text(name) },
            { userEnteredValue: { formulaValue: `=COUNTIF(C${row}:${lastColumn}${row},"Available")` } }
          ] };
        })
      } },
      { setDataValidation: { range, rule: {
        condition: { type: "ONE_OF_LIST", values: choices.map(userEnteredValue => ({ userEnteredValue })) },
        strict: true, showCustomUi: true
      } } }
    ]);
  }

  return { rosterNotes, setRosterName, addRosterRows };
}

module.exports = { ARCHIVE_NOTE, archiveRecord, createRosterSheet };
