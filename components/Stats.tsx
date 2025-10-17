import React, { useState, useEffect } from 'react';

interface StatsProps {
    fps: number;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 BYTES';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['BYTES', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const Stats: React.FC<StatsProps> = ({ fps }) => {
    const [gpuName, setGpuName] = useState<string>('UNKNOWN');
    const [memory, setMemory] = useState<{ used: number; total: number } | null>(null);

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

    useEffect(() => {
        const interval = setInterval(() => {
            if ('performance' in window && 'memory' in performance) {
                const memoryInfo = performance.memory as any;
                setMemory({
                    used: memoryInfo.usedJSHeapSize,
                    total: memoryInfo.totalJSHeapSize,
                });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const fpsStatus = fps >= 25 ? 'NOMINAL' : fps >= 15 ? 'DEGRADED' : 'CRITICAL';
    const fpsColor = fps >= 25 ? 'status-active' : fps >= 15 ? 'status-warning' : 'status-error';

    return (
        <div className="absolute top-4 left-4 field-border bg-black/80 backdrop-blur-sm p-0 z-30 max-w-sm">
            {/* Header */}
            <div className="px-4 py-3 border-b border-mint-400/50 flex justify-between items-center">
                <div className="text-xs uppercase tracking-widest status-active">[ TELEMETRY ]</div>
                <div className={`text-xs uppercase tracking-widest ${fpsColor}`}>{fpsStatus}</div>
            </div>

            {/* Data readout */}
            <div className="p-4 space-y-3 text-sm font-mono">
                {/* FPS */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="data-label">FPS:</div>
                    <div className={`data-value ${fpsColor}`}>{fps.toFixed(1)}</div>
                </div>

                {/* GPU */}
                <div className="grid grid-cols-2 gap-2 items-start">
                    <div className="data-label">GPU:</div>
                    <div className="data-value text-xs break-words">{gpuName.substring(0, 30)}</div>
                </div>

                {/* Memory */}
                {memory && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="data-label">MEMORY:</div>
                        <div className="data-value text-xs">
                            {formatBytes(memory.used)} / {formatBytes(memory.total)}
                        </div>
                    </div>
                )}

                {/* CPU Cores */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="data-label">CPU CORES:</div>
                    <div className="data-value">{navigator.hardwareConcurrency || 'N/A'}</div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-mint-400/50 flex justify-between items-center text-xs text-gray-500">
                <span>LIVE MONITORING</span>
                <span className="status-active animate-pulse">●</span>
            </div>

            {/* Scanlines */}
            <div className="absolute inset-0 pointer-events-none scanlines rounded"></div>
        </div>
    );
};
