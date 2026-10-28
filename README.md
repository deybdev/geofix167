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
npx wrangler d1 execute geofix167-db --local --file=./src/migrations/0001_auth.sql
npx wrangler d1 execute geofix167-db --local --file=./src/seeds/seed-local.sql
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

| Role      | Email                  | Password    |
|-----------|------------------------|-------------|
| Admin     | admin@gmail.com        | password123 |
| Resident  | resident@gmail.com     | password123 |
| Responder | responder@gmail.com    | password123 |

## Notes

- Keep both terminals running while developing.
- The `--local` flag keeps the database on your machine — nothing is sent to Cloudflare.
- Never commit `.wrangler/` or any `.env` files to GitHub.
