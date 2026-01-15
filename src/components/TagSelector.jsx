import React from 'react';

/**
 * A component for selecting/filtering tags
 */
const TagSelector = ({ 
  tags, 
  selectedTags, 
  toggleTagSelection, 
  toggleAllTags, 
  selectionState,
  untaggedCount,
  tagCounts 
}) => {
  return (
    <>
      <div className="flex flex-row items-center justify-between gap-4 -mx-3 px-3 text-white hover:bg-white/[2%] rounded-lg cursor-pointer">
        <div className="w-full flex flex-row items-center gap-1 pt-1 pb-2 select-none" onClick={toggleAllTags}>
          <span className={`material-symbols-rounded text-base ${selectionState === 'all' || selectionState === 'indeterminate' ? 'filled' : ''}`}>
            {selectionState === 'all' ? 'check_box' : 
              selectionState === 'indeterminate' ? 'indeterminate_check_box' : 
                'check_box_outline_blank'}
          </span>
          <span className="">Tags</span>
        </div>
        <div className="flex flex-row items-center gap-1">
          <span className="material-symbols-rounded text-base cursor-pointer text-white/40 hover:scale-125 duration-100 ease-in-out hover:text-white">tune</span>
        </div>
      </div>

      {/* Untagged ideas item */}
      <div
        className="flex flex-row items-center gap-1 -mx-3 pt-1 pb-2 px-3 text-white leading-tight hover:bg-white/[2%] rounded-lg cursor-pointer"
        onClick={() => toggleTagSelection('untagged')}
      >
        <span className={`material-symbols-rounded text-base ${selectedTags['untagged'] ? 'filled' : ''} ${!selectedTags['untagged'] ? 'opacity-10' : ''}`}>
          {selectedTags['untagged'] ? 'check' : 'check_box_outline_blank'}
        </span>
        <span className={`${!selectedTags['untagged'] ? 'opacity-40' : ''}`}>untagged</span>
        <span className="ml-1 opacity-40">{untaggedCount}</span>
      </div>

      {/* Show list of tags */}
      {tags.map(tag => (
        <div
          key={tag.id}
          className="flex flex-row items-center gap-1 -mx-3 pt-1 pb-2 px-3 text-white leading-tight hover:bg-white/[2%] rounded-lg cursor-pointer"
          onClick={() => toggleTagSelection(tag.id)}
        >
          <span className={`material-symbols-rounded text-base ${selectedTags[tag.id] ? 'filled' : ''} ${!selectedTags[tag.id] ? 'opacity-10' : ''}`}>
            {selectedTags[tag.id] ? 'check' : 'check_box_outline_blank'}
          </span>
          <span className={`${!selectedTags[tag.id] ? 'opacity-40' : ''}`}>{tag.name}</span>
          <span className="ml-1 opacity-40">{tagCounts[tag.id] || 0}</span>
        </div>
      ))}
    </>
  );
};

export default TagSelector; 