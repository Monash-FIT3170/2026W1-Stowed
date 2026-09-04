# Stowed

**Stowed** is an inventory and stock management web app built with [Meteor](https://www.meteor.com/) and React. It lets an organisation define physical sites, floor maps and storage units, track products stored in those locations, run stocktakes, generate/scan QR codes for units and products, manage shopping lists with email sharing, and schedule recurring stock tasks.

Below is a structured draft handover, so future contributors can get the project running and understand its shape quickly. It will be refined further before final handover.

## Team Members
- Scott Nguyen: sngu0065@student.monash.edu
- Josh Dinn: jdin0044@student.monash.edu
- David Stuchbery: dstu0009@student.monash.edu
- Rikki Wallis: rwal0028@student.monash.edu
- Tim Blair: tbla0009@student.monash.edu
- Selena Xue Yue Tan: stan0231@student.monash.edu
- Hamzah Khan: hkha0037@student.monash.edu
- Jason Huang: jhua0160@student.monash.edu
- Andrew Ho: ahoo0035@student.monash.edu
- Jessica Pianta: jpia0005@student.monash.edu
- Chi Cheng (Ivana) Chan: ccha0249@student.monash.edu
- Jordan Leong: jleo0051@student.monash.edu
- Sameeksha Manjunath: sman0077@student.monash.edu

---

## 1. Software & Hardware Requirements

### Software
| Requirement | Version / Notes |
|---|---|
| **Node.js** | v20+ recommended (CI uses Node 22) - [Download](https://nodejs.org/) |
| **Meteor** | `3.4.1` (pinned in `Stowed/.meteor/release`). Install with `npm install -g meteor`, or let the Meteor installer script manage it. |
| **MongoDB** | Not installed manually - Meteor spins up a local MongoDB instance automatically in development. |
| **Git** | Any recent version, for cloning/branching. |
| **A modern browser** | Chrome/Edge/Firefox - the UI uses the camera (via `html5-qrcode`) for QR scanning features. |
| **Resend account (optional)** | Only needed if you want outgoing emails (shopping list sharing) to actually send - see [Environment variables](#3-environment-variables--secrets). |

### Hardware
- Any laptop/desktop capable of running Node.js and Meteor (no special hardware needed for development).
- A webcam is required to test the in-app QR/barcode scanning features (`ScanPage`, `ScanUpdatePage`) - scanning uses the device camera through the browser. QR generation (`QRCodesPage`) does not need a camera.
- No physical barcode scanner is required - any USB/Bluetooth barcode scanner that emulates keyboard input, or the device camera, will work with the scan pages.

---

## 2. Project Structure

```
2026W1-Stowed/
|-- .github/workflows/    # CI (lint/test) + CD (deploy to Galaxy) + manual DB reset workflow
|-- Stowed/               # The Meteor application (this is the app root)
|   |-- client/           # Client entrypoint (client/main.jsx)
|   |-- server/           # Server entrypoint, seeding, email sending (server/main.js)
|   |-- imports/
|   |   |-- api/          # Meteor methods, publications, collections (per feature: products,
|   |   |                   categories, locations, shoppingLists, schedules, importRecords, seedData)
|   |   `-- ui/            # React pages, components and hooks
|   |-- public/            # Static assets
|   |-- Uploads/            # Uploaded product/location images (created at runtime)
|   |-- tests/               # Mocha test entrypoint (tests/main.js)
|   `-- package.json
`-- README.md                # This file
```

Note that Meteor apps do not have a traditional REST backend - `imports/api` defines Meteor Methods and Publications that the React UI in `imports/ui` calls directly.

### Key Features (`imports/ui/pages`)
- **Dashboard, Inventory List, Product Detail/Create/Edit** - core product CRUD & stock levels.
- **Locations, Floor Map (Konva canvas), Storage Unit Detail** - define sites and draw floor plans, place storage units.
- **QR Codes, Scan, Scan Settings, Scan Update** - generate QR codes for units/products and scan them with a camera to update stock.
- **Stocktake** - reconcile counted stock against recorded stock.
- **Shopping Lists + Share Email Modal** - build lists and email them via Resend.
- **Schedules** - recurring stock-related tasks (see `imports/api/schedules`).
- **Settings, View Accounts** - org/user administration (role-gated, see `ROLES` in `imports/api/roles`).

---

## 3. Running the Project Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Monash-FIT3170/2026W1-Stowed.git
   cd 2026W1-Stowed/Stowed
   ```

2. **Install Meteor** (if not already installed):
   ```bash
   npm install -g meteor
   ```
   or use the official installer per [meteor.com/install](https://www.meteor.com/install).

3. **Install dependencies:**
   ```bash
   meteor npm install
   ```

4. **(Optional) Configure secrets** — see [Environment variables](#4-environment-variables--secrets) below if you need outgoing email or the seed-reset endpoint locally. Without any configuration the app still runs fine; email sending will just throw a clear "not configured" error if triggered.

5. **Run the app in development mode:**
   ```bash
   npm start
   ```
   (equivalent to `meteor run`). The app is served at **http://localhost:3000**.

   On first startup, `Meteor.startup` in `server/main.js` calls `seedDatabase()` (see `server/seed.js`), which seeds a demo organisation, fake user accounts, sample products, locations, shopping lists and schedules if the database is empty - so you should have working demo data immediately. 
    - If you'd like to remove seeding, simply comment out `await seedDatabase();` from `Meteor.startup` in `server/main.js` 

6. Log in with one of the seeded demo accounts (see `imports/api/seedData/users.js` for the generated credentials), or register a new account through the app.

### Running tests
```bash
npm test          # run the Mocha test suite once
npm run test-app  # watch mode, full app context (TEST_WATCH=1)
```

### Linting & formatting
```bash
npm run lint         # ESLint
npm run lint:fix      # ESLint with autofix
npm run format        # Prettier - write
npm run format:check  # Prettier - check only (used in CI)
```

---

## 4. Environment Variables & Secrets

Meteor apps read secrets either from `process.env` or from a `Stowed/settings.json` file passed with `meteor run --settings settings.json` (this file is gitignored — never commit it). Locally you can create it as:

```json
{
  "RESEND_API_KEY": "re_xxx",
  "RESEND_FROM": "myapp@resend.dev",
  "RESET_SEED_TOKEN": "some-local-dev-token"
}
```

| Variable | Used for | Required? |
|---|---|---|
| `RESEND_API_KEY` | Sending shopping-list share emails via [Resend](https://resend.com/) (`server/email/resend.js`) | Only if you need outgoing email to actually send. Without it, email attempts throw a `resend-not-configured` error. |
| `RESEND_FROM` | The "from" address used for sent emails | Optional - defaults to `myapp@resend.dev`. |
| `RESET_SEED_TOKEN` | Protects the `/admin/reset-seed` HTTP endpoint (`server/main.js`) that wipes and reseeds the database | Optional - the route returns 404 (as if it doesn't exist) if unset. |

In production (Galaxy), these are set as Galaxy environment variables, and `METEOR_SESSION` / `GALAXY_APP_URL` / `RESET_SEED_TOKEN` are configured as GitHub Actions secrets/variables for the deploy and reset-seed workflows (see below).

---

## 5. CI/CD & Deployment

- **CI** (`.github/workflows/ci.yml`) runs on every push/PR to `main` and `develop`:
  - **Lint & format check** - ESLint + Prettier.
  - **Test** - installs Meteor 3.4.1 and runs `npm test`.
- **Deploy** (same workflow) - on a direct push to `main` (after lint & test pass), deploys to **Meteor Galaxy** (free tier) using:
  - `secrets.METEOR_SESSION` - a base64-encoded Meteor login session (`~/.meteorsession`) with deploy rights to the Galaxy app.
  - `vars.GALAXY_APP_URL` - the target Galaxy app URL/name.
- **Manual DB reset** (`.github/workflows/reset-seed.yml`) - a manually-triggered workflow (Actions tab → "Run workflow", type `RESET` to confirm) that calls the deployed app's `/admin/reset-seed` endpoint to wipe and reseed the **deployed** database. Requires `secrets.RESET_SEED_TOKEN` to match the value configured on the Galaxy app, and is intentionally destructive - use with care, and only against the demo/staging deployment.

If future maintainers need to redeploy manually, use `meteor deploy <app-url> --free` from inside `Stowed/`, logged into the correct Meteor account (`meteor login`).

---

## 6. Useful Notes

- **Two `package.json` / `package-lock.json` pairs exist**: one at the repo root (mostly a placeholder) and the real one inside `Stowed/`. Always run `npm`/`meteor npm` commands **from inside `Stowed/`**, not the repo root.
- **First `meteor run` is slow** - Meteor downloads/builds its toolchain and local MongoDB on first run; subsequent runs are much faster.
- **Seed data runs automatically** on every server startup if collections are empty (`server/seed.js`), so a fresh clone should never start "empty". If your local data looks stale/broken, you can drop the local Mongo data with `meteor reset` (**Warning:** this wipes your **local** dev database only, not production) and restart. To remove seeding logic, comment out `await seedDatabase();` from `Meteor.startup` in `server/main.js` 
- **QR/barcode scanning requires HTTPS or `localhost`** - browsers only allow camera access on secure contexts. `localhost:3000` works fine in dev; a non-`localhost` LAN URL will need HTTPS to use the scanner.
- **Email sending is optional in dev** - without `RESEND_API_KEY` configured, any code path that tries to send an email will throw a `Meteor.Error("resend-not-configured", …)`, which is expected and safe to ignore unless you're actively testing email.
- **Roles** - user permissions are gated by `ROLES` (see `imports/api/roles.js`); some publications/methods (e.g. viewing all org users) throw `unauthorized` for non-owners. Check a seeded user's `profile.role` if you hit unexpected 403-style errors.
- **`.meteor/` folder** - don't hand-edit files in `Stowed/.meteor/` other than `packages` (via `meteor add`/`meteor remove`); `release` and `versions` are managed by the Meteor tool.
- **Floor map editor** uses `react-konva`/`konva` - if you see canvas-related console errors, check that `poly-decomp-es` (used for polygon shapes) is installed correctly (`meteor npm install`).
- **Styling** uses Tailwind CSS v4 via `@tailwindcss/postcss` - utility classes are used throughout `imports/ui`; component-specific `.css` files sit alongside their `.jsx` files for anything Tailwind doesn't cover cleanly.

---

## 7. Suggested Next Steps for Future Contributors

- Expand automated test coverage - current tests (`tests/`) are limited; the scanning, floor-map and scheduling features would especially benefit from more coverage.
- Document the Meteor Methods/Publications API surface (`imports/api/**/methods.js`, `publications.js`) more formally, e.g. with JSDoc or a generated API reference.
- Consider adding a proper `.env.example` / `settings.example.json` to the repo to make required secrets more discoverable for new contributors.
- Review Galaxy free-tier limits (sleep/inactivity, storage) if the deployed demo needs to stay reliably available.

---

## 8. Available Scripts (from `Stowed/`)

- `npm start` - Start the development server
- `npm test` - Run tests once
- `npm run test-app` - Run tests in watch mode with full app context
- `npm run lint` / `npm run lint:fix` - ESLint check / autofix
- `npm run format` / `npm run format:check` - Prettier write / check
- `npm run visualize` - Visualize the production bundle
