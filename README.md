# Druk Cinema

An admin dashboard with separate frontend and backend applications. The original black, orange, and gold design and transparent logo are preserved.

## Project structure

```text
Druk_Cinema_Booking/
├── frontend/                       # Browser interface
│   ├── index.html                  # Dashboard page and movie form
│   ├── assets/
│   │   ├── css/dashboard.css        # Theme, layout, and responsive styles
│   │   ├── js/
│   │   │   ├── api.js               # Backend URL and HTTP requests
│   │   │   └── dashboard.js         # Rendering and user interactions
│   │   └── images/druk-cinema-logo.png
│   ├── scripts/serve.mjs            # Frontend development server
│   └── package.json
├── backend/                        # Node.js JSON API
│   ├── src/
│   │   ├── server.js               # Configuration and server startup
│   │   ├── app.js                  # HTTP server, CORS, and error handling
│   │   ├── routes/api-routes.js     # API endpoint routing
│   │   ├── controllers/
│   │   │   ├── movie-controller.js
│   │   │   └── dashboard-controller.js
│   │   ├── services/data-store.js   # Serialized, atomic database writes
│   │   ├── data/seed-data.js        # Initial sample records
│   │   └── utils/http.js           # JSON responses and request validation
│   ├── data/druk-cinema.json        # Created at runtime; ignored by Git
│   ├── tests/api.test.js
│   ├── .env.example
│   └── package.json
├── scripts/
│   ├── start-development.mjs       # Start both apps together
│   └── build-frontend.mjs           # Copy frontend assets to dist/
├── artifacts/deployments/          # Preserved archive of the previous demo
├── .openai/hosting.json             # Existing static Sites deployment identity
├── .gitignore
├── package.json
└── README.md
```

## Run locally

Requires Node.js 22 or newer and npm. No third-party dependencies or installation step is needed.

From the project root:

```sh
npm start
```

Open **http://localhost:3000**. The backend runs at **http://localhost:3001**. Stop both with Ctrl+C. Serve the frontend over HTTP; opening the HTML directly is not supported.

To run each app separately in two terminals:

```sh
npm run start:backend
```

```sh
npm run start:frontend
```

The frontend makes HTTP requests to the backend for movies, bookings, showtimes, and dashboard data. Movie creation and status updates are validated and saved to `backend/data/druk-cinema.json`, so they survive browser reloads and server restarts. Previous browser-local movies are not automatically imported.

## Backend configuration

Copy `backend/.env.example` to `backend/.env` if you need custom settings. The backend loads this file at startup. Supported settings are `HOST`, `PORT`, `FRONTEND_ORIGIN`, and optional `DATA_FILE`. If the backend address changes, update `API_BASE_URL` in `frontend/assets/js/api.js` too.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Check server availability |
| GET | `/api/movies` | List movies |
| POST | `/api/movies` | Create a movie |
| PATCH | `/api/movies/:id` | Edit movie fields or status |
| GET | `/api/bookings` | Read bookings with movie titles |
| GET | `/api/showtimes` | Read scheduled screenings for movies now showing |
| GET | `/api/dashboard` | Read sample chart data and database summary |

Example movie request body:

```json
{
  "title": "New film",
  "genre": "Drama",
  "runtime": 120,
  "status": "Coming soon"
}
```

Supported genres: Drama, Romance, Comedy, Adventure, Action. Supported statuses: Now showing, Coming soon. PATCH accepts any subset of the editable fields.

## Checks and build

```sh
npm test
npm run build
```

Tests use an isolated temporary database and exercise validation, persistence, concurrent writes, joined records, API errors, and origin restrictions. The build copies only the frontend into `dist/`; backend files and local data are not included.

## Current scope and hosting

This is a local development backend with sample bookings and screening records. Historical chart values and occupancy are illustrative and labeled as samples; the movie count comes from the database. The API also returns totals calculated from confirmed sample bookings. Bookings and showtimes are read-only, and adding a movie does not create a screening.

The JSON store supports one backend process. Authentication, payment processing, live booking creation, and a production database are not implemented. The backend binds to loopback by default for local use.

The previously published Sites URL remains the earlier standalone demo. This repository refactor has not been deployed: the new Node.js backend needs its own server host, and the frontend API URL and allowed origin must be configured for that host before publishing. The existing static Sites configuration alone cannot run this backend.

## Logo

The provided logo was processed with the built-in image generation tool to remove the white background and preserve the orange ornament and gold symbol. The transparent asset is `frontend/assets/images/druk-cinema-logo.png`.
