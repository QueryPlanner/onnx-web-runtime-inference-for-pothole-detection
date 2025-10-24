import React, { useState, useRef, useEffect } from 'react';
import { PotholeDetector } from './services/potholeDetector';
import exifr from 'exifr';

const App: React.FC = () => {
    const [detector, setDetector] = useState<PotholeDetector | null>(null);
    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [potholeCount, setPotholeCount] = useState(0);

    // Multi-image state
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [batchSummary, setBatchSummary] = useState<{
        totalImages: number;
        imagesWithGps: number;
        totalPotholes: number;
        inserted?: number;
    } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const initializeModel = async () => {
            try {
                setError(null);
                setIsLoading(true);
                const detectorInstance = new PotholeDetector('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/');
                await detectorInstance.initialize();
                setDetector(detectorInstance);
            } catch (err) {
                console.error(err);
                setError('Failed to load the AI model. Please refresh the page.');
            } finally {
                setIsLoading(false);
            }
        };
        initializeModel();
    }, []);

    

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0 || !detector) return;
        const files: File[] = Array.from(fileList);

        // Reset UI but keep model loaded
        resetState();
        setSelectedFiles(files);

        // No preview: detection runs in background; map stays visible

        // Process all images in sequence to avoid GPU/CPU contention
        setIsLoading(true);
        try {
            let totalPotholes = 0;
            let imagesWithGps = 0;
            const batchPayload: { reports: { latitude: number; longitude: number; pothole_count: number; image_name: string }[] } = { reports: [] };

            for (const file of files) {
                let gpsData: { lat: number; lng: number } | null = null;
                try {
                    const parsed = await exifr.parse(file);
                    if (parsed?.latitude != null && parsed?.longitude != null) {
                        gpsData = { lat: parsed.latitude, lng: parsed.longitude };
                    }
                } catch {}

                // Skip detection if GPS missing, but still count this for summary
                if (!gpsData) {
                    continue;
                }
                imagesWithGps += 1;

                const dataUrl = await new Promise<string>((resolve) => {
                    const r = new FileReader();
                    r.onload = (e) => resolve(e.target?.result as string);
                    r.readAsDataURL(file);
                });

                // Run detection
                const img = await new Promise<HTMLImageElement>((resolve) => {
                    const el = new Image();
                    el.src = dataUrl;
                    el.onload = () => resolve(el);
                });

                const boxes = await detector.detect(img);
                totalPotholes += boxes.length;

                if (boxes.length > 0) {
                    batchPayload.reports.push({
                        latitude: gpsData.lat,
                        longitude: gpsData.lng,
                        pothole_count: boxes.length,
                        image_name: file.name,
                    });
                }
            }

            setBatchSummary({ totalImages: files.length, imagesWithGps, totalPotholes });

            // Submit batch if there are any valid reports
            if (batchPayload.reports.length > 0) {
                try {
                    const res = await fetch('/api/report-batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(batchPayload),
                    });
                    if (res.ok) {
                        const body = await res.json();
                        setBatchSummary((prev) => prev ? { ...prev, inserted: body.inserted } : prev);
                    } else {
                        console.error('Batch submit failed:', res.statusText);
                    }
                } catch (e) {
                    console.error('Batch submit error:', e);
                }
            }

            // Update totals for legend panel
            setPotholeCount(totalPotholes);
        } catch (err) {
            console.error(err);
            setError('Multi-image processing failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const resetState = () => {
        setError(null);
        setPotholeCount(0);
        setSelectedFiles([]);
        setBatchSummary(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    return (
        <div className="min-h-screen w-full content-overlay">
            {/* Top-center title */}
            <div className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 overlay-panel interactive-surface px-4 sm:px-6 py-2.5 sm:py-3">
                <div className="overlay-title leading-tight text-center">
                    <div>Pothole</div>
                    <div>Dataset</div>
                </div>
            </div>

            {/* Bottom-left upload panel */}
            <div className="fixed bottom-44 sm:bottom-6 left-3 sm:left-6 overlay-panel interactive-surface p-3 sm:p-4 w-[85vw] sm:w-80 max-w-[92vw]">
                <div className="font-mono text-[11px] sm:text-xs mb-1 sm:mb-2">
                    {isLoading ? 'Loading model…' : 'Upload images (EXIF GPS required)'}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="btn-tactical py-2 px-3 text-xs"
                    >
                        ⬆ Upload
                    </button>
                    {(selectedFiles.length > 0 || potholeCount > 0) && (
                        <button
                            onClick={resetState}
                            className="btn-tactical py-2 px-3 text-xs opacity-80 hover:opacity-100"
                        >
                            ✕ Reset
                        </button>
                    )}
                    <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                </div>
                {batchSummary && (
                    <div className="mt-2 sm:mt-3 text-[11px] sm:text-xs font-mono space-y-1">
                        <div>Batch: <span className="font-bold">{batchSummary.totalImages}</span></div>
                        <div>With GPS: <span className="font-bold">{batchSummary.imagesWithGps}</span></div>
                        <div>Image potholes: <span className="font-bold">{batchSummary.totalPotholes}</span></div>
                        {batchSummary.inserted != null && (
                            <div>Inserted: <span className="font-bold">{batchSummary.inserted}</span></div>
                        )}
                        {error && <div className="text-red-600">{error}</div>}
                    </div>
                )}
            </div>

            {/* Bottom-right legend */}
            <div className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 overlay-panel interactive-surface p-3 sm:p-4 w-[88vw] sm:w-72 max-w-[92vw]">
                <div className="font-bold mb-1 sm:mb-2">Index</div>
                <div className="text-sm mb-1 sm:mb-2">🕳️ Pothole marker</div>
                <div className="text-sm leading-6">Total potholes detected (overall): <span className="font-bold">{potholeCount}</span></div>
            </div>
        </div>
    );
};

export default App;