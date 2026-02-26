# Copilot Instructions for ERP_Accounting_SaaS

## Architecture Overview
- **Monorepo** with `frontend` (React), `backend` (Node.js/Express + Python/Flask), and `database` (SQL schema/scripts).
- **Frontend**: React app (see `frontend/src/`). Uses REST APIs to communicate with backend. Main entry: `App.js`, API helpers: `api.js`.
- **Backend**: Two stacks:
  - **Node.js/Express** (main): Handles most API endpoints, connects to MySQL via `db.js`, routes in `backend/routes/` (e.g., `accounts.js`).
  - **Python/Flask**: Used for some endpoints (e.g., `/add-invoice` in `app.py`).
- **Database**: MySQL, schema in `database/schema.sql`.
- **DevOps**: Docker Compose (`devops/docker-compose.yml`) for orchestrating MySQL, backend, and frontend services.

## Key Workflows
- **Start frontend**: `cd frontend && npm start` (runs on http://localhost:3000)
- **Start backend (Node.js)**: `cd backend && npm start` (runs on http://localhost:5000)
- **Start backend (Flask)**: `cd backend && python app.py` (runs on http://localhost:5000 or another port)
- **Docker Compose**: `docker-compose -f devops/docker-compose.yml up` (runs all services)

## Patterns & Conventions
- **API endpoints**: RESTful, prefixed with `/api/` (see `backend/server.js`, `backend/routes/`).
- **Database access**: Use `db.js` (Node) or direct connector (Flask). Environment variables for DB config.
- **Frontend API calls**: Use `api.js` (fetch) or `axios` (see `Login.js`).
- **Authentication**: JWT-based, token stored in `localStorage` (see `Login.js`).
- **Error handling**: Returns JSON with `error` key on failure.
- **Component structure**: Flat, with screens like `Invoice.js`, `PLScreen.js`, `Dashboard.js`.

## Integration Points
- **Frontend ↔ Backend**: HTTP REST (see `frontend/src/api.js`).
- **Backend ↔ Database**: MySQL, via `mysql2` (Node) or `mysql-connector-python` (Flask).
- **Docker**: Each service has its own build context in Compose.

## Notable Files
- `frontend/src/api.js`: API helpers
- `backend/server.js`: Node.js API server
- `backend/app.py`: Flask API server
- `backend/routes/`: Express route handlers
- `database/schema.sql`: DB schema
- `devops/docker-compose.yml`: Service orchestration

## Project-Specific Notes
- Both Node.js and Flask backends may run simultaneously; ensure ports do not conflict.
- Environment variables (DB credentials, etc.) are loaded from `.env` in backend.
- For new API endpoints, prefer Node.js/Express unless Python/Flask is required.
- Use consistent REST patterns and error responses across all APIs.
