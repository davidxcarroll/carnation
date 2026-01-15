import { useCallback } from 'react';

/**
 * Custom hook for keyboard event handling
 */
const useKeyboard = (ideas, textUtils, firebase, handleFocus) => {
  const { stripHtmlAndDecodeEntities } = textUtils;
  
  // Handle keydown events in columns
  const handleKeyDown = useCallback(async (e, columnType, columnId) => {
    const columnRef = document.querySelector(`[data-column-id="${columnId}"]`);
    if (!columnRef) return;

    // Get the selected element
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    
    // Find the containing idea-item div
    let ideaDiv = range.startContainer;
    while (ideaDiv && (!ideaDiv.classList || !ideaDiv.classList.contains('idea-item'))) {
      if (!ideaDiv.parentNode) break;
      ideaDiv = ideaDiv.parentNode;
    }
    
    if (!ideaDiv || !ideaDiv.classList || !ideaDiv.classList.contains('idea-item')) return;
    
    const ideaId = ideaDiv.getAttribute('data-idea-id');
    if (!ideaId || ideaId === 'placeholder') return;
    
    // Handle Enter key - create a new idea after the current one
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Create a new idea
      const newIdeaId = await firebase.createIdea('');
      
      // If in a tag column, add the tag to the new idea
      if (columnType === 'tag') {
        await firebase.addTagToIdea(columnId, newIdeaId);
      }
      
      // Get all ideas in the column
      const ideaDivs = Array.from(columnRef.querySelectorAll('.idea-item'));
      const currentIndex = ideaDivs.findIndex(div => div.getAttribute('data-idea-id') === ideaId);
      
      // Insert the new idea after the current one
      const newIdeaDiv = document.createElement('div');
      newIdeaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
      newIdeaDiv.setAttribute('data-idea-id', newIdeaId);
      
      if (currentIndex >= 0 && currentIndex < ideaDivs.length - 1) {
        // Insert after the current idea
        ideaDivs[currentIndex].after(newIdeaDiv);
      } else {
        // Append to the end
        columnRef.appendChild(newIdeaDiv);
      }
      
      // Focus the new idea
      newIdeaDiv.focus();
      textUtils.setCursorAtEnd(newIdeaDiv);
      
      return;
    }
    
    // Handle Backspace key at the beginning of an idea
    if (e.key === 'Backspace' && range.collapsed && isCaretAtStart(range)) {
      const content = stripHtmlAndDecodeEntities(ideaDiv.innerHTML);
      
      // Only delete the idea if it's empty
      if (!content || content.trim() === '') {
        e.preventDefault();
        
        // Get all ideas in the column
        const ideaDivs = Array.from(columnRef.querySelectorAll('.idea-item'));
        const currentIndex = ideaDivs.findIndex(div => div.getAttribute('data-idea-id') === ideaId);
        
        // Only proceed if this isn't the first idea or if there are more ideas
        if (currentIndex > 0) {
          // Move focus to the previous idea
          const prevIdeaDiv = ideaDivs[currentIndex - 1];
          const prevIdeaId = prevIdeaDiv.getAttribute('data-idea-id');
          
          // Delete the current empty idea
          await firebase.deleteIdea(ideaId);
          
          // Focus the previous idea
          prevIdeaDiv.focus();
          textUtils.setCursorAtEnd(prevIdeaDiv);
        }
        
        return;
      }
    }
    
    // Handle Tab key for navigation
    if (e.key === 'Tab') {
      e.preventDefault();
      
      // Get all columns
      const columns = document.querySelectorAll('.column');
      const columnIndex = Array.from(columns).findIndex(col => col.contains(ideaDiv));
      
      if (columnIndex >= 0) {
        let nextColIndex = e.shiftKey ? columnIndex - 1 : columnIndex + 1;
        
        // Wrap around to first/last column
        if (nextColIndex < 0) nextColIndex = columns.length - 1;
        if (nextColIndex >= columns.length) nextColIndex = 0;
        
        // Focus the next column
        const nextCol = columns[nextColIndex];
        if (nextCol) {
          const firstIdea = nextCol.querySelector('.idea-item');
          if (firstIdea) {
            firstIdea.focus();
            textUtils.setCursorAtEnd(firstIdea);
          }
        }
      }
      
      return;
    }
  }, [ideas, firebase, stripHtmlAndDecodeEntities, textUtils]);
  
  // Handle key press events (for character input)
  const handleKeyPress = useCallback((e, columnType, columnId) => {
    // Handle special key combinations if needed
  }, []);
  
  // Handle paste events
  const handlePaste = useCallback((e, columnType, columnId) => {
    // Get the text from the clipboard
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    
    // Prevent the default paste which might include formatting
    e.preventDefault();
    
    // Insert the plain text at the current position
    document.execCommand('insertText', false, text);
  }, []);
  
  // Helper to check if caret is at the start of an element
  const isCaretAtStart = (range) => {
    if (!range.collapsed) return false;
    
    // Check if we're at position 0 of a text node
    if (range.startContainer.nodeType === 3 && range.startOffset === 0) {
      return true;
    }
    
    // Check if we're at the beginning of an element
    if (range.startContainer.nodeType === 1 && range.startOffset === 0) {
      return true;
    }
    
    return false;
  };
  
  return {
    handleKeyDown,
    handleKeyPress,
    handlePaste
  };
};

export default useKeyboard; 