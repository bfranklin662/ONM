# Availability sheet connection

The account page's **Upcoming fixtures** tab uses the existing availability
sheet as the source of truth. Responses are read live and written back to one
existing dropdown cell. No spreadsheet restructuring, Apps Script, public
write endpoint, browser secrets, or service-account key file is required.

## One-time setup

1. In Google Cloud Console, select `oche-ness-monsters` and enable the
   **Google Sheets API**:
   https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=oche-ness-monsters
2. Deploy the functions from the website repository (Firebase may enable
   Cloud Functions/Cloud Run and create its default runtime account):

   ```sh
   npm --prefix functions install
   npx firebase-tools deploy --only functions:availability
   ```

3. In the availability spreadsheet's **Share** dialog, add this service
   account as **Editor**, without changing existing player access:

   `765901984167-compute@developer.gserviceaccount.com`

   This exact account is set explicitly in `functions/index.js`. If the
   default compute service account does not exist, enable the Compute Engine
   API or create it through the project's normal Cloud setup before deploying.
   Its runtime identity also needs Firestore access (Cloud Datastore User),
   as provided by the Firebase project's existing runtime IAM configuration.

4. Deploy/push the account-page changes using the existing website workflow.
5. Sign in as a linked player, open **My account → Upcoming fixtures**, and
   check the displayed responses against that player's sheet row. Change a
   response and verify the same cell in the sheet, then change it directly in
   the sheet and click **Refresh** on the website.

## Existing layout

Spreadsheet: `1jrh1Ij_H2sidOam3mZY_lCwT-KC5qVp1QNUxxgrUzqQ`.
Tab ID: `1717914264` (`Availability 2026-27`).
Row 1 contains league/day/date/time; rows 2–4 contain opponent, home/away and
venue. Players start at row 8, names are in column A, and fixture responses
start at column C. Column B and summary rows/formulas are left untouched.
The separate fines tab is not accessed.

Player rows match the private Firebase directory's full name first, then the
public club name (e.g. Billiams). Captain suffixes `(c)` and `(vc)` and extra
spaces are ignored. No first-name guesses are made. If a player's sheet name
differs, set `availabilitySheetName` on their private `players/{playerKey}`
document to the exact existing column-A label. For example, the sheet spells
Gary's surname `Hamshere`, while the original directory supplied `Hampshire`.
Do not add this full-name mapping to public player records.

Reads and writes verify the caller's Firebase identity, active account and
linked player server-side. The browser cannot choose a player, row or column.
Past/cancelled fixtures and duplicate fixture headers cannot be edited.
Existing values are checked before saving; if a sheet response changed, the
player must refresh. Only dropdown cells with the expected validation can be
updated. Google Sheets does not provide an atomic compare-and-swap for cell
values, so genuinely simultaneous edits to the same cell still use the last
successful write.

No live writes have been made by this implementation. The above setup and
two-way verification are required before the connection is live.
