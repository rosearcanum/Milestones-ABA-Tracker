# ABA Client Tracker

A centralized, task-first dashboard for managing ABA client documents, referrals (RX), and authorization expirations. Hosted on GitHub Pages — no backend needed.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell — don't edit unless you know HTML |
| `style.css` | Styling — don't edit unless you want to change colors |
| `app.js` | Logic — don't edit unless you want to change behavior |
| `clients.json` | **The only file you need to edit to update client data** |

---

## Setup on GitHub Pages (one time)

1. Go to [github.com](https://github.com) and sign in (or create an account)
2. Click **New repository** → name it something like `aba-tracker` → set to **Private** → click **Create repository**
3. Upload all four files: `index.html`, `style.css`, `app.js`, `clients.json`
4. Go to **Settings → Pages** → under *Source*, select **Deploy from a branch** → choose `main` → click **Save**
5. Wait ~60 seconds, then your dashboard will be live at:
   `https://YOUR-USERNAME.github.io/aba-tracker/`
6. Bookmark that URL — that's your app

---

## How to update client data

All client information lives in `clients.json`. To update it:

1. Go to your GitHub repo
2. Click on `clients.json`
3. Click the pencil icon (Edit)
4. Make your changes (see format below)
5. Click **Commit changes**
6. Refresh your dashboard — changes appear immediately

### clients.json format

Each client looks like this:

```json
{
  "name": "Client Full Name",
  "rx": { "status": "ok", "expiration": "05/22/2026" },
  "insurance_card": "ok",
  "cde": "ok",
  "intake": "missing",
  "basc": "ok",
  "vineland": "expired",
  "auth_expiration": "06/15/2026",
  "bcba": "Alexandra",
  "bcaba": "Susej",
  "insurance": "CMS",
  "notes": "Assessment scheduled for May 3"
}
```

### Field values

| Field | Possible values |
|---|---|
| `rx.status` | `"ok"`, `"missing"`, `"expired"`, `"expiring"` |
| `rx.expiration` | Date string `"MM/DD/YYYY"` or `null` |
| `insurance_card` | `"ok"`, `"missing"`, `"expired"` |
| `cde` | `"ok"`, `"missing"`, `"expired"` |
| `intake` | `"ok"`, `"missing"`, `"expired"` |
| `basc` | `"ok"`, `"missing"`, `"expired"` |
| `vineland` | `"ok"`, `"missing"`, `"expired"` |
| `auth_expiration` | Date string `"MM/DD/YYYY"` or `null` |
| `bcba` | Name string or `null` |
| `bcaba` | Name string or `null` |
| `insurance` | Insurance name string or `null` |
| `notes` | Any text string or `""` |

### Priority logic

The dashboard automatically calculates priority based on:

- **Critical** — RX expired, auth expired, or RX/auth expiring within 7 days, or missing RX entirely
- **Urgent** — RX or auth expiring within 30 days
- **Warning** — any document is missing or expired (insurance card, CDE, intake, BASC, Vineland)
- **All clear** — everything present and not expiring soon

---

## Adding a new client

Copy an existing client block in `clients.json` and change the values. Make sure there's a comma between each client object.

## Removing a client

Delete the entire `{ ... }` block for that client, including the comma before or after it.

---

## Views

| View | What it shows |
|---|---|
| **Task Manager** | Cards sorted by urgency — your daily to-do list |
| **All Clients** | Full table of all clients with all document columns |
| **Documents** | Grouped by document type — who's missing what |
| **Authorizations** | Only clients with auth expiration dates, sorted by days remaining |

Click any client card or row to open a detail panel.
