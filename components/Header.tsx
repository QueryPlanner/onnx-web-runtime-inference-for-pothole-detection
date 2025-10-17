import React from 'react';

interface HeaderProps {
    isLoading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isLoading = false }) => {
    return (
        <header className="w-full border-b-4 border-mint-300 py-3 sm:py-6 md:py-8 px-3 sm:px-6 mb-3 sm:mb-6 md:mb-8 field-border bg-black/40 backdrop-blur-sm">
            <div className="content-overlay max-w-6xl mx-auto">
                {/* Classification header - hidden on mobile */}
                <div className="hidden sm:flex justify-between items-center mb-4 text-xs uppercase tracking-widest">
                    <span className="status-active">[ CLASSIFIED ]</span>
                    <span className="text-center flex-1 status-warning">POTHOLE DETECTION SYSTEM</span>
                    <span className="status-active">[ ACTIVE ]</span>
                </div>

                {/* Main title - one line */}
                <h1 className="title-main text-center mb-2 sm:mb-4 text-2xl sm:text-4xl md:text-5xl">
                    POTHOLE DETECTION
                </h1>

                {/* Subtitle with system info - centered for better alignment */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 text-center mb-2 sm:mb-6">
                    <div className="flex-1 text-center sm:text-left flex items-center gap-1 sm:gap-2 justify-center sm:justify-start">
                        {/* <div className="text-lg sm:text-2xl status-active">●</div> */}
                        <div>
                            <div className="subtitle text-xs sm:text-sm md:text-base">Real-Time Threat Assessment</div>
                            <div className="text-xs text-gray-400 mt-0.5 sm:mt-1">ONNX Web Runtime</div>
                        </div>
                    </div>
                    <div className="flex-1 text-center sm:text-right">
                        <div className="subtitle text-xs sm:text-sm md:text-base">AI-Powered Analysis</div>
                        <div className="text-xs text-gray-400 mt-0.5 sm:mt-1">In-Browser Inference</div>
                    </div>
                </div>

                {/* Field specs - responsive grid with status dot */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs mb-2 sm:mb-4">
                    <div className="data-readout text-center text-xs sm:text-sm p-2 sm:p-3">
                        <div className="data-label mb-1 text-xs">DETECTION</div>
                        <div className="data-value text-sm">ACTIVE</div>
                    </div>
                    <div className="data-readout text-center text-xs sm:text-sm p-2 sm:p-3">
                        <div className="data-label mb-1 text-xs">STATUS</div>
                        <div className={`data-value text-sm flex items-center justify-center gap-1 sm:gap-2 ${isLoading ? 'status-warning' : 'status-active'}`}>
                            {isLoading ? 'LOADING' : 'READY'}
                            <span className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full animate-pulse ${isLoading ? 'bg-yellow-400' : 'bg-mint-300'}`}></span>
                        </div>
                    </div>
                    <div className="data-readout text-center text-xs sm:text-sm p-2 sm:p-3">
                        <div className="data-label mb-1 text-xs">COVERAGE</div>
                        <div className="data-value text-sm">100%</div>
                    </div>
                </div>

                {/* Footer line - now visible on mobile with compact layout */}
                <div className="flex flex-col sm:flex-row border-t border-mint-400/50 pt-2 sm:pt-3 justify-between items-center text-xs gap-1 sm:gap-0">
                    <span className="text-xs">FWD OPS / FIELD DEPLOYMENT</span>
                    <span className="text-xs">▮ INDIAN DEFENSE INFRASTRUCTURE ▮</span>
                    <span className="text-xs">KOLHAPUR - ACTIVE ZONE</span>
                </div>
            </div>
        </header>
    );
};
