import { useCallback } from 'react';

/**
 * Custom hook providing text manipulation utilities
 */
const useTextUtils = () => {
  // Remove HTML tags and decode entities from text
  const stripHtmlAndDecodeEntities = useCallback((html) => {
    if (!html) return '';
    
    // Create a temporary element to handle the decoding
    const tempElement = document.createElement('div');
    tempElement.innerHTML = html;
    
    // Get the text content with entities decoded
    return tempElement.textContent || tempElement.innerText || '';
  }, []);

  // Set the cursor at the end of a contentEditable element
  const setCursorAtEnd = useCallback((element) => {
    if (!element) return;
    
    try {
      // Check if element is still in the document
      if (!element.isConnected) return;
      
      // First ensure the element is focused
      element.focus();
      
      // Make sure it has a child for the selection
      if (!element.firstChild) {
        const textNode = document.createTextNode('\u00A0');
        element.appendChild(textNode);
      }
      
      // Use setTimeout to ensure the focus and cursor setting happens after rendering
      setTimeout(() => {
        try {
          // Make sure element is still connected to the document
          if (!element.isConnected) return;
          
          // Create a selection at the end of the content
          const range = document.createRange();
          const selection = window.getSelection();
          if (!selection) return;
          
          // Set position to the end of the content
          if (element.lastChild) {
            if (element.lastChild.nodeType === 3) { // Text node
              // Make sure the text node is still valid
              if (!element.lastChild.isConnected) return;
              
              range.setStart(element.lastChild, element.lastChild.textContent.length);
              range.setEnd(element.lastChild, element.lastChild.textContent.length);
            } else {
              range.selectNodeContents(element);
              range.collapse(false); // Collapse to end
            }
            
            // Clear any existing selection safely
            try {
              selection.removeAllRanges();
              selection.addRange(range);
            } catch (innerErr) {
              // Silently catch "The given range isn't in document" errors
              console.debug("Could not add range to selection:", innerErr.message);
            }
          }
        } catch (err) {
          // Catch any errors that occur during the setTimeout callback
          console.debug("Error in setTimeout callback:", err.message);
        }
      }, 0);
    } catch (err) {
      // Catch any errors from the main function body
      console.debug("Error setting cursor position:", err.message);
    }
  }, []);

  return {
    stripHtmlAndDecodeEntities,
    setCursorAtEnd
  };
};

export default useTextUtils; 