import React, { useState, useEffect } from 'react';

const SignalWidget = () => {
    const [activeSignal, setActiveSignal] = useState(null);
    const [audio, setAudio] = useState({
        on: null,
        off: null
    });

    useEffect(() => {
        setAudio({
            on: () => new Audio('/sounds/mixkit-short-bass-hit-2299.wav').play().catch(console.error),
            off: () => new Audio('/sounds/mixkit-futuristic-bass-hit-2303-trim.mp3').play().catch(console.error)
        });
    }, []);

    const handleSignalClick = (signalIndex) => {
        setActiveSignal(current => {
            if (current === signalIndex) {
                audio.off?.();
                return null;
            } else {
                audio.on?.();
                return signalIndex;
            }
        });
    };

    return (
        <div className="col-span-2 row-span-2 flex flex-row items-center justify-evenly p-[10%] gap-[10%] bg-neutral-900">
            <div
                onClick={() => handleSignalClick(0)}
                className={`w-full aspect-square rounded-full cursor-pointer ${activeSignal === 0 ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_50px_0_rgba(239,68,68,1)]' : 'hover:bg-red-600/10 shadow-[inset_0_0_0_1rem_rgba(239,68,68,1)]'}`}
            />
            <div
                onClick={() => handleSignalClick(1)}
                className={`w-full aspect-square rounded-full cursor-pointer ${activeSignal === 1 ? 'bg-yellow-500 hover:bg-yellow-400 shadow-[0_0_50px_0_rgba(233,179,6,1)]' : 'hover:bg-yellow-500/10 shadow-[inset_0_0_0_1rem_rgba(233,179,6,1)]'}`}
            />
            <div
                onClick={() => handleSignalClick(2)}
                className={`w-full aspect-square rounded-full cursor-pointer ${activeSignal === 2 ? 'bg-green-500 hover:bg-green-400 shadow-[0_0_50px_0_rgba(34,197,93,1)]' : 'hover:bg-green-500/10 shadow-[inset_0_0_0_1rem_rgba(34,197,93,1)]'}`}
            />
        </div>
    );
};

export default SignalWidget;