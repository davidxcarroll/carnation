import React, { useState, useRef, useEffect, useCallback } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where, limit, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import './index.css';

const App = () => {
  const [ideas, setIdeas] = useState([]);
  const [focusedIdeaId, setFocusedIdeaId] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const editorRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const updateTimeoutRef = useRef(null);
  const ideasRef = collection(db, 'ideas');

  // Load ideas from Firebase on startup
  useEffect(() => {
    const q = query(ideasRef, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Skip if we're currently updating to avoid loops
      if (isUpdatingRef.current) return;
      
      const ideasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setIdeas(ideasData);
      
      // Only update the editor content on initial load
      if (isInitialLoad && editorRef.current && ideasData.length > 0) {
        // Build the HTML from the ideas
        const html = ideasData.map(idea => 
          `<div class="idea-item my-6 block" data-idea-id="${idea.id}">${idea.content || ''}</div>`
        ).join('');
        
        editorRef.current.innerHTML = html || '<div class="idea-item my-6 block min-h-[2rem]" data-idea-id="placeholder">Start typing here...</div>';
        setIsInitialLoad(false);
      }
    });
    
    return () => unsubscribe();
  }, [isInitialLoad]);

  // Handle editor focus
  const handleFocus = () => {
    if (!editorRef.current) return;
    
    // Clear placeholder text
    const placeholderDiv = editorRef.current.querySelector('[data-idea-id="placeholder"]');
    if (placeholderDiv && placeholderDiv.textContent === 'Start typing here...') {
      // Replace placeholder with a real idea
      createNewIdea('');
    }
  };

  // Handle editor blur
  const handleBlur = () => {
    if (!editorRef.current) return;
    
    // If editor is empty, show placeholder
    if (editorRef.current.textContent.trim() === '') {
      editorRef.current.innerHTML = '<div class="idea-item my-6 block min-h-[2rem]" data-idea-id="placeholder">Start typing here...</div>';
      const placeholderDiv = editorRef.current.querySelector('[data-idea-id="placeholder"]');
      if (placeholderDiv) {
        placeholderDiv.classList.add('text-neutral-400');
      }
    }
    
    // Sync any pending changes
    syncIdeasWithDOM();
  };

  // Create a new idea in Firebase
  const createNewIdea = async (content, insertAfterIndex = ideas.length - 1) => {
    isUpdatingRef.current = true;
    
    try {
      // Calculate new order
      const newOrder = insertAfterIndex >= 0 && ideas.length > 0
        ? ideas[insertAfterIndex].order + 0.5
        : 0;
      
      // Create new idea in Firebase
      const newIdeaRef = await addDoc(ideasRef, {
        content: content || '',
        order: newOrder,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Update local ideas array
      const newIdea = {
        id: newIdeaRef.id,
        content: content || '',
        order: newOrder,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const updatedIdeas = [...ideas];
      updatedIdeas.splice(insertAfterIndex + 1, 0, newIdea);
      
      // Normalize orders to be sequential integers
      const normalizedIdeas = updatedIdeas.map((idea, idx) => ({
        ...idea,
        order: idx
      }));
      
      // Update orders in Firebase
      const updatePromises = normalizedIdeas.map(idea => 
        idea.id !== newIdeaRef.id && idea.order !== ideas.find(i => i.id === idea.id)?.order
          ? updateDoc(doc(db, 'ideas', idea.id), { order: idea.order })
          : Promise.resolve()
      );
      
      await Promise.all(updatePromises);
      setIdeas(normalizedIdeas);
      
      return newIdeaRef.id;
    } catch (error) {
      console.error("Error creating new idea:", error);
      return null;
    } finally {
      isUpdatingRef.current = false;
    }
  };

  // Sync the DOM content with Firebase ideas
  const syncIdeasWithDOM = useCallback(() => {
    if (!editorRef.current) return;
    
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(async () => {
      isUpdatingRef.current = true;
      
      try {
        // Get all idea divs from the editor
        const ideaDivs = editorRef.current.querySelectorAll('.idea-item');
        const domIdeas = Array.from(ideaDivs).map((div, index) => {
          let content = div.innerHTML;
          
          // If this div has a placeholder, don't save the placeholder to Firebase
          if (div.hasAttribute('data-has-placeholder') && (content === '&nbsp;' || content === '\u00A0')) {
            content = '';
          }
          
          return {
            id: div.getAttribute('data-idea-id'),
            content: content,
            order: index
          };
        });
        
        // Skip placeholder divs
        const validDomIdeas = domIdeas.filter(idea => idea.id !== 'placeholder');
        
        // Update existing ideas and identify new ones
        const updatePromises = validDomIdeas.map(domIdea => {
          const existingIdea = ideas.find(idea => idea.id === domIdea.id);
          
          if (existingIdea) {
            // Update existing idea if content changed
            if (existingIdea.content !== domIdea.content || existingIdea.order !== domIdea.order) {
              return updateDoc(doc(db, 'ideas', domIdea.id), {
                content: domIdea.content,
                order: domIdea.order,
                updatedAt: new Date()
              });
            }
          } else if (domIdea.id !== 'placeholder') {
            // This should not happen in normal operation, but handle just in case
            // by creating a new idea with this ID
            return setDoc(doc(db, 'ideas', domIdea.id), {
              content: domIdea.content,
              order: domIdea.order,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
          
          return Promise.resolve();
        });
        
        // Find and delete ideas that no longer exist in the DOM
        const idsInDom = validDomIdeas.map(idea => idea.id);
        const deletedIdeas = ideas.filter(idea => !idsInDom.includes(idea.id));
        
        const deletePromises = deletedIdeas.map(idea => 
          deleteDoc(doc(db, 'ideas', idea.id))
        );
        
        await Promise.all([...updatePromises, ...deletePromises]);
        
        // Update local state with the new order and content
        const updatedIdeas = ideas.map(idea => {
          const domIdea = validDomIdeas.find(di => di.id === idea.id);
          if (domIdea) {
            return {
              ...idea,
              content: domIdea.content,
              order: domIdea.order
            };
          }
          return idea;
        }).filter(idea => idsInDom.includes(idea.id));
        
        // Add any new ideas
        validDomIdeas.forEach(domIdea => {
          if (!updatedIdeas.some(idea => idea.id === domIdea.id)) {
            updatedIdeas.push({
              id: domIdea.id,
              content: domIdea.content,
              order: domIdea.order,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        });
        
        // Sort by order
        updatedIdeas.sort((a, b) => a.order - b.order);
        setIdeas(updatedIdeas);
      } catch (error) {
        console.error("Error syncing ideas with DOM:", error);
      } finally {
        isUpdatingRef.current = false;
      }
    }, 1000); // 1 second debounce
  }, [ideas]);

  // Handle input changes
  const handleChange = () => {
    if (!editorRef.current) return;
    
    // When a keystroke happens, ensure the current div is an idea-item
    ensureIdeaItemDivs();
    
    // Sync with Firebase
    syncIdeasWithDOM();
  };

  // Ensure all content is wrapped in idea-item divs
  const ensureIdeaItemDivs = () => {
    if (!editorRef.current) return;
    
    // Save selection
    const selection = window.getSelection();
    const savedRange = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    
    // Get all childNodes in the editor
    const childNodes = Array.from(editorRef.current.childNodes);
    
    let needsUpdate = false;
    
    // Check for text nodes or elements that aren't idea-items
    childNodes.forEach(node => {
      // If it's a text node with content or a non-idea-item element
      if ((node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') || 
          (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('idea-item'))) {
        // Create a new idea-item div
        const ideaDiv = document.createElement('div');
        ideaDiv.className = 'idea-item my-6 block';
        ideaDiv.setAttribute('data-idea-id', `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        
        // Replace the node with our new div containing the node
        if (node.nodeType === Node.TEXT_NODE) {
          ideaDiv.textContent = node.textContent;
        } else {
          ideaDiv.appendChild(node.cloneNode(true));
        }
        
        node.parentNode.replaceChild(ideaDiv, node);
        needsUpdate = true;
      }
    });
    
    // Restore selection if we made changes
    if (needsUpdate && savedRange) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      } catch (e) {
        console.log("Couldn't restore selection after ensuring idea divs");
      }
    }
  };

  // Listen for keydown events
  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default Enter behavior
      
      // Get current position
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      
      // Find the containing idea-item div
      let currentDiv = range.startContainer;
      while (currentDiv && (!currentDiv.classList || !currentDiv.classList.contains('idea-item'))) {
        currentDiv = currentDiv.parentNode;
      }
      
      if (!currentDiv) return; // Not inside an idea-item
      
      const currentIdeaId = currentDiv.getAttribute('data-idea-id');
      const currentIndex = Array.from(editorRef.current.querySelectorAll('.idea-item'))
        .findIndex(div => div.getAttribute('data-idea-id') === currentIdeaId);
      
      if (currentIndex === -1) return;
      
      // Create new idea in Firebase
      const newIdeaId = await createNewIdea('', currentIndex);
      
      if (!newIdeaId) return;
      
      // Create new div and insert it after the current one
      const newDiv = document.createElement('div');
      newDiv.className = 'idea-item my-6 block min-h-[2rem]';
      newDiv.setAttribute('data-idea-id', newIdeaId);
      newDiv.setAttribute('data-has-placeholder', 'true'); // Mark as having placeholder
      
      // Add a non-breaking space to ensure the div has content and height
      // This will be replaced when the user starts typing
      const textNode = document.createTextNode('\u00A0'); // Non-breaking space
      newDiv.appendChild(textNode);
      
      currentDiv.after(newDiv);
      
      // Move cursor to the beginning of the new div
      const newRange = document.createRange();
      newRange.setStart(newDiv.firstChild, 0);
      newRange.setEnd(newDiv.firstChild, 0);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      // Update the focused idea
      setFocusedIdeaId(newIdeaId);
    }
  };

  // Add a function to handle keypresses in paragraphs with placeholders
  const handleKeyPress = (e) => {
    if (!editorRef.current) return;
    
    // Find the active element or div containing cursor
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    let currentDiv = range.startContainer;
    while (currentDiv && (!currentDiv.classList || !currentDiv.classList.contains('idea-item'))) {
      if (!currentDiv.parentNode) break;
      currentDiv = currentDiv.parentNode;
    }
    
    // If we found a div with a placeholder, remove the placeholder before adding the character
    if (currentDiv && currentDiv.hasAttribute('data-has-placeholder')) {
      // Only do this for actual character keys, not control keys
      if (e.key.length === 1) {
        e.preventDefault(); // Prevent default character insertion
        
        // Clear the div's content (remove the nbsp)
        currentDiv.innerHTML = '';
        
        // Insert the pressed character
        const textNode = document.createTextNode(e.key);
        currentDiv.appendChild(textNode);
        
        // Move cursor to end of this character
        const newRange = document.createRange();
        newRange.setStart(currentDiv.firstChild, 1);
        newRange.setEnd(currentDiv.firstChild, 1);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        // Remove the placeholder marker
        currentDiv.removeAttribute('data-has-placeholder');
        
        // Trigger sync with Firebase
        syncIdeasWithDOM();
      }
    }
  };

  // Track focused idea for sidebar
  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Find the containing idea-item div
    let currentDiv = range.startContainer;
    while (currentDiv && (!currentDiv.classList || !currentDiv.classList.contains('idea-item'))) {
      if (!currentDiv.parentNode) break;
      currentDiv = currentDiv.parentNode;
    }
    
    if (currentDiv && currentDiv.classList && currentDiv.classList.contains('idea-item')) {
      const ideaId = currentDiv.getAttribute('data-idea-id');
      if (ideaId !== 'placeholder') {
        setFocusedIdeaId(ideaId);
      }
    } else {
      setFocusedIdeaId(null);
    }
  };

  // Set up selection change listener
  useEffect(() => {
    const handleGlobalSelectionChange = () => {
      handleSelectionChange();
    };
    
    document.addEventListener('selectionchange', handleGlobalSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleGlobalSelectionChange);
    };
  }, []);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Add global styles for idea-items
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .idea-item {
        min-height: 2rem;
        padding: 0.25rem 0;
      }
      .idea-item:empty::after {
        content: '\u00A0';
        opacity: 0;
      }
    `;
    document.head.appendChild(styleEl);
    
    if (editorRef.current.innerHTML === '') {
      editorRef.current.innerHTML = '<div class="idea-item my-6 block min-h-[2rem]" data-idea-id="placeholder">Start typing here...</div>';
      const placeholderDiv = editorRef.current.querySelector('[data-idea-id="placeholder"]');
      if (placeholderDiv) {
        placeholderDiv.classList.add('text-neutral-400');
      }
    }
    
    // Clean up styles on unmount
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // Get the focused idea object from ideas array
  const focusedIdea = ideas.find(idea => idea.id === focusedIdeaId);

  // Helper function to format dates from either Firestore Timestamp or JS Date
  const formatDate = (dateValue) => {
    if (!dateValue) return 'Unknown';
    
    // If it's a Firestore timestamp (has toDate method)
    if (typeof dateValue.toDate === 'function') {
      return dateValue.toDate().toLocaleString();
    }
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue.toLocaleString();
    }
    
    // Fall back to string representation
    return String(dateValue);
  };

  // Modify the sidebar display to not show the nbsp character
  // Helper function to format content for sidebar display
  const formatContentForSidebar = (content) => {
    // If it's just a non-breaking space, return empty string
    if (content === '\u00A0' || content === '&nbsp;') {
      return '';
    }
    
    // Otherwise, return the content as is
    return content;
  };

  return (
    <div className="h-screen py-4 bg-neutral-100 selection:bg-rose-500 selection:text-black caret-rose-500 font-pangram">
      {/* context utility */}
      <div className="fixed top-0 left-0 z-10 h-full w-[20%] min-w-[240px] flex flex-col gap-y-8 p-8">
        <div className="flex flex-col gap-1">
          <div className="uppercase text-xs font-medium text-neutral-400">View</div>
          <div className="">Sort by Time</div>
          <div className="">Column View</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="uppercase text-xs font-medium text-neutral-400">Filter by Tag</div>
          <div className="flex flex-col -mx-2">
            <div className="group flex items-center -mx-1 pl-2 pr-3 pb-[2px] hover:bg-black/10 rounded-full whitespace-nowrap select-none">
              <span className="group-hover:hidden material-symbols-outlined text-sm">tag</span>
              <span className="hidden group-hover:block hover:scale-125 material-symbols-outlined text-sm cursor-pointer">close</span>
              future
            </div>
            <div className="group flex items-center -mx-1 pl-2 pr-3 pb-[2px] hover:bg-black/10 rounded-full whitespace-nowrap select-none">
              <span className="group-hover:hidden material-symbols-outlined text-sm">tag</span>
              <span className="hidden group-hover:block hover:scale-125 material-symbols-outlined text-sm cursor-pointer">close</span>
              past
            </div>
            <div className="group flex items-center -mx-1 pl-2 pr-3 pb-[2px] hover:bg-black/10 rounded-full whitespace-nowrap select-none">
              <span className="group-hover:hidden material-symbols-outlined text-sm">tag</span>
              <span className="hidden group-hover:block hover:scale-125 material-symbols-outlined text-sm cursor-pointer">close</span>
              present
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="uppercase text-xs font-medium text-neutral-400">Tools</div>
          <div className="">3-Step</div>
          <div className="">Taxonomy</div>
          <div className="">Onym</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="uppercase text-xs font-medium text-neutral-400">Tips</div>
        </div>
      </div>

      <div className="relative h-full w-[60%] min-w-[500px] mx-auto">
        <div
          ref={editorRef}
          contentEditable
          spellCheck="false"
          className="h-full p-8 focus:outline-none text-center text-3xl font-regular rounded-2xl bg-white whitespace-pre-wrap overflow-auto"
          onInput={handleChange}
          onKeyDown={handleKeyDown}
          onKeyPress={handleKeyPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>

      {/* sidebar */}
      <div className="fixed top-0 right-0 z-10 h-full w-[20%] min-w-[240px] flex flex-col p-8 overflow-auto">
        {focusedIdea ? (
          <div className="flex flex-1 flex-col justify-between">
            <div className="flex flex-col gap-y-8">
              <div className="text-lg font-medium leading-tight">{formatContentForSidebar(focusedIdea.content)}</div>
              {/* notes */}
              <div className="flex flex-col gap-y-2">
                <div className="flex flex-row flex-wrap items-center -mx-2">
                  <div className="group flex items-center -mx-1 pl-2 pr-3 pb-[2px] hover:bg-black/10 rounded-full whitespace-nowrap select-none">
                    <span className="group-hover:hidden material-symbols-outlined text-sm">tag</span>
                    <span className="hidden group-hover:block hover:scale-125 material-symbols-outlined text-sm cursor-pointer">close</span>
                    future
                  </div>
                  <div className="group flex items-center -mx-1 pl-2 pr-3 pb-[2px] hover:bg-black/10 rounded-full whitespace-nowrap select-none">
                    <span className="group-hover:hidden material-symbols-outlined text-sm">tag</span>
                    <span className="hidden group-hover:block hover:scale-125 material-symbols-outlined text-sm cursor-pointer">close</span>
                    past
                  </div>
                  <div className="group flex items-center -mx-1 pl-2 pr-3 pb-[2px] hover:bg-black/10 rounded-full whitespace-nowrap select-none">
                    <span className="group-hover:hidden material-symbols-outlined text-sm">tag</span>
                    <span className="hidden group-hover:block hover:scale-125 material-symbols-outlined text-sm cursor-pointer">close</span>
                    present
                  </div>
                  <div className="w-fit flex justify-center items-center -mx-1 pl-2 pr-3 pb-[2px] text-neutral-400 hover:text-black hover:bg-black/10 rounded-full whitespace-nowrap cursor-pointer"><span className="material-symbols-outlined text-sm">add</span>Tag</div>
                </div>
              </div>
              {/* tags */}
              <div className="flex flex-col gap-y-4">
                <div className="leading-tight">In the summer of 1874, the Reverend Kingsley sojourned in nearby Manitou Springs for six weeks with Rose on her return visit, at the same time his brother, Dr. George Kingsley, M.D., was assisting the 4th Earl of Dunraven to create a ranch in Estes Park, Colorado, an adventure that would soon become dangerous when a Dunraven employee shot "Rocky Mountain Jim."</div>
                <div className="leading-tight">For the first time, the full story is told of the international investment intrigue behind the Kingsleys in Colorado.</div>
                <div className="w-fit flex justify-center items-center mt-2 -mx-3 pl-2 pr-3 pb-[2px] text-neutral-400 hover:text-black hover:bg-black/10 rounded-full whitespace-nowrap cursor-pointer"><span className="material-symbols-outlined text-sm">add</span>Note</div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-xs font-medium uppercase text-neutral-400">Created<br />{formatDate(focusedIdea.createdAt)}</div>
              <div className="text-xs font-medium uppercase text-neutral-400">Updated<br />{formatDate(focusedIdea.updatedAt)}</div>
            </div>
          </div>
        ) : (
          <div className="text-neutral-500">
            <div className="text-lg font-medium leading-tight">Select an idea</div>
            <div className="mt-4">Click on any paragraph to see and edit its details.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;