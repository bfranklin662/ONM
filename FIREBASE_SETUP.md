# ONM Firebase setup

The website now uses the existing `oche-ness-monsters` Firebase project for
accounts, player profiles, fixtures, results, match images and darts matches.
The existing Realtime Database remains in place for live online darts.

## 1. Enable the Firebase services

In the Firebase console for `oche-ness-monsters`:

1. Open **Authentication**, choose **Get started**, and enable
   **Email/Password**.
2. In **Authentication → Settings → Authorized domains**, add
   `ochenessmonsters.com` if it is not already listed.
3. Open **Firestore Database**, choose **Create database**, and select
   **Production mode**.
4. Open **Storage** and enable the existing default bucket. Firebase may ask
   for the Blaze billing plan; the club's normal traffic should remain within
   the included allowances.

## 2. Deploy the security rules

From the website folder, run:

```sh
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

The rules deliberately keep player full names behind sign-in. Public visitors
can read only `publicPlayers`, results and fixtures. Match submission requires
a signed-in account linked to an ONM player.

## 3. Create the owner account

Registration offers Player (default), Player + admin, and Supporter. All new
accounts start with the `member` permission role. Player + admin records a
pending request; it does not grant access to club administration. The owner
reviews requests in **Club management → Admin requests**. Approving sets the
permission role to `admin`; declining leaves it as `member`. Existing owners
and administrators retain their access. Deploy the updated Firestore rules
alongside this registration and approval interface: only the owner may change
permission roles or review administration requests.

1. Open `/firebase-migrate.html` and select **Create Firebase account**.
2. In Firebase Console, open **Firestore Database** and then `users`.
3. Open Nick's user document and change `role` from `member` to `owner`.
4. Return to `/firebase-migrate.html` and sign in again if necessary.

Ricky can create an account in the same way. Set his role to `admin` if he
should manage all player profiles and administrative data.

## 4. Import the existing website data

Open `/firebase-migrate.html`, sign in using the owner account, and select
**Import existing website data**.

The importer copies:

- the full-name player directory;
- public player profile details;
- 2024/25, 2025/26 and 2026/27 results currently packaged with the site;
- 2025/26 and 2026/27 fixtures.

It uses stable document IDs, so it is safe to run it again. The private
migration page is not linked from the website and Firebase rules require the
signed-in account to have the `owner` or `admin` role.

## 5. Existing member accounts

Apps Script password hashes cannot be transferred into Firebase
Authentication. Each existing member should use **Create account** once with
their existing email address, then link their player again. After that,
normal sign-in and session recovery are handled by Firebase.

## 6. Final checks before retiring Apps Script

Confirm all of the following on the live site:

- results and fixtures load;
- a signed-in player can search the private full-name directory;
- a linked player can submit a result and upload images;
- a new full name creates a private player record and a shortened public name;
- Nick can edit every player profile;
- ordinary linked members can edit only their own player profile;
- darts matches save and player stats update.

Once those checks pass, Apps Script is no longer used by the website and can
be left in place only as a temporary archive. The final cutover is the single
`FIREBASE_PRIMARY` switch near the top of `scripts/firebase-client.js`. It is
now set to `true` following the successful import of 41 players, 92 results
and 112 fixtures.
