import React, { useState } from 'react';

const SignalWidget = () => {
    const [activeSignal, setActiveSignal] = useState(null);

    return (
        <div className="col-span-2 row-span-2 flex flex-row items-center justify-evenly p-[10rem] gap-[10rem] bg-neutral-900">
            <div
                onClick={() => setActiveSignal(current => current === 0 ? null : 0)}
                className={`w-full aspect-square rounded-full cursor-pointer ${activeSignal === 0 ? 'bg-red-500 shadow-[0_0_50px_0_rgba(239,68,68,1)]' : 'hover:bg-red-500/10 shadow-[inset_0_0_0_1rem_rgba(239,68,68,1)]'}`}
            />
            <div
                onClick={() => setActiveSignal(current => current === 1 ? null : 1)}
                className={`w-full aspect-square rounded-full cursor-pointer ${activeSignal === 1 ? 'bg-yellow-500 shadow-[0_0_50px_0_rgba(233,179,6,1)]' : 'hover:bg-yellow-500/10 shadow-[inset_0_0_0_1rem_rgba(233,179,6,1)]'}`}
            />
            <div
                onClick={() => setActiveSignal(current => current === 2 ? null : 2)}
                className={`w-full aspect-square rounded-full cursor-pointer ${activeSignal === 2 ? 'bg-green-500 shadow-[0_0_50px_0_rgba(34,197,93,1)]' : 'hover:bg-green-500/10 shadow-[inset_0_0_0_1rem_rgba(34,197,93,1)]'}`}
            />
        </div>
    );
};

export default SignalWidget;