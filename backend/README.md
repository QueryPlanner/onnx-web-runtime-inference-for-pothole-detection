# Pothole Detection Backend

FastAPI backend for storing and visualizing pothole detection reports with GPS coordinates.

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Configuration

Create a `.env` file in the `backend/` directory with your NeonDB connection string:

```
NEON_DATABASE_URL=postgres://user:password@host.neon.tech/dbname
```

Get your connection string from [Neon Console](https://console.neon.tech).

### 3. Database Schema

Run this SQL query in your Neon console to create the pothole_reports table:

```sql
CREATE TABLE pothole_reports (
    id SERIAL PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    pothole_count INTEGER NOT NULL,
    image_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Running the Backend

```bash
uvicorn main:app --reload --port 8001
```

The backend will be available at `http://localhost:8001`.

## API Endpoints

### POST `/api/report`

Store a pothole detection report.

**Parameters:**
- `file` (UploadFile): Image file
- `latitude` (float): GPS latitude
- `longitude` (float): GPS longitude
- `pothole_count` (int): Number of potholes detected

**Response:**
```json
{
    "status": "success",
    "message": "Pothole report saved successfully"
}
```

### GET `/api/map`

Generate an interactive folium map with heatmap and markers of all pothole reports.

**Response:** HTML page with interactive Folium map

## Development Notes

- CORS is enabled for all origins to support development scenarios
- The database pool is automatically initialized on startup and closed on shutdown
- All endpoints include comprehensive error handling and logging
