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

    const imageRef = useRef<HTMLImageElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultContainerRef = useRef<HTMLDivElement>(null);
    const animationFrameId = useRef<number>();

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
            try {
                resetState();
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setIsWebcamOn(true);
            } catch (err) {
                console.error("Webcam access denied:", err);
                setError("Webcam access was denied. Please allow camera permissions in your browser settings.");
            }
        }
    };
    
    const runLiveDetection = useCallback(async () => {
        if (!isWebcamOn || !detector || !videoRef.current) return;
        const video = videoRef.current;

        if (video.readyState >= 2) {
            const boxes = await detector.detect(video);
            drawDetections(video, boxes);
        }

        animationFrameId.current = requestAnimationFrame(runLiveDetection);
    }, [isWebcamOn, detector, drawDetections]);

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
        <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-gray-900">
            <Header />
            <main className="container mx-auto flex-grow flex flex-col lg:flex-row gap-8 w-full max-w-7xl">
                <div className="lg:w-1/3 w-full bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col gap-6 h-fit">
                    <h2 className="text-2xl font-bold text-teal-400">Controls</h2>
                    
                    <div className="space-y-4">
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
                            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                        >
                            Reset
                        </button>
                    )}
                    
                </div>
                
                <div ref={resultContainerRef} className="lg:w-2/3 w-full bg-gray-800 p-4 rounded-2xl shadow-lg flex-grow flex items-center justify-center min-h-[300px] lg:min-h-[500px] relative">
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
                        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded-lg" />
                    </div>
                     {isLoading && (imageSrc || isWebcamOn) && <div className="absolute"><Loader /></div>}
                </div>
            </main>
        </div>
    );
};

export default App;