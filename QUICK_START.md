# Quick Start Guide

## ⚡ 5-Minute Setup

### Prerequisites
- Node.js v18+ (`node --version`)
- Python 3.8+ (`python --version`)
- NeonDB connection string

### Step 1: Frontend (Terminal 1)

```bash
# Install and run
npm install
npm run dev
```

✅ Frontend ready: http://localhost:3000

### Step 2: Backend (Terminal 2)

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file (your NeonDB URL)
echo "NEON_DATABASE_URL=<your-connection-string>" > .env

# Run backend
uvicorn main:app --reload --port 8001
```

✅ Backend ready: http://localhost:8001

### Step 3: Database (Neon Console)

Run once in your Neon console:

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

✅ Database ready!

## 🧪 Testing the System

1. **Upload Image**
   - Click "UPLOAD" button
   - Select image with GPS metadata (phone photos usually have GPS)
   - System auto-detects potholes

2. **View Results**
   - Check pothole count in left panel
   - Check GPS coordinates extracted
   - See detection boxes on image

3. **View Map**
   - Click "VIEW MAP" button
   - Should see report on interactive map

## 📋 Common Tasks

### Check Backend Logs
```bash
# Terminal 2 (where backend runs)
# Uvicorn outputs all requests to console
# Look for "POST /api/report" or "GET /api/map"
```

### Test API Directly
```bash
# Test GET /api/map
curl http://localhost:8001/api/map

# Test POST /api/report (requires image file)
curl -X POST http://localhost:8001/api/report \
  -F "file=@image.jpg" \
  -F "latitude=28.7041" \
  -F "longitude=77.1025" \
  -F "pothole_count=3"
```

### View Database
```bash
# In Neon console
SELECT * FROM pothole_reports;
SELECT COUNT(*) FROM pothole_reports;
```

### Reset Everything
```bash
# Delete all reports
DELETE FROM pothole_reports;

# Verify empty
SELECT COUNT(*) FROM pothole_reports;  -- Should return 0
```

## 🐛 Troubleshooting

### "Cannot POST /api/report"
✗ Backend not running or proxy not configured
✓ Ensure uvicorn running on port 8001
✓ Restart dev server after vite.config changes

### "NEON_DATABASE_URL not set"
✗ .env file missing or wrong path
✓ Create `backend/.env` with correct URL from Neon
✓ Check URL format: `postgres://...@host.neon.tech/...`

### GPS Not Extracted
✗ Image has no EXIF GPS data
✓ Use photos from phone camera (usually has GPS)
✓ Check EXIF with: https://exif.tools/

### No Potholes Detected
✗ Image quality too low or no clear potholes
✓ Try images with obvious pothole regions
✓ Check image resolution ≥ 480px

### Map Shows No Markers
✗ No reports sent yet or database not connected
✓ Check API logs: should see POST /api/report
✓ Verify table exists: `SELECT * FROM pothole_reports;`
✓ Manually insert test data if needed

## 📦 File Structure

```
project/
├── src/
│   ├── App.tsx              # Main component
│   ├── index.tsx            # Entry point
│   └── components/          # UI components
├── backend/
│   ├── main.py             # FastAPI app
│   ├── requirements.txt     # Python deps
│   ├── .env                # YOUR NEON URL HERE
│   └── README.md           # Backend docs
├── vite.config.ts          # Dev proxy config
└── README.md               # Full documentation
```

## 🚀 Next Steps

1. **Local Testing Complete?**
   - Proceed to deployment

2. **Deploy Frontend**
   - `npm run build`
   - Upload `dist/` to Vercel/Netlify

3. **Deploy Backend**
   - Push `backend/` to Railway/Render
   - Set `NEON_DATABASE_URL` environment variable
   - Run: `uvicorn main:app --host 0.0.0.0 --port 8001`

4. **Update Frontend API URL**
   - If backend at different domain
   - Update fetch() calls to use production URL

## 💡 Tips

- Keep two terminals open (frontend + backend)
- Use phone photos for GPS data
- Monitor API logs in backend terminal
- Use Neon console to inspect database
- Test with curl before debugging frontend

## 📞 Getting Help

- Check `IMPLEMENTATION_SUMMARY.md` for architecture
- Check `backend/README.md` for API docs
- Check `README.md` for full system docs
- Logs appear in terminal where service runs
