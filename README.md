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
npx wrangler d1 migrations apply geofix167_db --local
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
- The `--local` flag keeps the database on your machine — nothing is sent to Cloudflare.
- Never commit `.wrangler/` or any `.env` files to GitHub.
- Run `npx wrangler d1 migrations apply geofix167-db --local` inside `server/` whenever you add a new migration.
