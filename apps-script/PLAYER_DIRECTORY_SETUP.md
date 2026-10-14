# Dynamic player directory setup

The website already submits each player's private full name and public display name. These changes make Apps Script keep the full-name autocomplete directory in a hidden sheet and add new players only after a result has been saved.

## 1. Replace the old hard-coded directory

In `Season2026_27.gs`, delete the complete `MATCH_PLAYER_DIRECTORY` constant and the existing `getMatchPlayerDirectory(payload)` function.

Create a new Apps Script file named `PlayerDirectory.gs` and paste in the complete contents of this repository's `apps-script/PlayerDirectory.gs` file.

## 2. Add the automatic save call

In `Code.gs`, find this section near the end of `doPost`:

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

The tab has four columns: `FullName`, `PublicName`, `PlayerKey`, and `AddedAt`. It includes the existing directory, with `Alfie Sell` corrected.

## 4. Deploy the update

Edit the existing web-app deployment, select **New version**, and deploy it. Keep the same deployment rather than creating a separate one so the website endpoint remains unchanged.

After deployment, a new full name such as `Connor Merrick` is added to the hidden directory after the result is successfully submitted. Because there is no other Connor, his public name is `Connor`. If a different Connor is added later, the new player receives a surname initial.
