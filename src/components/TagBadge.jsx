import React from 'react';

/**
 * A simple tag badge component that matches the original styling in App.jsx
 */
const TagBadge = ({ name, count, onClick, onRemove, isSelected }) => {
  return (
    <div 
      className="group flex items-center -mx-3 pb-1 pl-2 pr-3 hover:bg-white/5 rounded-lg whitespace-nowrap select-none"
      onClick={onClick}
    >
      {/* Tag icon shown by default, hidden on group hover */}
      <span className="group-hover:hidden material-symbols-rounded text-base">tag</span>
      
      {/* Close icon hidden by default, shown on group hover */}
      {onRemove && (
        <span
          className="hidden group-hover:block hover:scale-125 duration-100 ease-in-out material-symbols-rounded text-base cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          close
        </span>
      )}
      
      <span>{name}</span>
      {count !== undefined && <span className="ml-1 opacity-40">{count}</span>}
    </div>
  );
};

export default TagBadge; 