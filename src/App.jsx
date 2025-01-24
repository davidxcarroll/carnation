import React, { useState } from 'react';
import './index.css';

import DateWidget from './widgets/dateWidget';
import CodeWidget from './widgets/codeWidget';
import ListWidget from './widgets/listWidget';
import SignalWidget from './widgets/signalWidget';
import TimerWidget from './widgets/timerWidget';

const LookSchoolApp = () => {
  return (
    <div className="w-screen h-[100dvh] min-h-[-webkit-fill-available] grid grid-cols-[2fr_auto_3fr] grid-rows-5 font-pangram text-4xl select-none">
      <TimerWidget />
      <SignalWidget />
      <CodeWidget />
      <DateWidget />
      <ListWidget />
    </div>
  );
};

export default LookSchoolApp;