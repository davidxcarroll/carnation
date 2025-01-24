import React, { useState } from 'react';
import './index.css';

import DateWidget from './widgets/dateWidget';
import CodeWidget from './widgets/codeWidget';
import ListWidget from './widgets/listWidget';
import SignalWidget from './widgets/signalWidget';
import TimerWidget from './widgets/timerWidget';

const LookSchoolApp = () => {
  return (
    <div className="w-screen h-screen min-h-screen grid grid-cols-[2fr_auto_3fr] grid-rows-5 font-pangram [font-size:clamp(2rem,3vw,6rem)] select-none">
      <TimerWidget />
      <SignalWidget />
      <CodeWidget />
      <DateWidget />
      <ListWidget />
    </div>
  );
};

export default LookSchoolApp;