import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PotholeDetector } from './services/potholeDetector';
import type { BoundingBox } from './types';
import { Header } from './components/Header';
import { Loader } from './components/Loader';
import { Stats } from './components/Stats';

const App: React.FC = () => {
    const [detector, setDetector] = useState<PotholeDetector | null>(null);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [detections, setDetections] = useState<BoundingBox[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWebcamOn, setIsWebcamOn] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fps, setFps] = useState(0);

    const imageRef = useRef<HTMLImageElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultContainerRef = useRef<HTMLDivElement>(null);
    // FIX: Initialize useRef with null and a correct type to fix the error. `useRef<number>()` is invalid without an initial value.
    const animationFrameId = useRef<number | null>(null);
    const lastDetectionTime = useRef<number>(0);
    const detectionInterval = 33; // ms, i.e., ~30 FPS for detection
    const frameCount = useRef(0);
    const lastFpsUpdateTime = useRef(performance.now());

    useEffect(() => {
        const initializeModel = async () => {
            try {
                setError(null);
                setIsLoading(true);
                // FIX: Pass the wasm path to the PotholeDetector constructor to fix "Expected 1 arguments, but got 0." error.
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


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            resetState();
            setIsWebcamOn(false);
            const reader = new FileReader();
            reader.onload = (e) => {
                setImageSrc(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const runDetection = async () => {
        if (!detector || !imageRef.current) return;
        
        try {
            setError(null);
            setIsLoading(true);
            setDetections([]);
            drawDetections(imageRef.current, []);

            const boxes = await detector.detect(imageRef.current);
            setDetections(boxes);
        } catch (err) {
            console.error(err);
            setError('Failed to run detection. The image might be corrupted or in an unsupported format.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleWebcam = async () => {
        if (isWebcamOn) {
            const stream = videoRef.current?.srcObject as MediaStream;
            stream?.getTracks().forEach(track => track.stop());
            if (videoRef.current) videoRef.current.srcObject = null;
            setIsWebcamOn(false);
            resetState();
        } else {
            resetState();
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            };

            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                const video = videoRef.current;
                if (video) {
                    video.srcObject = stream;
                    video.onloadedmetadata = () => {
                        video.play().then(() => {
                            setIsWebcamOn(true);
                            setIsFullscreen(true);
                        }).catch(playErr => {
                            console.error("Video play failed:", playErr);
                            setError("Could not start the webcam video. Autoplay might be blocked by your browser.");
                            stream.getTracks().forEach(track => track.stop());
                        });
                    };
                }
            } catch (err) {
                console.error("getUserMedia error:", err);
                let message = "Could not access the webcam. Please ensure you have a camera connected and have granted permissions.";
                if (err instanceof DOMException) {
                     switch (err.name) {
                        case 'NotAllowedError':
                            message = "Webcam access was denied. Please allow camera permissions in your browser settings.";
                            break;
                        case 'NotFoundError':
                            message = "No webcam was found. Please ensure a camera is connected and enabled.";
                            break;
                        case 'NotReadableError':
                            message = "The webcam is currently in use by another application or a hardware error occurred.";
                            break;
                        case 'OverconstrainedError':
                            message = "Your webcam does not support the required resolution or facing mode.";
                            break;
                        case 'SecurityError':
                            message = "Webcam access is only available on secure (HTTPS) pages.";
                            break;
                        default:
                            break;
                     }
                }
                setError(message);
            }
        }
    };
    
    const runLiveDetection = useCallback(async () => {
        if (!isWebcamOn || !detector || !videoRef.current) return;

        const now = performance.now();

        // FPS calculation
        frameCount.current++;
        const delta = now - lastFpsUpdateTime.current;
        if (delta >= 1000) { // Update FPS every second
            const currentFps = frameCount.current * 1000 / delta;
            setFps(currentFps);
            frameCount.current = 0;
            lastFpsUpdateTime.current = now;
        }
        
        const video = videoRef.current;
        const timeSinceLastDetection = now - lastDetectionTime.current;

        if (video.readyState >= 2 && timeSinceLastDetection > detectionInterval) {
            lastDetectionTime.current = now;
            const boxes = await detector.detect(video);
            drawDetections(video, boxes);
        } else {
            // To keep the video feed smooth, we still need to draw the video frame
            // without new detections if the interval hasn't passed.
            drawDetections(video, detections);
        }

        animationFrameId.current = requestAnimationFrame(runLiveDetection);
    }, [isWebcamOn, detector, drawDetections, detections, detectionInterval]);

    useEffect(() => {
        if (isWebcamOn && detector) {
            runLiveDetection();
        }
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [isWebcamOn, detector, runLiveDetection]);


    const resetState = () => {
        setImageSrc(null);
        setDetections([]);
        setError(null);
        setIsFullscreen(false);

        // Stop webcam if it's on
        if (isWebcamOn && videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsWebcamOn(false);
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleReset = () => {
        setIsWebcamOn(false);
        resetState();
    }


    return (
        <div className={`min-h-screen w-full flex flex-col content-overlay ${isFullscreen ? 'bg-black' : 'bg-transparent'}`}>
            {!isFullscreen && <Header />}
            
            <main className={`flex-grow flex flex-col lg:flex-row gap-6 px-4 sm:px-6 lg:px-8 pb-6 w-full ${isFullscreen ? 'absolute inset-0 z-40' : ''}`} style={{ maxWidth: isFullscreen ? 'none' : '90rem', margin: isFullscreen ? '0' : '0 auto' }}>
                {/* Control Panel */}
                <div className={`field-border lg:w-96 w-full bg-black/40 backdrop-blur-sm p-6 h-fit ${isFullscreen ? 'absolute bottom-6 left-6 z-50 bg-black/80 w-auto' : ''}`}>
                    <h2 className={`uppercase tracking-widest font-bold mb-6 status-active flex items-center gap-2 ${isFullscreen ? 'hidden' : ''}`}>
                        <span>[ CONTROL PANEL ]</span>
                    </h2>
                    
                    <div className={`space-y-4 ${isFullscreen ? 'flex flex-row gap-3' : ''}`}>
                        {/* Upload Button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="btn-tactical w-full py-3 px-4"
                        >
                            ⬆ UPLOAD IMAGE
                        </button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        
                        {/* Webcam Button */}
                        <button
                            onClick={toggleWebcam}
                            disabled={isLoading}
                            className="btn-tactical btn-accent w-full py-3 px-4"
                        >
                            {isWebcamOn ? '⊘ STOP LIVE' : '● START LIVE'}
                        </button>
                    </div>

                    {/* Detection Button */}
                    {imageSrc && !isWebcamOn && (
                         <button
                            onClick={runDetection}
                            disabled={isLoading || !detector}
                            className="btn-tactical btn-accent w-full py-3 px-4 mt-4 text-lg"
                        >
                            ▶ SCAN NOW
                        </button>
                    )}

                    {/* Reset Button */}
                    {(imageSrc || isWebcamOn) && (
                        <button
                            onClick={handleReset}
                            className={`btn-tactical w-full py-2 px-4 mt-4 opacity-70 hover:opacity-100 ${isFullscreen ? 'py-3' : ''}`}
                        >
                            ✕ RESET
                        </button>
                    )}
                </div>
                
                {/* Main Detection Area */}
                <div ref={resultContainerRef} className={`field-border flex-grow bg-black/40 backdrop-blur-sm p-4 flex items-center justify-center min-h-[300px] lg:min-h-[600px] relative scanlines ${isFullscreen ? 'lg:w-full w-full h-screen min-h-screen rounded-none p-0 border-0 field-border' : ''}`}>
                    {isWebcamOn && <Stats fps={fps} />}
                    
                    {/* Error State */}
                    {error && (
                        <div className="field-border-accent bg-black/60 p-6 rounded z-10 text-center max-w-md">
                            <div className="text-xl status-error font-bold mb-3 uppercase">⚠ ERROR</div>
                            <p className="text-sm text-gray-300">{error}</p>
                        </div>
                    )}
                    
                    {/* Loading State */}
                    {!error && isLoading && !imageSrc && !isWebcamOn && (
                         <div className="text-center space-y-6 z-10">
                            <Loader />
                            <div>
                                <p className="uppercase text-xs tracking-widest status-active font-bold mb-2">SYSTEM STATUS</p>
                                <p className="text-sm text-gray-400">Loading inference engine...</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Idle State */}
                    {!error && !isLoading && !imageSrc && !isWebcamOn && (
                        <div className="text-center space-y-4 z-10">
                            <div className="text-4xl status-active animate-pulse">◉</div>
                            <div>
                                <p className="uppercase text-xs tracking-widest status-warning font-bold mb-2">AWAITING INPUT</p>
                                <p className="text-sm text-gray-400">Upload image or activate live detection</p>
                            </div>
                        </div>
                    )}

                    {/* Canvas/Video Display */}
                    <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                        <img ref={imageRef} src={imageSrc || ''} onLoad={() => {if (imageRef.current) drawDetections(imageRef.current, detections)}} className="hidden" alt="Source for detection" />
                        <video ref={videoRef} autoPlay playsInline muted className="hidden"></video>
                        <canvas ref={canvasRef} className={`max-w-full max-h-full object-contain ${isFullscreen ? 'w-full h-full' : ''}`} />
                    </div>
                    
                    {/* Loading Spinner Overlay */}
                     {isLoading && (imageSrc || isWebcamOn) && <div className="absolute z-20"><Loader /></div>}
                </div>
            </main>

            {/* Footer */}
            {!isFullscreen && (
                <footer className="border-t border-mint-400/30 py-4 px-6 text-xs text-gray-500 text-center">
                    <span>INFRASTRUCTURE DEFENSE • THREAT DETECTION • REAL-TIME ANALYSIS</span>
                </footer>
            )}
        </div>
    );
};

export default App;