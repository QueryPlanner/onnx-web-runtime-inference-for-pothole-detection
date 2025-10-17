import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PotholeDetector } from './services/potholeDetector';
import type { BoundingBox } from './types';
import { Header } from './components/Header';
import { Loader } from './components/Loader';

const App: React.FC = () => {
    const [detector, setDetector] = useState<PotholeDetector | null>(null);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [detections, setDetections] = useState<BoundingBox[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWebcamOn, setIsWebcamOn] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const imageRef = useRef<HTMLImageElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultContainerRef = useRef<HTMLDivElement>(null);
    // FIX: Initialize useRef with null and a correct type to fix the error. `useRef<number>()` is invalid without an initial value.
    const animationFrameId = useRef<number | null>(null);
    const lastDetectionTime = useRef<number>(0);
    const detectionInterval = 33; // ms, i.e., ~30 FPS for detection

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

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.font = '16px sans-serif';

        boxes.forEach(({ x1, y1, x2, y2, confidence, label }) => {
            // FIX: Removed redundant scaling factor. The original code scaled the coordinates twice, resulting in incorrect rendering of detection boxes.
            const rectX = x1 * scale;
            const rectY = y1 * scale;
            const rectWidth = (x2 - x1) * scale;
            const rectHeight = (y2 - y1) * scale;

            ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

            const text = `${label} (${(confidence * 100).toFixed(1)}%)`;
            const textMetrics = ctx.measureText(text);
            const textWidth = textMetrics.width;
            const textHeight = 16; 

            ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'; // red-500 with opacity
            ctx.fillRect(rectX, rectY, textWidth + 8, textHeight + 4);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, rectX + 4, rectY + textHeight);
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
                    width: { ideal: 640 },
                    height: { ideal: 480 },
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
        
        const video = videoRef.current;
        const now = performance.now();
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
        <div className={`min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-gray-900 ${isFullscreen ? 'p-0 sm:p-0 lg:p-0' : ''}`}>
            {!isFullscreen && <Header />}
            <main className={`container mx-auto flex-grow flex flex-col lg:flex-row gap-8 w-full max-w-7xl ${isFullscreen ? 'max-w-full' : ''}`}>
                <div className={`lg:w-1/3 w-full bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col gap-6 h-fit ${isFullscreen ? 'absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-auto flex-row' : ''}`}>
                    <h2 className={`text-2xl font-bold text-teal-400 ${isFullscreen ? 'hidden' : ''}`}>Controls</h2>
                    
                    <div className={`space-y-4 ${isFullscreen ? 'flex flex-row gap-4' : ''}`}>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105"
                        >
                            Upload Image
                        </button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        
                        <button
                            onClick={toggleWebcam}
                            disabled={isLoading}
                            className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-900 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105"
                        >
                            {isWebcamOn ? 'Stop Webcam' : 'Start Live Detection'}
                        </button>
                    </div>

                    {imageSrc && !isWebcamOn && (
                         <button
                            onClick={runDetection}
                            disabled={isLoading || !detector}
                            className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 text-lg"
                        >
                            {isLoading ? 'Detecting...' : 'Detect Potholes'}
                        </button>
                    )}

                    {(imageSrc || isWebcamOn) && (
                        <button
                            onClick={handleReset}
                            className={`w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors ${isFullscreen ? 'py-3' : ''}`}
                        >
                            Reset
                        </button>
                    )}
                    
                </div>
                
                <div ref={resultContainerRef} className={`lg:w-2/3 w-full bg-gray-800 p-4 rounded-2xl shadow-lg flex-grow flex items-center justify-center min-h-[300px] lg:min-h-[500px] relative ${isFullscreen ? 'lg:w-full w-full h-screen min-h-screen rounded-none p-0' : ''}`}>
                    {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg z-10">{error}</div>}
                    
                    {!error && isLoading && !imageSrc && !isWebcamOn && (
                         <div className="text-center space-y-4 z-10">
                            <Loader />
                            <p className="text-lg text-gray-300">Loading AI model, please wait...</p>
                        </div>
                    )}
                    
                    {!error && !isLoading && !imageSrc && !isWebcamOn && (
                        <div className="text-center text-gray-400 z-10">
                            <p className="text-xl">Upload an image or start live detection.</p>
                        </div>
                    )}

                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center p-4">
                        <img ref={imageRef} src={imageSrc || ''} onLoad={() => {if (imageRef.current) drawDetections(imageRef.current, detections)}} className="hidden" alt="Source for detection" />
                        <video ref={videoRef} autoPlay playsInline muted className="hidden"></video>
                        <canvas ref={canvasRef} className={`max-w-full max-h-full object-contain rounded-lg ${isFullscreen ? 'w-full h-full rounded-none' : ''}`} />
                    </div>
                     {isLoading && (imageSrc || isWebcamOn) && <div className="absolute"><Loader /></div>}
                </div>
            </main>
        </div>
    );
};

export default App;