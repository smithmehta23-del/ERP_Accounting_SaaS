# Docker Deployment

## Prerequisites
- Docker and Docker Compose plugin installed.

## Configure
1. Copy env template:
   ```bash
   cp devops/.env.example devops/.env
   ```
2. Update values in `devops/.env`.

## Run
```bash
docker compose --env-file devops/.env -f devops/docker-compose.yml up -d --build
```

## Services
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- MySQL: localhost:3306

The frontend proxies `/api/*` calls to the backend container.


## Railway
- Root `railway.json` is configured to deploy the backend using `backend/Dockerfile`.
- In Railway, set service variables: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, and (optionally) `PORT`.
