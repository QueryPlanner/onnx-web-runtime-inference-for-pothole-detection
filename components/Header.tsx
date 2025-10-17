import React from 'react';

export const Header: React.FC = () => {
    return (
        <header className="w-full border-b-4 border-mint-300 py-8 px-6 mb-8 field-border bg-black/40 backdrop-blur-sm">
            <div className="content-overlay max-w-6xl mx-auto">
                {/* Classification header */}
                <div className="flex justify-between items-center mb-6 text-xs uppercase tracking-widest">
                    <span className="status-active">[ CLASSIFIED ]</span>
                    <span className="text-center flex-1 status-warning">POTHOLE DETECTION SYSTEM</span>
                    <span className="status-active">[ ACTIVE ]</span>
                </div>

                {/* Main title */}
                <h1 className="title-main text-center mb-4">
                    POTHOLE
                    <br />
                    DETECTION
                </h1>

                {/* Subtitle with system info */}
                <div className="flex justify-between items-center gap-4 text-center mb-6">
                    <div className="flex-1 text-left">
                        <div className="subtitle">Real-Time Threat Assessment</div>
                        <div className="text-xs text-gray-400 mt-1">ONNX Web Runtime</div>
                    </div>
                    <div className="text-2xl status-active">●</div>
                    <div className="flex-1 text-right">
                        <div className="subtitle">AI-Powered Analysis</div>
                        <div className="text-xs text-gray-400 mt-1">In-Browser Inference</div>
                    </div>
                </div>

                {/* Field specs */}
                <div className="grid grid-cols-3 gap-4 text-xs mb-4">
                    <div className="data-readout text-center">
                        <div className="data-label mb-1">DETECTION MODE</div>
                        <div className="data-value">ACTIVE</div>
                    </div>
                    <div className="data-readout text-center">
                        <div className="data-label mb-1">STATUS</div>
                        <div className="data-value status-active">READY</div>
                    </div>
                    <div className="data-readout text-center">
                        <div className="data-label mb-1">COVERAGE</div>
                        <div className="data-value">100%</div>
                    </div>
                </div>

                {/* Footer line */}
                <div className="border-t border-mint-400/50 pt-4 flex justify-between items-center text-xs">
                    <span>FWD OPS / FIELD DEPLOYMENT</span>
                    <span>▮ INDIAN DEFENSE INFRASTRUCTURE ▮</span>
                    <span>KOLHAPUR - ACTIVE ZONE</span>
                </div>
            </div>
        </header>
    );
};
