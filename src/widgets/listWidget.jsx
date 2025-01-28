import React, { useState, useEffect, useRef } from 'react';

const ListWidget = () => {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('listItems');
    return saved ? JSON.parse(saved) : [
      { checked: false, text: '' },
      { checked: false, text: '' },
      { checked: false, text: '' },
      { checked: false, text: '' },
      { checked: false, text: '' }
    ];
  });

  const [title, setTitle] = useState(() => {
    return localStorage.getItem('listTitle') || 'To-do List';
  });

  const [listType, setListType] = useState('check');
  const toggleOffAudioRef = useRef(null);
  const toggleOnAudioRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('listItems', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('listTitle', title);
  }, [title]);

  const playToggleSound = (isCheckingOn) => {
    const audioRef = isCheckingOn ? toggleOnAudioRef : toggleOffAudioRef;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => console.error('Error playing sound:', error));
    }
  };

  const toggleListType = () => {
    playToggleSound(false); // Use toggle-off sound for list type changes
    setListType(current => {
      switch(current) {
        case 'check': return 'bullet';
        case 'bullet': return 'number';
        default: return 'check';
      }
    });
  };

  const toggleItem = (index) => {
    if (listType !== 'check') return;
    const isCheckingOn = !items[index].checked;
    playToggleSound(isCheckingOn);
    setItems(items.map((item, i) => 
      i === index ? { ...item, checked: !item.checked } : item
    ));
  };

  const updateItemText = (index, text) => {
    setItems(items.map((item, i) => 
      i === index ? { ...item, text } : item
    ));
  };

  const getListToggleIcon = () => {
    switch(listType) {
      case 'check': return 'checklist';
      case 'bullet': return 'format_list_bulleted';
      case 'number': return 'format_list_numbered';
    }
  };

  const getListItemIcon = (index, checked) => {
    switch(listType) {
      case 'check':
        return checked ? 'check' : 'check_box_outline_blank';
      case 'bullet':
        return 'fiber_manual_record';
      case 'number':
        return `counter_${index + 1}`;
    }
  };

  const getIconColorClass = (item) => {
    if (item.text === '') return 'text-amber-200';
    
    if (listType === 'check') {
      return item.checked 
        ? 'text-orange-600 hover:text-orange-400 scale-150' 
        : 'text-amber-200 hover:text-amber-300';
    }
    
    return 'text-orange-600';
  };

  return (
    <div className="col-span-1 row-span-3 flex flex-col justify-between p-[3vw] pt-[1vw] pb-[2vw] bg-amber-100 text-orange-600">
      {/* Sound for toggling off and list type changes */}
      <audio ref={toggleOffAudioRef} src="/sounds/mixkit-game-ball-tap-2073-trim.mp3" />
      
      {/* Sound for toggling checkmark on */}
      <audio ref={toggleOnAudioRef} src="/sounds/mixkit-correct-answer-notification-947.wav" />

      <div className="flex flex-row gap-2 items-center justify-center">
        <input
          className="w-full h-fit bg-transparent outline-none placeholder-amber-200 truncate"
          placeholder="List title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          type="text"
        />
        
        <span 
          onClick={toggleListType}
          className="w-fit h-fit material-symbols-rounded [font-size:clamp(2rem,3vw,6rem)] text-orange-600 hover:text-orange-400 cursor-pointer"
        >
          {getListToggleIcon()}
        </span>
      </div>

      {items.map((item, index) => (
        <React.Fragment key={index}>

          <div className="w-full h-[.15em] bg-amber-200 rounded-full" />

          <div className="flex flex-row gap-2 items-center justify-center">
            <span 
              onClick={() => toggleItem(index)}
              className={`w-fit h-fit material-symbols-rounded [font-size:clamp(2rem,3vw,6rem)] 
                ${listType === 'check' ? 'cursor-pointer' : 'cursor-default'}
                ${getIconColorClass(item)}`}
            >
              {getListItemIcon(index, item.checked)}
            </span>
            <input
              className="w-full h-fit pl-2 bg-transparent outline-none placeholder-amber-200 truncate"
              placeholder="List item"
              value={item.text}
              onChange={(e) => updateItemText(index, e.target.value)}
              type="text"
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default ListWidget;