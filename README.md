# GeoFix 167

Incident Reporting and Emergency Response System for Barangay 167.

## Requirements

- [Node.js](https://nodejs.org/) (v18+)
- [Git](https://git-scm.com/)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/deybdev/geofix167
cd geofix167
```

### 2. Install dependencies

```bash
# frontend
cd client
npm install

# backend
cd ../server
npm install
```

### 3. Set up the local database

```bash
# still inside the server/ folder
npm run db:migrate
```

### 4. Start the backend

```bash
# inside server/
npm run dev
```

Backend runs at `http://localhost:8787`.

### 5. Start the frontend

Open a second terminal from the project root:

```bash
cd client
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Demo Accounts

| Role      | Mobile                 | Password    |
|-----------|------------------------|-------------|
| Admin     | 09123123123            | password    |
| Resident  | 09246246246            | password    |
| Responder | 09369369369            | password    |

## Notes

- Keep both terminals running while developing.
- The migration command uses Wrangler's `--local` flag to keep the database on your machine.
- Never commit `.wrangler/` or any `.env` files to GitHub.
- Run `npm run db:migrate` inside `server/` so the command checks the mobile auth migration history before Wrangler applies local migrations. If it finds a verified `0030_consolidate_mobile_auth_flows.sql` record, it exports a backup to `server/.wrangler/backups/` and renames that record to `0035_consolidate_mobile_auth_flows.sql`. If the history and schema disagree, the command stops with a diagnostic.
