# Dynamic player directory setup

The website already submits each player's private full name and public display name. These changes make Apps Script keep the full-name autocomplete directory in a hidden sheet and add new players only after a result has been saved.

The same sheet also supplies public player-profile details. Full names are never returned by the public profile endpoint, and only active signed-in users can save profile edits.

## 1. Replace the old hard-coded directory

In `Season2026_27.gs`, delete the complete `MATCH_PLAYER_DIRECTORY` constant and the existing `getMatchPlayerDirectory(payload)` function.

Create a new Apps Script file named `PlayerDirectory.gs` and paste in the complete contents of this repository's `apps-script/PlayerDirectory.gs` file.

## Results tab location

The 2026/27 results tab can live inside the existing 2025/26 workbook that owns this Apps Script. Name the new tab exactly `Result data 26/27`, paste in the existing headers and results, then use this configuration in `Season2026_27.gs`:

```js
const RESULTS_SHEET_NAME = "Result data 26/27";

function getResultsDataSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(RESULTS_SHEET_NAME);

  if (!sheet) {
    throw new Error("2026/27 results sheet not found: " + RESULTS_SHEET_NAME);
  }

  return sheet;
}
```

Delete the old `RESULTS_SPREADSHEET_ID` constant and do not keep a second `getResultsDataSheet()` function. The player directory now automatically uses the same workbook as this results tab.

## 2. Add the automatic save call

In `Code.gs`, find the action checks inside `doPost`. Immediately after the existing `getMatchPlayerDirectory` check, add all three public/profile handlers if they are not already present:

```js
if (payload.action === "getPublicSeasonResults") {
  return getPublicSeasonResults();
}

if (payload.action === "getPublicPlayerProfiles") {
  return getPublicPlayerProfiles();
}

if (payload.action === "updatePlayerProfile") {
  return updatePlayerProfile(payload);
}
```

Then find this section near the end of `doPost`:

```js
rebuildFinesSummary();

return jsonResponse({
  success: true,
  folderUrl,
  rowNumber
});
```

Replace it with:

```js
rebuildFinesSummary();

try {
  syncSubmittedPlayersToDirectory(payload.players || []);
} catch (directoryError) {
  console.error("Result saved, but the player directory was not updated", directoryError);
}

return jsonResponse({
  success: true,
  folderUrl,
  rowNumber
});
```

Keeping this update non-blocking prevents a directory problem from making an already-saved result look as though it failed.

## 3. Create and seed the sheet

1. Save the Apps Script project.
2. Select `setupPlayerDirectory` from the function menu.
3. Click **Run** and approve access if Google requests it.
4. A hidden `Player Directory` tab will be created in the 2026/27 results spreadsheet.

The tab includes the private matching fields plus nickname, photo link, bio, accolades, role, walkout song, highest checkout, Gooch and profile visibility. It includes the existing directory, corrects `Alfie Sell`, and imports the current profile information from the website JSON without overwriting later sheet edits.

## 4. Deploy the update

Edit the existing web-app deployment, select **New version**, and deploy it. Keep the same deployment rather than creating a separate one so the website endpoint remains unchanged.

After deployment, a new full name such as `Connor Merrick` is added to the hidden directory after the result is successfully submitted. Because there is no other Connor, his public name is `Connor`. If a different Connor is added later, the new player receives a surname initial.

New players receive a blank but visible profile. Any active signed-in website user will see an **Edit player** button on player profile pages and can fill in the public attributes. Logged-out visitors can view profiles but cannot edit them. The public API never includes the `FullName` column.
