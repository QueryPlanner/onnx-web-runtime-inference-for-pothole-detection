from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import folium
from folium.plugins import HeatMap
import asyncpg
import os
from dotenv import load_dotenv
import logging

load_dotenv()

app = FastAPI()
logging.basicConfig(level=logging.INFO)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

        # Prepare heatmap data: each pothole is a coordinate weighted by count
        heat_data = []
        for row in rows:
            for _ in range(row["pothole_count"]):
                heat_data.append([row["latitude"], row["longitude"]])

        # Center map on first report
        initial_lat = rows[0]["latitude"]
        initial_lng = rows[0]["longitude"]
        m = folium.Map(location=[initial_lat, initial_lng], zoom_start=13)

        # Add heatmap layer
        HeatMap(heat_data, radius=25, blur=15, max_zoom=1).add_to(m)

        # Add circle markers for each report
        for row in rows:
            folium.CircleMarker(
                location=[row["latitude"], row["longitude"]],
                radius=6,
                popup=f"Potholes: {row['pothole_count']}",
                color="orange",
                fill=True,
                fillColor="red",
                fillOpacity=0.7,
            ).add_to(m)

        logging.info(f"Generated map with {len(rows)} pothole reports")
        return m.get_root().render()
    except Exception as e:
        logging.error(f"Map generation error: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to generate map"
        )
