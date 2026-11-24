"use strict";

const ARCHIVE_NOTE = "ONM availability archive: ";

function archiveRecord(note) {
  if (!note?.startsWith(ARCHIVE_NOTE)) return null;
  return JSON.parse(note.slice(ARCHIVE_NOTE.length));
}

function createRosterSheet({ request, base, sheetId, columnName }) {
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

  const copyNormalValidation = destination => ({ copyPaste: {
    source: { sheetId, startRowIndex: 7, endRowIndex: 8, startColumnIndex: 2, endColumnIndex: 3 },
    destination, pasteType: "PASTE_DATA_VALIDATION", pasteOrientation: "NORMAL"
  } });
  const selectedRule = {
    condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "Selected" }] },
    strict: true, showCustomUi: false
  };
  const deleteRosterRow = index => batch([{ deleteDimension: { range: rowRange(index, index + 1) } }]);

  async function addRosterRows(index, names, columnCount, restored = []) {
    const end = index + names.length;
    const range = { sheetId, startRowIndex: index, endRowIndex: end, startColumnIndex: 2, endColumnIndex: columnCount };
    const lastColumn = columnName(columnCount - 1);
    await batch([
      { insertDimension: { range: rowRange(index, end), inheritFromBefore: true } },
      ...names.map((_, offset) => rowVisibility(index + offset, false)),
      { updateCells: {
        start: { sheetId, rowIndex: index, columnIndex: 0 }, fields: "userEnteredValue,note",
        rows: names.map((name, offset) => {
          const row = index + offset + 1;
          return { values: [
            { userEnteredValue: text(name), note: restored[offset]?.note },
            { userEnteredValue: { formulaValue: `=COUNTIF(C${row}:${lastColumn}${row},"Available")` } },
            ...Array.from({ length: columnCount - 2 }, (_, col) => ({
              userEnteredValue: text(restored[offset]?.responses?.[col + 2])
            }))
          ] };
        })
      } },
      copyNormalValidation(range),
      ...restored.flatMap(({ responses }, offset) => Object.entries(responses).flatMap(([column, value]) => {
        if (value !== "Selected") return [];
        const startColumnIndex = Number(column);
        return [{ setDataValidation: { range: {
          sheetId, startRowIndex: index + offset, endRowIndex: index + offset + 1,
          startColumnIndex, endColumnIndex: startColumnIndex + 1
        }, rule: selectedRule } }];
      }))
    ]);
  }

  return { rosterNotes, setRosterName, addRosterRows, deleteRosterRow, copyNormalValidation };
}

module.exports = { ARCHIVE_NOTE, archiveRecord, createRosterSheet };
