import React, { useState } from 'react';
import './index.css';
import { DEFAULT_URL } from './config';

import DateWidget from './widgets/dateWidget';
import CodeWidget from './widgets/codeWidget';
import ListWidget from './widgets/listWidget';
import TimerWidget from './widgets/timerWidget';

const LookSchoolApp = () => {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [activeSignal, setActiveSignal] = useState(null);

  return (
    <div className="w-screen h-[100dvh] min-h-[-webkit-fill-available] grid grid-cols-[2fr_auto_3fr] grid-rows-5 font-pangram text-4xl select-none">
      <TimerWidget />
      <div className="col-span-2 row-span-2 flex flex-row items-center justify-evenly p-8 gap-8 bg-neutral-900">
        <div
          onClick={() => setActiveSignal(current => current === 0 ? null : 0)}
          className={`w-60 aspect-square rounded-full cursor-pointer ${activeSignal === 0 ? 'bg-red-500 shadow-[0_0_50px_0_rgba(239,68,68,1)]' : 'shadow-[inset_0_0_0_10px_rgba(239,68,68,1)]'}`}
        />
        <div
          onClick={() => setActiveSignal(current => current === 1 ? null : 1)}
          className={`w-60 aspect-square rounded-full cursor-pointer ${activeSignal === 1 ? 'bg-yellow-500 shadow-[0_0_50px_0_rgba(233,179,6,1)]' : 'shadow-[inset_0_0_0_10px_rgba(233,179,6,1)]'}`}
        />
        <div
          onClick={() => setActiveSignal(current => current === 2 ? null : 2)}
          className={`w-60 aspect-square rounded-full cursor-pointer ${activeSignal === 2 ? 'bg-green-500 shadow-[0_0_50px_0_rgba(34,197,93,1)]' : 'shadow-[inset_0_0_0_10px_rgba(34,197,93,1)]'}`}
        />
      </div>
      <CodeWidget />
      <DateWidget />
      <ListWidget />
    </div>
  );
};

export default LookSchoolApp;