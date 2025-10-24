from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import folium  # type: ignore
import asyncpg  # type: ignore
import os
from dotenv import load_dotenv
import logging
from pydantic import BaseModel
from typing import List

load_dotenv()

app = FastAPI()
logging.basicConfig(level=logging.INFO)

# Add CORS middleware with explicit origins (configurable via env)
default_origins = "http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.7:3000"
allowed_origins = os.getenv("ALLOWED_ORIGINS", default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NeonDB connection
DATABASE_URL = os.getenv("NEON_DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("NEON_DATABASE_URL not set in environment variables")


@app.on_event("startup")
async def init_db():
    """Initialize database connection pool on startup."""
    try:
        app.state.pool = await asyncpg.create_pool(DATABASE_URL)
        logging.info("Database pool initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize database pool: {e}")
        raise


@app.on_event("shutdown")
async def close_db():
    """Close database connection pool on shutdown."""
    if hasattr(app.state, "pool"):
        await app.state.pool.close()
        logging.info("Database pool closed")


@app.post("/api/report")
async def report_pothole(
    file: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    pothole_count: int = Form(...),
):
    """
    Store pothole detection report with GPS coordinates and image metadata.
    
    Args:
        file: Image file from the client
        latitude: GPS latitude coordinate
        longitude: GPS longitude coordinate
        pothole_count: Number of potholes detected
        
    Returns:
        JSON response with status
    """
    if pothole_count <= 0:
        raise HTTPException(
            status_code=400, 
            detail="No potholes detected"
        )
    
    if not file.filename:
        raise HTTPException(
            status_code=400, 
            detail="File name is required"
        )
    
    try:
        async with app.state.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO pothole_reports (latitude, longitude, pothole_count, image_name)
                VALUES ($1, $2, $3, $4)
                """,
                latitude,
                longitude,
                pothole_count,
                file.filename,
            )
        logging.info(
            f"Stored pothole report: lat={latitude}, lng={longitude}, count={pothole_count}"
        )
        return {"status": "success", "message": "Pothole report saved successfully"}
    except Exception as e:
        logging.error(f"Database error while storing report: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to store report"
        )


@app.get("/api/map", response_class=HTMLResponse)
async def get_map():
    """
    Generate an interactive folium map with heatmap and markers for all pothole reports.
    
    Returns:
        HTML representation of the folium map
    """
    try:
        async with app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT latitude, longitude, pothole_count FROM pothole_reports ORDER BY created_at DESC"
            )
        
        # If no reports exist, show a default map
        if not rows:
            m = folium.Map(location=[20.5937, 78.9629], zoom_start=5)
            folium.Marker(
                [20.5937, 78.9629],
                popup="No pothole reports yet",
                icon=folium.Icon(color="gray"),
            ).add_to(m)
            logging.info("No pothole reports found, returning default map")
            return m.get_root().render()

        # Center map on first report
        initial_lat = rows[0]["latitude"]
        initial_lng = rows[0]["longitude"]
        m = folium.Map(location=[initial_lat, initial_lng], zoom_start=13)

        # Add emoji markers for each report
        for row in rows:
            icon = folium.DivIcon(
                html='<div style="font-size: 24pt; text-align: center;">🕳️</div>',
                icon_size=(30, 30),
                icon_anchor=(15, 15)
            )
            folium.Marker(
                location=[row["latitude"], row["longitude"]],
                popup=f"Potholes: {row['pothole_count']}",
                icon=icon
            ).add_to(m)

        logging.info(f"Generated map with {len(rows)} pothole reports")
        return m.get_root().render()
    except Exception as e:
        logging.error(f"Map generation error: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to generate map"
        )


# ----- Batch reporting -----

class PotholeReportItem(BaseModel):
    latitude: float
    longitude: float
    pothole_count: int
    image_name: str


class PotholeReportBatch(BaseModel):
    reports: List[PotholeReportItem]


@app.post("/api/report-batch")
async def report_pothole_batch(payload: PotholeReportBatch):
    """
    Insert multiple pothole reports in a single transaction.

    Args:
        payload: JSON body with a list of reports

    Returns:
        JSON response summarizing inserted rows
    """
    # Filter invalid entries early to avoid partial inserts
    valid_reports = [
        r for r in payload.reports
        if r.pothole_count > 0
    ]

    if not valid_reports:
        raise HTTPException(
            status_code=400,
            detail="No valid reports to insert"
        )

    try:
        async with app.state.pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    """
                    INSERT INTO pothole_reports (latitude, longitude, pothole_count, image_name)
                    VALUES ($1, $2, $3, $4)
                    """,
                    [
                        (r.latitude, r.longitude, r.pothole_count, r.image_name)
                        for r in valid_reports
                    ],
                )
        logging.info(f"Stored batch of {len(valid_reports)} pothole reports")
        return {
            "status": "success",
            "inserted": len(valid_reports),
            "total": len(payload.reports),
        }
    except Exception as e:
        logging.error(f"Database error while storing batch: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to store batch reports",
        )
