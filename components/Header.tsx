import React from 'react';

export const Header: React.FC = () => {
    return (
        <header className="text-center mb-8 w-full">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-indigo-500">
                Pothole Detection AI
            </h1>
            <p className="mt-2 text-lg text-gray-300">
                Detects potholes in real-time using a YOLO model in your browser.
            </p>
        </header>
    );
};
