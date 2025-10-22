<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Pothole Detection System

ONNX-powered pothole detection with GPS-enabled reporting and interactive mapping.

## System Overview

The system consists of two main components:

1. **Frontend** (React + TypeScript): Upload images, detect potholes using ONNX Runtime, extract GPS from EXIF
2. **Backend** (FastAPI): Store detection reports in NeonDB, generate interactive maps

## Prerequisites

- **Node.js** (v18+)
- **Python** (v3.8+)
- **NeonDB** database (PostgreSQL serverless)
- **npm** or **pnpm** package manager

## Local Development Setup

### 1. Frontend Setup

```bash
# Install dependencies
npm install
# or
pnpm install

# Start development server
npm run dev
# or
pnpm dev
```

Frontend runs on `http://localhost:3000`

### 2. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Create .env file with your NeonDB connection string
# NEON_DATABASE_URL=postgres://user:password@host.neon.tech/dbname

# Run the backend server
uvicorn main:app --reload --port 8001
```

Backend runs on `http://localhost:8001`

### 3. Database Setup

Run this SQL in your Neon console to create the pothole_reports table:

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

## Features

### Frontend
- 📸 Upload image files for pothole detection
- 🗺️ Automatic GPS extraction from EXIF metadata
- 🤖 Real-time AI detection using ONNX Runtime
- 📊 Display detection results with confidence scores
- 📡 Auto-upload reports to backend when GPS data available
- 🗺️ View interactive map of all reported potholes

### Backend
- 💾 Store pothole reports with GPS coordinates
- 🔥 Heatmap visualization of high-risk areas
- 📍 Interactive folium-based map interface
- ⚡ Async database operations with connection pooling
- 🔒 CORS enabled for development

## API Endpoints

### POST `/api/report`
Store a pothole detection report with GPS and image data.

**Request:**
```
Content-Type: multipart/form-data

- file: (image file)
- latitude: (float)
- longitude: (float)
- pothole_count: (integer)
```

**Response:**
```json
{
    "status": "success",
    "message": "Pothole report saved successfully"
}
```

### GET `/api/map`
Returns an interactive HTML map with heatmap overlay and markers.

## Development Workflow

1. **Upload Image**: Click "UPLOAD" button and select an image with GPS metadata
2. **Detection**: System automatically detects potholes in the image
3. **Report**: If potholes found and GPS available, report automatically sent to backend
4. **Visualization**: View GPS coordinates and pothole count in control panel
5. **Map**: Click "VIEW MAP" to see all reported potholes on an interactive map

## Deployment

### Frontend Deployment (Vercel/Netlify)

```bash
npm run build
# Deploy the dist/ folder
```

Ensure `/api` routes are configured to point to your backend URL.

### Backend Deployment (Railway/Render)

1. Push `backend/` directory to your deployment platform
2. Set environment variable: `NEON_DATABASE_URL`
3. Install dependencies: `pip install -r requirements.txt`
4. Run: `uvicorn main:app --host 0.0.0.0 --port 8001`

### Environment Variables

**Frontend:**
- No additional environment variables needed for basic functionality

**Backend:**
- `NEON_DATABASE_URL`: PostgreSQL connection string from Neon

## Architecture

```
┌─────────────────────────────────────────────┐
│           Frontend (React + TS)             │
│  - Image upload with EXIF parsing           │
│  - ONNX Runtime detection                   │
│  - Interactive map viewer                   │
└──────────────────┬──────────────────────────┘
                   │
                   │ /api/report (POST)
                   │ /api/map (GET)
                   │
┌──────────────────▼──────────────────────────┐
│        Backend (FastAPI + asyncpg)          │
│  - PostgreSQL connection pooling            │
│  - Pothole report storage                   │
│  - Folium map generation                    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      NeonDB (PostgreSQL Serverless)         │
│  - pothole_reports table                    │
│  - GPS coordinates & detection counts       │
└─────────────────────────────────────────────┘
```

## Troubleshooting

### API Proxy Not Working
- Ensure backend runs on `http://localhost:8001`
- Check `vite.config.ts` has correct proxy configuration
- Restart dev server after config changes

### GPS Data Not Extracted
- Ensure image has EXIF metadata with GPS tags
- Some phones/cameras don't save GPS in EXIF; use alternative location sources

### Database Connection Failed
- Verify `NEON_DATABASE_URL` is correctly set in `.env`
- Check NeonDB console for connection string format
- Ensure table `pothole_reports` exists

### No Potholes Detected
- Ensure image contains clear pothole regions
- Check image quality and resolution
- Model trained on specific pothole appearance patterns

## License

MIT

## Support

For issues or questions, please refer to the project repository.
