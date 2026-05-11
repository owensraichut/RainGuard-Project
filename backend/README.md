# RainGuard-AI Backend

This backend is a local prototype for the RainGuard-AI system.
It uses SQLite to store station metadata, rainfall measurements, and GEV predictions.

## Getting started

1. Install Python dependencies in your virtual environment.
2. Seed the local database:

```bash
c:/Users/sirac/OneDrive/Documents/งานโรงเรียนอุเทนพัฒนา/RainGuard-Project/.venv/Scripts/python.exe backend/ingest.py
```

3. Start the API server:

```bash
c:/Users/sirac/OneDrive/Documents/งานโรงเรียนอุเทนพัฒนา/RainGuard-Project/.venv/Scripts/python.exe -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

4. Open the frontend on `http://localhost:5173`.

## What is implemented

- `db.py` creates SQLite tables for `stations`, `rainfall_data`, and `gev_predictions`
- `ingest.py` seeds rainfall data and computes GEV reports
- `tmd_client.py` includes a generic TMD API helper for future real ingestion
- `main.py` exposes:
  - `GET /api/stations`
  - `GET /api/prediction/{station_id}`
  - `GET /api/alerts`

## Environment variables

You can enable real TMD ingestion by setting:

```bash
USE_REAL_TMD_DATA=1
TMD_API_BASE_URL=https://your-tmd-api-endpoint
TMD_API_TOKEN=your_real_tmd_api_token
```

The current default still falls back to mock rainfall data when real TMD data is unavailable.

## Next steps for production

- Replace SQLite with PostgreSQL / Supabase for persistent data storage
- Implement real TMD API request details in `tmd_client.py`
- Add `react-leaflet` support and QGIS-exported GeoJSON for risk maps
- Alerts are now delivered through the web app using `/api/alerts` instead of LINE Notify
