# Result Processing System

Single-server deployment setup for IntelGrade.

## Run locally

1. Set `backend-express/.env` with `MONGO_URI` and `JWT_SECRET`.
2. From the repo root, run:

```bash
npm install
npm start
```

3. Open `http://localhost:5000`.

## Deploy publicly

This project is designed to run as one public web app, so users can open it from any device on any Wi-Fi.

Required environment variables:

```bash
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
CORS_ORIGIN=https://your-public-domain.com
CLIENT_ORIGIN=https://your-public-domain.com
```

Deployment flow:

1. Deploy the repo root as a single web service.
2. Use the included `render.yaml` blueprint or set:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
3. The backend serves the React frontend build automatically.

If you use a separate frontend domain, set:

```bash
REACT_APP_API_URL=https://your-backend-domain.com/api
```

But if the frontend and backend are served from the same server, you do not need that variable.
