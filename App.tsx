import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PotholeDetector } from './services/potholeDetector';
import type { BoundingBox } from './types';
import { Header } from './components/Header';
import { Loader } from './components/Loader';
import exifr from 'exifr';

const App: React.FC = () => {
    const [detector, setDetector] = useState<PotholeDetector | null>(null);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [detections, setDetections] = useState<BoundingBox[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [potholeCount, setPotholeCount] = useState(0);
    const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultContainerRef = useRef<HTMLDivElement>(null);

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

    const drawDetections = useCallback((source: HTMLImageElement | HTMLVideoElement, boxes: BoundingBox[]) => {
        const canvas = canvasRef.current;
        const container = resultContainerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth;
        const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight;
        
        if (sourceWidth === 0 || sourceHeight === 0) return;

        const { clientWidth: containerWidth, clientHeight: containerHeight } = container;

        const scale = Math.min(containerWidth / sourceWidth, containerHeight / sourceHeight);
        const canvasWidth = sourceWidth * scale;
        const canvasHeight = sourceHeight * scale;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        ctx.drawImage(source, 0, 0, canvasWidth, canvasHeight);

        // Tactical mint green color scheme
        const strokeColor = '#c2f0c2';
        const accentColor = '#ff6b35';
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3;
        ctx.font = 'bold 16px "Courier Prime", monospace';

        boxes.forEach(({ x1, y1, x2, y2, confidence, label }) => {
            const rectX = x1 * scale;
            const rectY = y1 * scale;
            const rectWidth = (x2 - x1) * scale;
            const rectHeight = (y2 - y1) * scale;

            // Draw border
            ctx.strokeStyle = accentColor;
            ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

            // Draw corner markers
            const cornerSize = 8;
            const corners = [
                [rectX, rectY, rectX + cornerSize, rectY, rectX, rectY + cornerSize],
                [rectX + rectWidth - cornerSize, rectY, rectX + rectWidth, rectY, rectX + rectWidth, rectY + cornerSize],
                [rectX, rectY + rectHeight - cornerSize, rectX, rectY + rectHeight, rectX + cornerSize, rectY + rectHeight],
                [rectX + rectWidth - cornerSize, rectY + rectHeight, rectX + rectWidth, rectY + rectHeight, rectX + rectWidth, rectY + rectHeight - cornerSize],
            ];
            
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2;
            corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.moveTo(x1, y1);
                ctx.lineTo(x3, y3);
                ctx.stroke();
            });

            // Draw label background
            const text = `${label} ${(confidence * 100).toFixed(0)}%`;
            const textMetrics = ctx.measureText(text);
            const textWidth = textMetrics.width;
            const textHeight = 20;
            const padding = 8;

            ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
            ctx.fillRect(rectX - 2, rectY - textHeight - padding, textWidth + padding * 2, textHeight + padding);
            
            // Draw border around label
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(rectX - 2, rectY - textHeight - padding, textWidth + padding * 2, textHeight + padding);

            // Draw text
            ctx.fillStyle = strokeColor;
            ctx.fillText(text, rectX + padding / 2, rectY - padding / 2);
        });
    }, []);
    
    useEffect(() => {
        if (imageSrc && imageRef.current && detections) {
            if (imageRef.current.complete) {
                drawDetections(imageRef.current, detections);
            }
        }
    }, [imageSrc, detections, drawDetections]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !detector) return;

        resetState();
        let gpsData: { lat: number; lng: number } | null = null;

        // Extract GPS from EXIF
        try {
            const parsed = await exifr.parse(file);
            if (parsed?.latitude != null && parsed?.longitude != null) {
                gpsData = { lat: parsed.latitude, lng: parsed.longitude };
                setGps(gpsData);
            }
        } catch {
            // Silently handle parsing errors
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const src = e.target?.result as string;
            setImageSrc(src);

            // Create temporary image to run detection
            const img = new Image();
            img.src = src;
            img.onload = async () => {
                try {
                    setIsLoading(true);
                    const boxes = await detector.detect(img);
                    setDetections(boxes);
                    setPotholeCount(boxes.length);

                    // Auto-send to backend if potholes detected and GPS available
                    if (boxes.length > 0 && gpsData) {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('latitude', gpsData.lat.toString());
                        formData.append('longitude', gpsData.lng.toString());
                        formData.append('pothole_count', boxes.length.toString());

                        try {
                            const res = await fetch('/api/report', {
                                method: 'POST',
                                body: formData,
                            });
                            if (!res.ok) {
                                console.error('Failed to report pothole:', res.statusText);
                            }
                        } catch (fetchErr) {
                            console.error('Error sending pothole report:', fetchErr);
                        }
                    }
                } catch (err) {
                    console.error(err);
                    setError('Detection failed.');
                } finally {
                    setIsLoading(false);
                }
            };
        };
        reader.readAsDataURL(file);
    };

    const resetState = () => {
        setImageSrc(null);
        setDetections([]);
        setError(null);
        setPotholeCount(0);
        setGps(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col content-overlay bg-transparent">
            <Header isLoading={isLoading} />
            <main className="flex-grow flex flex-col lg:flex-row gap-2 sm:gap-4 md:gap-6 px-2 sm:px-4 md:px-6 lg:px-8 pb-2 sm:pb-4 md:pb-6 w-full" style={{ maxWidth: '90rem', margin: '0 auto' }}>
                {/* Control Panel */}
                <div className="field-border lg:w-80 w-full bg-black/40 backdrop-blur-sm p-3 sm:p-4 md:p-6 h-fit">
                    <h2 className="uppercase tracking-widest font-bold mb-3 sm:mb-4 md:mb-6 status-active flex items-center gap-2 text-xs sm:text-sm">
                        <span>[ CONTROL PANEL ]</span>
                    </h2>
                    <div className="space-y-2 sm:space-y-3 md:space-y-4">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="btn-tactical w-full py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 text-xs sm:text-sm"
                        >
                            ⬆ UPLOAD
                        </button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    </div>

                    {/* Map View Button */}
                    <button
                        onClick={() => {
                            window.open('/api/map', '_blank');
                        }}
                        className="btn-tactical w-full py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 mt-2 sm:mt-3 md:mt-4 text-xs sm:text-sm"
                    >
                        🗺 VIEW MAP
                    </button>

                    {/* Reset Button */}
                    {imageSrc && (
                        <button
                            onClick={resetState}
                            className="btn-tactical w-full py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 mt-2 sm:mt-3 md:mt-4 opacity-70 hover:opacity-100 text-xs sm:text-sm"
                        >
                            ✕ RESET
                        </button>
                    )}

                    <div className="mt-4 space-y-2 text-xs">
                        {potholeCount > 0 && (
                            <div className="data-readout p-2">
                                <span className="data-label">POTHOLES:</span>
                                <span className="data-value ml-2">{potholeCount}</span>
                            </div>
                        )}
                        {gps && (
                            <div className="data-readout p-2">
                                <div className="data-label">GPS:</div>
                                <div className="data-value">
                                    {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Detection Area */}
                <div ref={resultContainerRef} className="field-border flex-grow bg-black/40 backdrop-blur-sm p-2 sm:p-3 md:p-4 flex items-center justify-center min-h-[120px] sm:min-h-[200px] md:min-h-[300px] lg:min-h-[600px] relative scanlines">
                    {/* Error State */}
                    {error && (
                        <div className="field-border-accent bg-black/60 p-4 sm:p-6 rounded z-10 text-center max-w-md text-xs sm:text-sm">
                            <div className="text-lg sm:text-xl status-error font-bold mb-2 sm:mb-3 uppercase">⚠ ERROR</div>
                            <p className="text-xs sm:text-sm text-gray-300">{error}</p>
                        </div>
                    )}
                    
                    {/* Loading State */}
                    {!error && isLoading && !imageSrc && (
                        <div className="text-center space-y-3 sm:space-y-4 md:space-y-6 z-10">
                            <Loader />
                            <div>
                                <p className="uppercase text-xs tracking-widest status-active font-bold mb-1 sm:mb-2">SYSTEM STATUS</p>
                                <p className="text-xs sm:text-sm text-gray-400">Loading inference engine...</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Idle State */}
                    {!error && !isLoading && !imageSrc && (
                        <div className="text-center space-y-2 sm:space-y-3 md:space-y-4 z-10">
                            <div className="text-3xl sm:text-4xl status-active animate-pulse">◉</div>
                            <div>
                                <p className="uppercase text-xs tracking-widest status-warning font-bold mb-1 sm:mb-2">AWAITING INPUT</p>
                                <p className="text-xs sm:text-sm text-gray-400">Upload image to detect potholes</p>
                            </div>
                        </div>
                    )}

                    {/* Canvas Display */}
                    <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-3 md:p-4 pointer-events-none">
                        <img ref={imageRef} src={imageSrc || ''} onLoad={() => {if (imageRef.current) drawDetections(imageRef.current, detections)}} className="hidden" alt="Source for detection" />
                        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
                    </div>
                    
                    {/* Loading Spinner Overlay */}
                    {isLoading && imageSrc && <div className="absolute z-20"><Loader /></div>}
                </div>
            </main>
            <footer className="border-t border-mint-400/30 py-2 sm:py-3 md:py-4 px-3 sm:px-6 text-xs text-gray-500 text-center">
                INFRASTRUCTURE DEFENSE • THREAT DETECTION • REAL-TIME ANALYSIS
            </footer>
        </div>
    );
};

export default App;