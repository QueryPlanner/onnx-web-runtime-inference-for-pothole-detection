import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as ort from 'onnxruntime-web';
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

    useEffect(() => {
        const initializeModel = async () => {
            try {
                setError(null);
                setIsLoading(true);
                const detectorInstance = new PotholeDetector();
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

    const drawResults = useCallback((boxes: BoundingBox[]) => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image || !image.src) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { naturalWidth, naturalHeight } = image;
        const scale = Math.min(canvas.clientWidth / naturalWidth, canvas.clientHeight / naturalHeight);
        
        const canvasWidth = naturalWidth * scale;
        const canvasHeight = naturalHeight * scale;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#ef4444';

        boxes.forEach(({ x1, y1, x2, y2, confidence, label }) => {
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
        if (imageSrc && detections) {
            drawResults(detections);
        }
    }, [imageSrc, detections, drawResults]);


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            resetState();
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
            drawResults([]); // Clear previous boxes

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
            setIsWebcamOn(false);
            if (!imageSrc) resetState(); // Reset only if no image was previously set
        } else {
            try {
                resetState();
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setIsWebcamOn(true);
            } catch (err) {
                console.error("Webcam access denied:", err);
                setError("Webcam access was denied. Please allow camera permissions in your browser settings.");
            }
        }
    };

    const captureFrame = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImageSrc(dataUrl);
        
        // Turn off webcam after capture
        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        setIsWebcamOn(false);
    };

    const resetState = () => {
        setImageSrc(null);
        setDetections([]);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

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
                            {isWebcamOn ? 'Turn Off Webcam' : 'Use Webcam'}
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
                            onClick={resetState}
                            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                        >
                            Reset
                        </button>
                    )}
                    
                </div>
                
                <div className="lg:w-2/3 w-full bg-gray-800 p-4 rounded-2xl shadow-lg flex-grow flex items-center justify-center min-h-[300px] lg:min-h-0">
                    {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</div>}
                    
                    {!error && isLoading && !imageSrc && !isWebcamOn && (
                         <div className="text-center space-y-4">
                            <Loader />
                            <p className="text-lg text-gray-300">Loading AI model, please wait...</p>
                        </div>
                    )}
                    
                    {!error && !isLoading && !imageSrc && !isWebcamOn && (
                        <div className="text-center text-gray-400">
                            <p className="text-xl">Upload an image or use your webcam to start.</p>
                        </div>
                    )}

                    <div className="relative w-full h-full flex items-center justify-center">
                        <img ref={imageRef} src={imageSrc || ''} onLoad={() => drawResults(detections)} className="hidden" alt="Source for detection" />
                        
                        {isWebcamOn && (
                            <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4">
                                <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg shadow-2xl" />
                                <button
                                    onClick={captureFrame}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full transition-transform transform hover:scale-110"
                                >
                                    Capture
                                </button>
                            </div>
                        )}

                        {(imageSrc && !isWebcamOn) && (
                             <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded-lg" />
                        )}
                    </div>
                     {isLoading && (imageSrc || isWebcamOn) && <Loader />}
                </div>
            </main>
        </div>
    );
};

export default App;
