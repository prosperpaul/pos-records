# POS Records

Offline app for POS agents: start day, log transactions, close day, and see profit and any shortage per machine.

## Run it

```
npm install
npm run dev
```

Open the "Network" address it prints (e.g. `http://192.168.x.x:5173`) on a phone connected to the same Wi-Fi.

`npm run build` makes the installable version in `dist/`. Deploy that folder to Vercel or Netlify. Installing to the home screen and working offline need https, which those hosts give you.

## Accounts and owner view (optional)

Without this, the app works fully offline with no login. With it, owners and attendants log in with phone number + 6-digit PIN, records back up online, and the owner sees the attendant's work live.

1. At console.firebase.google.com, create a project (Google Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method**: turn on **Email/Password**. (Phone numbers are turned into internal email addresses, so no email or SMS is ever sent.)
3. **Build → Firestore Database → Create database**: pick a location and **production mode**.
4. In Firestore, open the **Rules** tab, replace everything with `firebase/firestore.rules`, and click **Publish**.
5. **Project settings (gear) → General → Your apps → Web (</>)**: register the app and copy `apiKey`, `authDomain`, `projectId` and `appId` into a new file `.env.local`, using `.env.example` as the template.
6. Restart `npm run dev`. The first screen now offers "I own the stand", "I'm an attendant" and "Log in".

The Firebase config is safe to ship in the app. The rules in `firebase/firestore.rules` stop anyone reading or changing another stand's records.

Free plan limits are roughly 20,000 writes and 50,000 reads a day. Each transaction costs about 2 writes (the record plus its history entry), which is enough for dozens of busy stands. Beyond that, switch to the pay-as-you-go plan; the free amounts still apply on it.

**How it works:** every record is saved on the phone first with `synced: 0`, uploaded when online, then marked `synced: 1`. Other phones of the stand receive changes live from Firebase (`src/cloud.js`). Owners get a join code on the Team page. Attendants join with it, can add and edit transactions, but can't change machines, charges or the team. Edit and delete history can be added to online but never changed. Logging out wipes the phone, and the app warns first if anything isn't backed up.

## How the money is counted

Rules live in `src/money.js`.

| Transaction | Cash drawer | Machine | Profit |
|---|---|---|---|
| Withdrawal A, charge C (deducted from cash given) | −(A − C) | +A − fee | C − fee |
| Transfer/deposit A, charge C (deducted from amount sent) | +A | −(A − C) − fee | C − fee |
| Airtime/bills A, charge C | +(A + C) | −A − fee | C − fee |
| Add cash to drawer (from a machine or outside) | +A | −A − fee if from a machine | −fee |
| Top up machine (from drawer or outside) | −A if from drawer | +A | 0 |
| Expense | −A | | −A |

Close day: expected = opening + all movements; difference = counted − expected, for cash and for each machine.

## Code

- `src/db.js`: on-phone database (Dexie). Records are never removed; deletes and edits are kept in `audit`.
- `src/money.js`: formulas, charge and fee tables.
- `src/cloud.js`: login, sync with Firebase, live updates.
- `firebase/firestore.rules`: who can read and change what online.
- `src/screens/`: Welcome, Account, Team, Setup, Home, StartDay, AddTransaction, History, CloseDay, Days, Settings.
