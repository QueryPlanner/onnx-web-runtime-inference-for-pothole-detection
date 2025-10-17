import React from 'react';

export const Loader: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center gap-6">
            {/* Tactical scanning animation */}
            <div className="relative w-24 h-24">
                {/* Outer ring */}
                <div className="absolute inset-0 border-2 border-mint-400/50 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
                
                {/* Middle ring */}
                <div className="absolute inset-3 border-2 border-mint-300/30 rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
                
                {/* Inner scanning circle */}
                <div className="absolute inset-6 border-2 border-orange-500/50 rounded-full animate-pulse"></div>

                {/* Center dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-mint-300 rounded-full shadow-lg shadow-mint-300/50"></div>

                {/* Scanning line */}
                <svg className="absolute inset-0 w-full h-full" style={{ animation: 'spin 2s linear infinite' }}>
                    <line x1="50%" y1="50%" x2="50%" y2="0" stroke="#c2f0c2" strokeWidth="2" opacity="0.6" />
                </svg>
            </div>

            {/* Status text */}
            <div className="text-center">
                <div className="text-sm uppercase tracking-widest data-value animate-pulse">
                    ▮ INITIALIZING ▮
                </div>
                <div className="text-xs text-gray-400 mt-2 animate-pulse">
                    MODEL LOAD IN PROGRESS
                </div>
            </div>

            {/* Loading bar */}
            <div className="w-48 h-1 border border-mint-400/50 relative overflow-hidden bg-black/40">
                <div 
                    className="h-full bg-gradient-to-r from-transparent via-mint-400 to-transparent"
                    style={{
                        animation: 'loading-bar 2s infinite',
                        backgroundSize: '200% 100%'
                    }}
                />
            </div>

            <style>{`
                @keyframes loading-bar {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(100%); }
                    100% { transform: translateX(100%); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
