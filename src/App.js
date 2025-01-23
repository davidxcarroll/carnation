import React, { useState, useEffect } from 'react';
import { generateLyrics } from './utils/lyricGenerators';
import AccentElement, { getColorClass } from './accentElement';
import './App.css';

const WeemixApp = () => {
  const [topic, setTopic] = useState('food');
  const [tune, setTune] = useState('tuneFrere');
  const [currentLyrics, setCurrentLyrics] = useState([]);
  const [accentColor, setAccentColor] = useState('green');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const topics = [
    { name: '🍕 Food', value: 'food' },
    { name: '🐶 Animals', value: 'animals' },
    { name: '⚽️ Sports', value: 'sports' },
    { name: '🌌 Star Wars', value: 'starwars' },
    { name: '👾 Minecraft', value: 'minecraft' },
    { name: '🍄 Mario', value: 'mario' },
    { name: '☁️ Pixar', value: 'pixar' },
    { name: '🧙‍♂️ Harry Potter', value: 'harry' },
    { name: '📄 The Office', value: 'office' },
    { name: '👹 Anything', value: 'anything' },
  ];

  const tunes = [
    { name: '💤 Frère Jacques', value: 'tuneFrere' },
    { name: '✨ Twinkle Twinkle', value: 'tuneTwinkle' },
    { name: '🛶 Row Boat', value: 'tuneRow' },
    { name: '🐑 Mary Lamb', value: 'tuneMary' },
    { name: '🥐 Hot Cross', value: 'tuneBuns' },
  ];

  const colors = [
    { name: '💚', value: 'green' },
    { name: '💙', value: 'blue' },
    { name: '💜', value: 'purple' },
    { name: '🩷', value: 'fuchsia' },
    { name: '❤️', value: 'red' },
    { name: '🧡', value: 'orange' },
    { name: '💛', value: 'yellow' },
  ];

  useEffect(() => {
    mix();
  }, []);

  const mix = () => {
    const newLyrics = generateLyrics(tune, topic);
    setCurrentLyrics(newLyrics);
  };

  const handleSing = () => {
    setIsModalOpen(false);
    mix();
  };

  const renderButton = (item, currentValue, setter, category) => (
    <div
      key={`${category}-${item.value}`}
      onClick={() => setter(item.value)}
      className={`
        flex flex-1 items-center justify-center cursor-pointer whitespace-nowrap 
        rounded-full md:py-3 sm:py-2 py-1 md:px-6 sm:px-4 px-2
        ${currentValue === item.value 
          ? `bg-white`
          : 'bg-white/50'
        }
      `}
    >
      {item.name}
    </div>
  );

  return (
    <div className="relative flex flex-col-reverse w-screen h-[100dvh] min-h-[-webkit-fill-available] p-1 bg-white dark:bg-black font-pangram uppercase overflow-y-auto">

      {/* Modal */}
      <AccentElement
        color={accentColor}
        type="bgOpacity"
        className={`
          w-full h-full p-1 pb-0
          ${isModalOpen ? 'flex' : 'hidden'}
          flex-row flex-wrap justify-center gap-1
          absolute top-0 left-0 z-50
          backdrop-blur-sm overflow-auto
          xl:text-4xl lg:text-3xl md:text-2xl sm:text-xl text-lg
          `}
      >

        {colors.map(c => renderButton(c, accentColor, setAccentColor, 'color'))}

        {/* title */}
        <div className="w-full flex justify-center items-center">Sing about</div>

        {topics.map(t => renderButton(t, topic, setTopic, 'topic'))}

        {/* title */}
        <div className="w-full flex justify-center items-center">to the tune of</div>

        {tunes.map(t => renderButton(t, tune, setTune, 'tune'))}

        {/* Sing button */}
        <div
          onClick={handleSing}
          className="
            w-full flex items-center justify-center text-white bg-black
            md:rounded-t-[4rem] rounded-t-[2rem] whitespace-nowrap cursor-pointer
            sm:text-5xl text-2xl
            xl:py-6 md:py-5 py-4
          "
        >
          Sing!
        </div>

      </AccentElement>

      {/* Nav */}
      <div className={`
        w-full flex flex-row justify-center items-start gap-1
        text-white dark:text-black max-md:px-0
        `}
      >

        <AccentElement
          onClick={() => setIsModalOpen(true)}
          color={accentColor}
          type="bg"
          className={`
            w-full flex items-center justify-center sm:gap-8 gap-1 rounded-full cursor-pointer
            md:pr-10 pr-3 md:pl-8 pl-4
            xl:text-4xl lg:text-3xl md:text-2xl sm:text-xl text-lg
            xl:py-12 lg:py-8 md:py-6 sm:py-4 py-2
          `}
        >
          <span className="material-symbols-rounded md:!text-3xl !text-2xl">tune</span>
          <span className="w-full whitespace-break-spaces md:leading-6 leading-5 text-center">
            Sing about {topics.find(t => t.value === topic)?.name} to {tunes.find(t => t.value === tune)?.name}
          </span>
        </AccentElement>

        {/* Mix button */}
        <AccentElement
          onClick={mix}
          color={accentColor}
          type="bg"
          className={`
            h-full max-sm:max-h-16 aspect-square flex items-center justify-center rounded-full px-2 py-1 cursor-pointer
          `}
        >
          <span className="material-symbols-rounded md:!text-3xl !text-2xl">autorenew</span>
        </AccentElement>

      </div>

      {/* Lyrics */}
      <div className={`
        lyrics flex flex-1 flex-col justify-evenly w-full overflow-y-auto
        xl:text-6xl lg:text-5xl md:text-4xl text-3xl
        xl:leading-[3rem] lg:leading-10 md:leading-9 leading-7
        ${getColorClass('text', accentColor)}`}
      >
        {currentLyrics.map((line, index) => (
          <p key={`lyric-${index}`} className="w-full text-center">{line}</p>
        ))}
      </div>
    </div>
  );
};

export default WeemixApp;