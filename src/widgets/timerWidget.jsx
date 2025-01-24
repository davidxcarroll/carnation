import React, { useState, useEffect, useRef } from 'react';

const TimerWidget = () => {
  const [minutes, setMinutes] = useState([0, 0]);
  const [seconds, setSeconds] = useState([0, 0]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCountingUp, setIsCountingUp] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);
  const [endTime, setEndTime] = useState(null);

  const isInitialState = minutes[0] === 0 && minutes[1] === 0 && seconds[0] === 0 && seconds[1] === 0;

  const incrementTimer = () => {
    setSeconds(prevSeconds => {
      const [secondsTens, secondsOnes] = prevSeconds;
      if (secondsOnes === 9) {
        if (secondsTens === 5) {
          setMinutes(prevMinutes => {
            const [minutesTens, minutesOnes] = prevMinutes;
            if (minutesOnes === 9) {
              return [minutesTens + 1, 0];
            }
            return [minutesTens, minutesOnes + 1];
          });
          return [0, 0];
        }
        return [secondsTens + 1, 0];
      }
      return [secondsTens, secondsOnes + 1];
    });
  };

  const decrementTimer = () => {
    const now = Date.now();
    const timeLeft = endTime - now;

    if (timeLeft <= 0) {
      if (!isMuted && audioRef.current) {
        audioRef.current.play();
      }
      setIsRunning(false);
      setIsPaused(false);
      setMinutes([0, 0]);
      setSeconds([0, 0]);
      setEndTime(null);
      return;
    }

    const secondsLeft = Math.ceil(timeLeft / 1000);
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    
    setMinutes([Math.floor(m / 10), m % 10]);
    setSeconds([Math.floor(s / 10), s % 10]);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  useEffect(() => {
    let intervalId;
    if (isRunning && !isPaused) {
      intervalId = setInterval(() => {
        if (isCountingUp) {
          incrementTimer();
        } else {
          decrementTimer();
        }
      }, 1000);
    }
    return () => clearInterval(intervalId);
  }, [isRunning, isPaused, isCountingUp]);

  const handleStart = () => {
    if (!isRunning && !isPaused) {
      setIsCountingUp(isInitialState);
      if (!isInitialState) {
        const totalSeconds = (minutes[0] * 10 + minutes[1]) * 60 + seconds[0] * 10 + seconds[1];
        setEndTime(Date.now() + totalSeconds * 1000);
      }
    } else if (isPaused) {
      const timeLeft = (minutes[0] * 10 + minutes[1]) * 60 + seconds[0] * 10 + seconds[1];
      setEndTime(Date.now() + timeLeft * 1000);
    }
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    setMinutes([0, 0]);
    setSeconds([0, 0]);
    setEndTime(null);
    setIsCountingUp(false);
  };

  const handleArrowClick = (digitIndex, change) => {
    if (!isRunning && !isPaused) {
      if (digitIndex < 2) {
        setMinutes(prevMinutes => {
          const newMinutes = [...prevMinutes];
          newMinutes[digitIndex] = (newMinutes[digitIndex] + change + 10) % 10;
          return newMinutes;
        });
      } else {
        setSeconds(prevSeconds => {
          const newSeconds = [...prevSeconds];
          let newValue;
          if (digitIndex - 2 === 0) {
            // For tens place of seconds, cycle between 0-5
            newValue = (newSeconds[digitIndex - 2] + change + 6) % 6;
          } else {
            // For ones place of seconds, cycle between 0-9
            newValue = (newSeconds[digitIndex - 2] + change + 10) % 10;
          }
          newSeconds[digitIndex - 2] = newValue;
          return newSeconds;
        });
      }
    }
  };

  const canAdjustTime = !isRunning && !isPaused;
  const showPlayButton = !isRunning || isPaused;
  const showPauseButton = isRunning && !isPaused;
  const showStopButton = isRunning || isPaused;

  return (
    <div className="col-span-1 row-span-2 flex flex-col items-center justify-around p-8 pt-4 text-center bg-emerald-800 text-lime-300">
      <audio ref={audioRef} src="/sounds/mixkit-racing-countdown-timer-1051.wav" />
      <div className="w-full flex flex-row items-center justify-between">
        {[0, 1].map(digitIndex => (
          <div key={digitIndex} className="w-16 h-full flex flex-col items-center justify-between">
            <span
              className={`w-12 h-12 -my-2 z-10 material-symbols-rounded !text-5xl ${canAdjustTime ? 'text-lime-300 hover:text-lime-100 cursor-pointer' : 'text-emerald-700'}`}
              onClick={() => handleArrowClick(digitIndex, 1)}
            >
              keyboard_arrow_up
            </span>
            <div className={`w-12 flex justify-center text-9xl leading-[.9em] text-center ${isRunning && !isPaused ? 'text-white' : ''}`}>
              {minutes[digitIndex]}
            </div>
            <span
              className={`w-12 h-12 -my-2 z-10 material-symbols-rounded !text-5xl ${canAdjustTime ? 'text-lime-300 hover:text-lime-100 cursor-pointer' : 'text-emerald-700'}`}
              onClick={() => handleArrowClick(digitIndex, -1)}
            >
              keyboard_arrow_down
            </span>
          </div>
        ))}
        <div className={`w-4 flex items-center justify-center text-8xl text-center ${isRunning && !isPaused ? 'text-white' : ''}`}>:</div>
        {[2, 3].map(digitIndex => (
          <div key={digitIndex} className="w-16 h-full flex flex-col items-center justify-between">
            <span
              className={`w-12 h-12 -my-2 z-10 material-symbols-rounded !text-5xl ${canAdjustTime ? 'text-lime-300 hover:text-lime-100 cursor-pointer' : 'text-emerald-700'}`}
              onClick={() => handleArrowClick(digitIndex, 1)}
            >
              keyboard_arrow_up
            </span>
            <div className={`w-12 flex justify-center text-9xl leading-[.9em] text-center ${isRunning && !isPaused ? 'text-white' : ''}`}>
              {seconds[digitIndex - 2]}
            </div>
            <span
              className={`w-12 h-12 -my-2 z-10 material-symbols-rounded !text-5xl ${canAdjustTime ? 'text-lime-300 hover:text-lime-100 cursor-pointer' : 'text-emerald-700'}`}
              onClick={() => handleArrowClick(digitIndex, -1)}
            >
              keyboard_arrow_down
            </span>
          </div>
        ))}
      </div>
      <div className="w-full flex flex-row justify-around">
        <span
          className={`w-12 h-12 flex items-center justify-center material-symbols-rounded !text-5xl ${showPlayButton ? 'text-lime-300 hover:text-lime-100 cursor-pointer' : 'text-emerald-700'}`}
          onClick={showPlayButton ? handleStart : undefined}
        >
          play_arrow
        </span>
        <span
          className={`w-12 h-12 flex items-center justify-center material-symbols-rounded !text-5xl ${showPauseButton ? 'text-lime-300 hover:text-lime-100 cursor-pointer' : 'text-emerald-700'}`}
          onClick={showPauseButton ? handlePause : undefined}
        >
          pause
        </span>
        <span
          className={`w-12 h-12 flex items-center justify-center material-symbols-rounded !text-4xl ${showStopButton ? 'text-lime-300 hover:text-lime-100 cursor-pointer' : 'text-emerald-700'}`}
          onClick={showStopButton ? handleStop : undefined}
        >
          square
        </span>
        <span
          className={`w-12 h-12 flex items-center justify-center material-symbols-rounded !text-5xl ${isRunning && !isPaused ? 'text-emerald-700' : 'text-lime-300 hover:text-lime-100 cursor-pointer'}`}
          onClick={isRunning && !isPaused ? undefined : toggleMute}
        >
          {isMuted ? 'volume_off' : 'volume_up'}
        </span>
      </div>
    </div>
  );
};

export default TimerWidget;