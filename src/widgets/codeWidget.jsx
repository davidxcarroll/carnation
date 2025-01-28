import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const DEFAULT_TITLE = 'Mr. Dorr\'s Website';
const DEFAULT_URL = 'mrdorr.info';
const DEFAULT_HEIGHT = 56;

const CodeWidget = () => {
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const [url, setUrl] = useState(() => localStorage.getItem('codeUrl') || DEFAULT_URL);
  const [title, setTitle] = useState(() => localStorage.getItem('codeTitle') || DEFAULT_TITLE);
  const [height, setHeight] = useState(() => parseInt(localStorage.getItem('codeHeight')) || DEFAULT_HEIGHT);
  const [colors, setColors] = useState({ bg: '#FCE7F3', fg: '#DB2777' });
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);

  useEffect(() => {
    localStorage.setItem('codeUrl', url);
  }, [url]);

  useEffect(() => {
    localStorage.setItem('codeTitle', title);
  }, [title]);

  useEffect(() => {
    localStorage.setItem('codeHeight', height);
    if (textareaRef.current) {
      textareaRef.current.style.height = `${height}px`;
    }
  }, [height]);

  useEffect(() => {
    if (containerRef.current) {
      const computedStyle = window.getComputedStyle(containerRef.current);
      setColors({
        bg: computedStyle.backgroundColor,
        fg: computedStyle.color
      });
    }
  }, []);

  const startResize = (e) => {
    setIsResizing(true);
    setStartY(e.clientY);
    setStartHeight(textareaRef.current.offsetHeight);
  };

  const stopResize = () => {
    setIsResizing(false);
  };

  const resize = (e) => {
    if (isResizing && textareaRef.current) {
      const newHeight = Math.max(DEFAULT_HEIGHT, startHeight + (e.clientY - startY));
      setHeight(newHeight);
    }
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResize);
    }
    return () => {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing, startHeight, startY]);

  return (
    <div ref={containerRef} className="col-span-1 row-span-3 flex flex-col gap-2 items-center justify-between p-[2vw] text-center bg-fuchsia-200 text-pink-600">
      <div className="relative w-full group">
        <textarea
          ref={textareaRef}
          rows={1}
          className="w-full min-h-14 p-0 text-center leading-[1.1em] bg-transparent outline-none placeholder-pink-300 resize-none"
          placeholder="Code title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div 
          className="absolute bottom-0 left-0 w-full cursor-ns-resize opacity-0 group-hover:opacity-100"
          onMouseDown={startResize}
        >
          <div className="w-full h-2 bg-pink-300 rounded-full" />
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