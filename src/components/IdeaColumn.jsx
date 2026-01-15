import React, { forwardRef, useState, useEffect, useRef } from 'react';

/**
 * A component for displaying a column of ideas
 */
const IdeaColumn = forwardRef(({ 
  title, 
  count, 
  isSticky,
  handleChange,
  handleKeyDown,
  handleKeyPress,
  handlePaste,
  handleFocus,
  handleBlur,
  columnType,
  columnId,
  onEditModeChange,
  setFocusedIdeaId,
  groupByTag
}, ref) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'save', 'discard', or null
  const [textareaContent, setTextareaContent] = useState('');
  const [initialContent, setInitialContent] = useState(''); // To track changes
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const columnContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const viewModeRef = useRef(null);
  const editModeRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  
  // Local storage key for auto-saving
  const localStorageKey = `carnation_column_${columnType}_${columnId}_content`;
  
  // Handle input changes in edit mode
  const handleInputChange = (e) => {
    e.stopPropagation();
    const newContent = e.target.value;
    setTextareaContent(newContent);
    
    // Mark as having unsaved changes if different from initial content
    if (newContent !== initialContent) {
      setHasUnsavedChanges(true);
      
      // Auto-save to localStorage every time content changes
      try {
        localStorage.setItem(localStorageKey, newContent);
        localStorage.setItem(`${localStorageKey}_timestamp`, Date.now());
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
    } else {
      setHasUnsavedChanges(false);
    }
  };
  
  // Handle textarea keyboard shortcuts
  const handleTextareaKeyDown = (e) => {
    e.stopPropagation();
    
    // Save on Ctrl+Enter or Cmd+Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (hasUnsavedChanges) {
        saveAndExit();
      } else {
        exitEditMode();
      }
    }
    // Cancel on Escape
    else if (e.key === 'Escape') {
      e.preventDefault();
      
      // If there are unsaved changes, show the confirmation dialog
      if (hasUnsavedChanges) {
        showConfirmationDialog('discard');
      } else {
        exitEditMode();
      }
    }
  };
  
  // Exit edit mode without saving
  const exitEditMode = () => {
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    // Clear localStorage backup
    localStorage.removeItem(localStorageKey);
    localStorage.removeItem(`${localStorageKey}_timestamp`);
    
    // Re-initialize the column content with original data
    if (onEditModeChange) {
      onEditModeChange(false);
    }
  };
  
  // Save and exit edit mode
  const saveAndExit = () => {
    console.log(`Exiting edit mode for ${columnType}:${columnId}`);
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    
    // Clear localStorage backup
    localStorage.removeItem(localStorageKey);
    localStorage.removeItem(`${localStorageKey}_timestamp`);
    
    // Notify parent component of edit mode change with the textarea content
    if (onEditModeChange) {
      console.log(`Saving content for ${columnType}:${columnId}, content length: ${textareaContent.length}`);
      // Pass the textarea content to be processed into individual ideas
      onEditModeChange(false, textareaContent);
    }
  };
  
  // Toggle edit mode
  const toggleEditMode = () => {
    // If turning off edit mode, save changes
    if (isEditMode) {
      // If there are unsaved changes, show the confirmation dialog
      if (hasUnsavedChanges) {
        showConfirmationDialog('save');
      } else {
        exitEditMode();
      }
    } else {
      // Check for saved draft in localStorage
      let savedContent = null;
      try {
        savedContent = localStorage.getItem(localStorageKey);
        const timestamp = localStorage.getItem(`${localStorageKey}_timestamp`);
        
        if (savedContent && timestamp) {
          const savedTime = new Date(parseInt(timestamp));
          const timeAgo = Math.round((Date.now() - parseInt(timestamp)) / 1000 / 60);
          console.log(`Found saved draft from ${timeAgo} minutes ago`);
        }
      } catch (error) {
        console.error("Error reading from localStorage:", error);
      }
      
      // Turning on edit mode - generate textarea content from ideas
      console.log(`Entering edit mode for ${columnType}:${columnId}`);
      const newEditMode = true;
      setIsEditMode(newEditMode);
      
      // Clear focused idea to close the sidebar when entering edit mode
      if (setFocusedIdeaId) {
        setFocusedIdeaId(null);
      }
      
      // If we have a saved draft, ask if the user wants to restore it
      if (savedContent) {
        // Set content to the saved draft and show restoration notice
        setTextareaContent(savedContent);
        setInitialContent(''); // Ensures hasUnsavedChanges will be true
        setHasUnsavedChanges(true);
        
        // Show a temporary notice that content was restored
        // This would be implemented as a toast notification in a real app
        console.log("Unsaved draft restored from previous session");
        setShowToast(true);
        setToastMessage("Unsaved draft restored from previous session");
        
        // Set a timeout to hide the toast after 3 seconds
        toastTimeoutRef.current = setTimeout(() => {
          setShowToast(false);
        }, 3000);
      } else {
        // Otherwise get content from column
        if (viewModeRef.current) {
          const ideaDivs = viewModeRef.current.querySelectorAll('.idea-item');
          let content = '';
          
          console.log(`Found ${ideaDivs.length} ideas in ${columnType}:${columnId}`);
          
          ideaDivs.forEach((div, index) => {
            const ideaText = div.textContent.trim();
            if (ideaText) {
              content += ideaText;
              // Add line break after each idea except the last one
              if (index < ideaDivs.length - 1) {
                content += '\n';
              }
            }
          });
          
          console.log(`Setting textarea content for ${columnType}:${columnId}, length: ${content.length}`);
          setTextareaContent(content);
          setInitialContent(content); // Store initial content to detect changes
        }
      }
      
      // Notify parent component of edit mode change - do this immediately to hide sidebar
      if (onEditModeChange) {
        onEditModeChange(newEditMode);
      }
    }
  };
  
  // Show confirmation dialog with specified action
  const showConfirmationDialog = (action) => {
    setConfirmAction(action);
    setShowConfirmDialog(true);
  };
  
  // Focus the textarea when edit mode is activated
  useEffect(() => {
    if (isEditMode && textareaRef.current) {
      // Short timeout to ensure the DOM has updated
      setTimeout(() => {
        textareaRef.current.focus();
        console.log(`Focused textarea for ${columnType}:${columnId}`);
      }, 100);
    }
    
    // Clear toast timeout on unmount or when edit mode changes
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [isEditMode, columnType, columnId]);
  
  // Handle window beforeunload event to warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isEditMode && hasUnsavedChanges) {
        // The modern way of showing a custom message doesn't work in most browsers anymore for security reasons
        // Instead, browsers show a generic message, but we need to do this to trigger the dialog
        e.preventDefault();
        const message = "You have unsaved changes. Are you sure you want to leave?";
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isEditMode, hasUnsavedChanges]);
  
  // Handle click outside to show confirmation dialog if in edit mode with unsaved changes
  const handleOutsideClick = (e) => {
    if (isEditMode && hasUnsavedChanges && 
        columnContainerRef.current && 
        !columnContainerRef.current.contains(e.target)) {
      showConfirmationDialog('discard');
      e.preventDefault();
      e.stopPropagation();
    }
  };
  
  // Set up and clean up click outside listener
  useEffect(() => {
    if (isEditMode) {
      document.addEventListener('mousedown', handleOutsideClick);
    } else {
      document.removeEventListener('mousedown', handleOutsideClick);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isEditMode, hasUnsavedChanges]);
  
  // Handle saving changes and exiting edit mode
  const saveAndContinue = () => {
    saveAndExit();
    setShowConfirmDialog(false);
    
    // If we need to perform any action after saving, do it here
    if (confirmAction === 'save') {
      // Any additional actions after saving
    }
  };
  
  // Handle discarding changes and exiting edit mode
  const discardAndContinue = () => {
    exitEditMode();
    setShowConfirmDialog(false);
    
    // If we need to perform any action after discarding, do it here
    if (confirmAction === 'discard') {
      // Any additional actions after discarding
    }
  };
  
  // When the component mounts, set the initial data attribute
  useEffect(() => {
    if (ref && ref.current) {
      ref.current.setAttribute('data-edit-mode', isEditMode);
    }
  }, []);
  
  // Determine the keyboard shortcut text based on platform
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const saveShortcut = isMac ? '⌘+Enter' : 'Ctrl+Enter';
  
  return (
    <div className={`relative min-w-[400px] flex flex-1 flex-col ${groupByTag ? '' : 'overflow-auto'}`} ref={columnContainerRef}>
      {title && (
        <div
          className={`
            min-h-14 flex justify-between items-center px-4 mx-4
            ${isSticky ? 'sticky top-0 z-10 bg-neutral-900 shadow-[0_1px_0_rgba(255,255,255,0.05),16px_0_0_rgba(23,23,23,1),-16px_0_0_rgba(23,23,23,1)]' : ''}
          `}
        >
          <div className="flex items-center -mx-1 -mb-1 pb-1 pl-2 pr-3 whitespace-nowrap select-none">
            {columnType === 'tag' && <span className="material-symbols-rounded text-base">tag</span>}
            {title} {count !== undefined && <span className="ml-1 opacity-40">{count}</span>}
          </div>
          <button 
            onClick={toggleEditMode}
            className={`flex items-center px-3 pt-1 pb-2 -mb-1 rounded-lg ${isEditMode ? 'bg-green-700 hover:bg-green-600' : 'hover:bg-white/[2%]'} text-white/80 hover:text-white text-sm`}
          >
            <span className="material-symbols-rounded text-base">
              {isEditMode ? 'save' : 'edit_square'}
            </span>
            {isEditMode ? 'Save' : ''}
          </button>
        </div>
      )}
      
      {/* Completely separate containers for each mode */}
      <div className={`flex flex-1 ${groupByTag ? '' : 'overflow-auto'}`}>
        {/* Edit Mode Container */}
        {isEditMode && (
          <div 
            className="flex-1 flex flex-col relative z-10 overflow-auto" 
            ref={editModeRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex-1 grid overflow-auto">
              <textarea
                ref={textareaRef}
                value={textareaContent}
                onChange={handleInputChange}
                onKeyDown={handleTextareaKeyDown}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-full p-4 focus:outline-none rounded-2xl bg-neutral-800/50
                  text-base text-white text-center leading-loose
                  resize-none whitespace-pre-wrap
                  shadow-[inset_0_0_1px_rgba(255,255,255,0.25)] col-start-1 row-start-1"
                placeholder="Start typing..."
                spellCheck="false"
                data-column-id={columnId}
                data-column-type={columnType}
              />
              <div
                className="h-full p-4 whitespace-pre-wrap invisible overflow-hidden
                  col-start-1 row-start-1"
                aria-hidden="true"
              >
                {textareaContent + '\n'}
              </div>
            </div>
            
            {/* Status display showing if there are unsaved changes */}
            <div className="flex justify-between items-center text-xs text-white/40 mt-2 mb-1 px-2">
              <div>
                {hasUnsavedChanges ? (
                  <span className="text-yellow-400">Unsaved changes</span>
                ) : (
                  <span>No changes</span>
                )}
              </div>
              <div>
                Press {saveShortcut} to save • Esc to cancel
              </div>
            </div>
          </div>
        )}
        
        {/* View Mode Container - only render when NOT in edit mode */}
        {!isEditMode && (
          <div
            ref={(node) => {
              // Assign to both refs
              viewModeRef.current = node;
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            className={`flex-1 p-4 focus:outline-none text-center leading-tight rounded-2xl 
              shadow-[inset_0_0_1px_rgba(255,255,255,0.25)] whitespace-pre-wrap ${groupByTag ? '' : 'overflow-auto'} 
              cursor-default select-none`}
            data-column-id={columnId}
            data-column-type={columnType}
            data-edit-mode="false"
          >
            {/* Content will be set via initializeColumnContent */}
          </div>
        )}
      </div>
      
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 rounded-2xl">
          <div className="bg-neutral-800 p-6 rounded-lg shadow-lg max-w-sm">
            <h3 className="text-white text-lg font-medium mb-4">Unsaved Changes</h3>
            <p className="text-white/70 mb-6">You have unsaved changes. What would you like to do?</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={discardAndContinue}
                className="flex items-center px-4 py-2 bg-neutral-700 text-white/80 rounded hover:bg-neutral-600"
              >
                <span className="material-symbols-rounded text-base mr-1">delete</span>
                Discard
              </button>
              <button 
                onClick={saveAndContinue}
                className="flex items-center px-4 py-2 bg-green-700 text-white rounded hover:bg-green-600"
              >
                <span className="material-symbols-rounded text-base mr-1">save</span>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex items-center bg-green-700 text-white py-2 px-4 rounded-lg shadow-xl">
            <span className="material-symbols-rounded text-base mr-2">info</span>
            <p>{toastMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default IdeaColumn; 