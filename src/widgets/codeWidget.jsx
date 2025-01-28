import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const DEFAULT_TITLE = 'Mr. Dorr\'s Website';
const DEFAULT_URL = 'mrdorr.info';

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

  const sharedStyles = {
    gridArea: '1 / 1 / 2 / 2',
    lineHeight: '1.1em',
    paddingBottom: '10px'
  };

  return (
    <div ref={containerRef} className="col-span-1 row-span-3 flex flex-col gap-2 items-center justify-between p-[2vw] text-center bg-fuchsia-200 text-pink-600">
      <div 
        className="w-full grid"
        style={{ 
          '--text-value': `"${title}"` 
        }}
      >
        <textarea
          rows={1}
          className="w-full p-0 text-center bg-transparent outline-none placeholder-pink-300 resize-none overflow-hidden col-start-1 row-start-1"
          placeholder="Code title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={sharedStyles}
        />
        <div 
          className="w-full p-0 text-center whitespace-pre-wrap invisible overflow-hidden col-start-1 row-start-1"
          style={sharedStyles}
          aria-hidden="true"
        >
          {title + ' '}
        </div>
      </div>
      <QRCodeSVG
        value={url}
        width="100%"
        height="100%"
        bgColor={colors.bg}
        fgColor={colors.fg}
        level="L"
        includeMargin={false}
      />
      <input
        className="w-full h-fit text-center bg-transparent outline-none placeholder-pink-200 truncate"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        type="text"
      />
    </div>
  );
};

export default CodeWidget;