import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const DEFAULT_URL = 'https://hs.parkrose.k12.or.us/';
const DEFAULT_TITLE = 'Parkrose High';

const CodeWidget = () => {
  const containerRef = useRef(null);
  const [url, setUrl] = useState(() => localStorage.getItem('codeUrl') || DEFAULT_URL);
  const [title, setTitle] = useState(() => localStorage.getItem('codeTitle') || DEFAULT_TITLE);
  const [colors, setColors] = useState({ bg: '#FCE7F3', fg: '#DB2777' });

  useEffect(() => {
    localStorage.setItem('codeUrl', url);
  }, [url]);

  useEffect(() => {
    localStorage.setItem('codeTitle', title);
  }, [title]);

  useEffect(() => {
    if (containerRef.current) {
      const computedStyle = window.getComputedStyle(containerRef.current);
      setColors({
        bg: computedStyle.backgroundColor,
        fg: computedStyle.color
      });
    }
  }, []);

  return (
    <div ref={containerRef} className="col-span-1 row-span-3 flex flex-col gap-4 items-center justify-between p-8 text-center bg-fuchsia-200 text-pink-600">
      <input
        className="w-full h-11 text-center bg-transparent outline-none placeholder-pink-300 truncate"
        placeholder="Code title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        type="text"
      />
      <QRCodeSVG
        value={url}
        size={256}
        bgColor={colors.bg}
        fgColor={colors.fg}
        level="L"
        includeMargin={false}
      />
      <input
        className="w-full h-11 text-center bg-transparent outline-none placeholder-pink-200 truncate"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        type="text"
      />
    </div>
  );
};

export default CodeWidget;