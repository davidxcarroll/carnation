import React, { useState, useEffect } from 'react';

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
    return localStorage.getItem('listTitle') || '';
  });

  const [listType, setListType] = useState('check');

  useEffect(() => {
    localStorage.setItem('listItems', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('listTitle', title);
  }, [title]);

  const toggleListType = () => {
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
        return 'radio_button_unchecked';
      case 'number':
        return `counter_${index + 1}`;
    }
  };

  const getIconColorClass = (item) => {
    if (item.text === '') return 'text-amber-200';
    
    if (listType === 'check') {
      return item.checked ? 'text-orange-600 hover:text-orange-400' : 'text-amber-200 hover:text-amber-300';
    }
    
    return 'text-orange-600';
  };

  return (
    <div className="col-span-1 row-span-3 flex flex-col justify-between p-8 bg-amber-100 text-orange-600">
      <div className="flex flex-row gap-2 items-center justify-center">
        <input
          className="w-full h-11 bg-transparent outline-none placeholder-amber-200"
          placeholder="List title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          type="text"
        />
        
        <span 
          onClick={toggleListType}
          className="w-12 h-12 material-symbols-rounded !text-5xl text-orange-600 hover:text-orange-400 cursor-pointer"
        >
          {getListToggleIcon()}
        </span>
      </div>

      {items.map((item, index) => (
        <React.Fragment key={index}>
          <div className="w-full h-1 bg-amber-200" />
          <div className="flex flex-row gap-2 items-center justify-center">
            <span 
              onClick={() => toggleItem(index)}
              className={`w-12 h-12 material-symbols-rounded !text-5xl 
                ${listType === 'check' ? 'cursor-pointer' : 'cursor-default'}
                ${getIconColorClass(item)}`}
            >
              {getListItemIcon(index, item.checked)}
            </span>
            <input
              className="w-full h-11 bg-transparent outline-none placeholder-amber-200"
              placeholder="List item"
              value={item.text}
              onChange={(e) => updateItemText(index, e.target.value)}
              type="text"
            />
          </div>
        </React.Fragment>
      ))}
      <div className="w-full h-1 bg-amber-200" />
    </div>
  );
};

export default ListWidget;