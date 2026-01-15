/**
 * Strip HTML tags and decode HTML entities from a string
 * @param {string} html - HTML string to clean
 * @returns {string} - Plain text without HTML tags and decoded entities
 */
export const stripHtmlAndDecodeEntities = (html) => {
  if (!html) return '';
  
  // Create a temporary element to handle the decoding
  const tempElement = document.createElement('div');
  tempElement.innerHTML = html;
  
  // Get the text content with entities decoded
  return tempElement.textContent || tempElement.innerText || '';
};

/**
 * Set the cursor at the end of a contentEditable element
 * @param {HTMLElement} element - The element to position cursor in
 */
export const setCursorAtEnd = (element) => {
  if (!element) return;
  
  // First ensure the element is focused
  element.focus();
  
  // Make sure it has a child for the selection
  if (!element.firstChild) {
    const textNode = document.createTextNode('\u00A0');
    element.appendChild(textNode);
  }
  
  // Create a selection at the end of the content
  const range = document.createRange();
  const selection = window.getSelection();
  
  // Set position to the end of the content
  if (element.lastChild) {
    if (element.lastChild.nodeType === 3) { // Text node
      range.setStart(element.lastChild, element.lastChild.textContent.length);
      range.setEnd(element.lastChild, element.lastChild.textContent.length);
    } else {
      range.selectNodeContents(element);
      range.collapse(false); // Collapse to end
    }
    
    selection.removeAllRanges();
    selection.addRange(range);
  }
};

/**
 * Get plain text content from a contentEditable element
 * @param {HTMLElement} element - The contentEditable element
 * @returns {string} - Plain text content
 */
export const getPlainTextContent = (element) => {
  if (!element) return '';
  return element.textContent || '';
};

/**
 * Check if an element is empty (contains only whitespace)
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} - True if empty, false otherwise
 */
export const isElementEmpty = (element) => {
  if (!element) return true;
  return element.textContent.trim() === '';
}; 