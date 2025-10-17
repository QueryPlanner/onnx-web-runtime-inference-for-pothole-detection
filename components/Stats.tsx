import React, { useState, useEffect } from 'react';

// Define the props for the Stats component, including the FPS value.
interface StatsProps {
    fps: number;
}

// A utility function to format bytes into a more readable string (KB, MB, GB).
const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// The Stats component is responsible for displaying performance metrics.
export const Stats: React.FC<StatsProps> = ({ fps }) => {
    // State to hold the GPU name.
    const [gpuName, setGpuName] = useState<string>('N/A');
    // State to hold memory usage statistics.
    const [memory, setMemory] = useState<{ used: number; total: number } | null>(null);

    // Effect to retrieve the GPU name using the WebGL renderer info.
    useEffect(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                setGpuName(renderer);
            }
        }
    }, []);

    // Effect to periodically update memory usage statistics.
    useEffect(() => {
        const interval = setInterval(() => {
            if ('performance' in window && 'memory' in performance) {
                const memoryInfo = performance.memory as any;
                setMemory({
                    used: memoryInfo.usedJSHeapSize,
                    total: memoryInfo.totalJSHeapSize,
                });
            }
        }, 1000); // Update every second

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-70 text-white p-4 rounded-lg text-sm font-mono z-30">
            <h3 className="text-lg font-bold text-teal-400 mb-2">Performance Stats</h3>
            <div className="space-y-1">
                <p><strong>FPS:</strong> {fps.toFixed(1)}</p>
                <p><strong>GPU:</strong> {gpuName}</p>
                {memory && (
                    <p>
                        <strong>Memory:</strong> {formatBytes(memory.used)} / {formatBytes(memory.total)}
                    </p>
                )}
                <p><strong>CPU Cores:</strong> {navigator.hardwareConcurrency || 'N/A'}</p>
            </div>
        </div>
    );
};
