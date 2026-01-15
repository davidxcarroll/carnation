import React, { useEffect, useRef } from 'react';

// This is a minimal extraction of the idea item component
// Initially it will just display content - we'll add interactivity incrementally
const IdeaItem = ({ 
  idea, 
  isFocused,
  onFocus, 
  onBlur, 
  onInput, 
  onKeyDown, 
  onKeyPress, 
  onPaste 
}) => {
  const contentRef = useRef(null);
  
  // Initialize content when idea changes
  useEffect(() => {
    if (contentRef.current && idea.content) {
      contentRef.current.innerHTML = idea.content;
    }
  }, [idea.content]);
  
  return (
    <div 
      className={`idea-item mb-3 p-3 rounded-lg ${
        isFocused ? 'bg-white/10' : 'bg-white/5'
      } hover:bg-white/10`}
      data-idea-id={idea.id}
    >
      <div
        ref={contentRef}
        className="idea-content focus:outline-none"
        contentEditable="true"
        suppressContentEditableWarning={true}
        onFocus={onFocus}
        onBlur={onBlur}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onKeyPress={onKeyPress}
        onPaste={onPaste}
        dangerouslySetInnerHTML={{ __html: idea.content || '' }}
      />
    </div>
  );
};

export default IdeaItem; 