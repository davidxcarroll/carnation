import React, { useState, useRef, useEffect, useCallback } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where, limit, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import './index.css';

const App = () => {
  const [ideas, setIdeas] = useState([]);
  const [focusedIdeaId, setFocusedIdeaId] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [tags, setTags] = useState([]);
  const [tagInputVisible, setTagInputVisible] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');
  const [ideaTags, setIdeaTags] = useState([]);
  const [globalTagCounts, setGlobalTagCounts] = useState({});
  const [activeTab, setActiveTab] = useState('view');
  const [selectedTags, setSelectedTags] = useState({});
  const [selectionState, setSelectionState] = useState('none');
  const editorRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const updateTimeoutRef = useRef(null);
  const ideasRef = collection(db, 'ideas');
  const tagsRef = collection(db, 'tags');
  const ideaTagsRef = collection(db, 'ideaTags');

  // Load ideas from Firebase on startup
  useEffect(() => {
    try {
      const q = query(ideasRef, orderBy('order', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        // Skip if we're currently updating to avoid loops
        if (isUpdatingRef.current) return;

        try {
          const ideasData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          setIdeas(ideasData);

          // Only update the editor content on initial load
          if (isInitialLoad && editorRef.current && ideasData.length > 0) {
            // Build the HTML from the ideas
            const html = ideasData.map(idea =>
              `<div class="idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text" data-idea-id="${idea.id}">${idea.content || ''}</div>`
            ).join('');

            editorRef.current.innerHTML = html || '<div class="idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text" data-idea-id="placeholder">Type ideas, one per line</div>';
            setIsInitialLoad(false);
          }
        } catch (error) {
          console.error("Error processing ideas data:", error);
        }
      }, (error) => {
        // Handle Firebase onSnapshot error
        console.error("Firebase onSnapshot error:", error);
      });

      return () => {
        try {
          unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing from ideas snapshot:", error);
        }
      };
    } catch (error) {
      console.error("Error setting up ideas snapshot listener:", error);
    }
  }, [isInitialLoad]);

  // Load all tags from Firebase
  useEffect(() => {
    try {
      const q = query(tagsRef, orderBy('name', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        try {
          const tagsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setTags(tagsData);
        } catch (error) {
          console.error("Error processing tags data:", error);
        }
      }, (error) => {
        console.error("Firebase tags onSnapshot error:", error);
      });

      return () => {
        try {
          unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing from tags snapshot:", error);
        }
      };
    } catch (error) {
      console.error("Error setting up tags snapshot listener:", error);
    }
  }, []);

  // Load tags for the focused idea
  useEffect(() => {
    if (!focusedIdeaId) {
      setIdeaTags([]);
      return;
    }

    const q = query(ideaTagsRef, where('ideaId', '==', focusedIdeaId));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const ideaTagsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get the full tag objects for each tag ID
      const tagIds = ideaTagsData.map(ideaTag => ideaTag.tagId);

      if (tagIds.length > 0) {
        // Get all the tags that are associated with this idea
        const matchingTags = tags.filter(tag => tagIds.includes(tag.id));
        setIdeaTags(matchingTags);
      } else {
        setIdeaTags([]);
      }
    });

    return () => unsubscribe();
  }, [focusedIdeaId, tags]);

  // Load all idea-tag relationships from Firebase
  useEffect(() => {
    try {
      const unsubscribe = onSnapshot(ideaTagsRef, (snapshot) => {
        try {
          // Get all idea-tag relationships
          const relationships = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Count the number of unique ideas per tag
          const counts = {};
          relationships.forEach(rel => {
            if (!counts[rel.tagId]) {
              counts[rel.tagId] = new Set();
            }
            counts[rel.tagId].add(rel.ideaId);
          });
          
          // Convert sets to counts
          const tagCounts = {};
          Object.keys(counts).forEach(tagId => {
            tagCounts[tagId] = counts[tagId].size;
          });
          
          setGlobalTagCounts(tagCounts);
        } catch (error) {
          console.error("Error processing global tag counts:", error);
        }
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up global tag counts listener:", error);
    }
  }, []);

  // Handle editor focus
  const handleFocus = () => {
    if (!editorRef.current) return;

    // Clear placeholder text
    const placeholderDiv = editorRef.current.querySelector('[data-idea-id="placeholder"]');
    if (placeholderDiv && placeholderDiv.textContent === 'Type ideas, one per line') {
      // Replace placeholder with a real idea
      createNewIdea('');
    }
  };

  // Handle editor blur
  const handleBlur = () => {
    if (!editorRef.current) return;

    // If editor is empty, show placeholder
    if (editorRef.current.textContent.trim() === '') {
      editorRef.current.innerHTML = '<div class="idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text" data-idea-id="placeholder">Type ideas, one per line</div>';
      const placeholderDiv = editorRef.current.querySelector('[data-idea-id="placeholder"]');
      if (placeholderDiv) {
        placeholderDiv.classList.add('text-4hite/50');
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

  // Create a new tag
  const createTag = async (name) => {
    try {
      // Check if tag already exists
      const tagExists = tags.some(tag => tag.name.toLowerCase() === name.toLowerCase());
      if (tagExists) return null;

      // Create new tag in Firebase
      const newTagRef = await addDoc(tagsRef, {
        name,
        createdAt: new Date()
      });

      return newTagRef.id;
    } catch (error) {
      console.error("Error creating new tag:", error);
      return null;
    }
  };

  // Add tag to idea
  const addTagToIdea = async (tagId, ideaId) => {
    if (!tagId || !ideaId) {
      console.error("Missing tagId or ideaId in addTagToIdea");
      return;
    }

    try {
      // Check if relationship already exists
      const q = query(
        ideaTagsRef,
        where('tagId', '==', tagId),
        where('ideaId', '==', ideaId)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        return; // Relationship already exists
      }

      // Create relationship
      await addDoc(ideaTagsRef, {
        tagId,
        ideaId,
        createdAt: new Date()
      });
    } catch (error) {
      console.error("Error adding tag to idea:", error);
    }
  };

  // Remove tag from idea
  const removeTagFromIdea = async (tagId, ideaId) => {
    try {
      // Find the relationship document
      const q = query(
        ideaTagsRef,
        where('tagId', '==', tagId),
        where('ideaId', '==', ideaId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return; // Relationship doesn't exist
      }

      // Delete all matching relationships
      const deletePromises = querySnapshot.docs.map(doc =>
        deleteDoc(doc.ref)
      );

      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error removing tag from idea:", error);
    }
  };

  // Handle adding a new tag or existing tag to an idea
  const handleAddTag = async (tagName) => {
    if (!focusedIdeaId || !tagName.trim()) return;

    try {
      // Check if tag already exists
      const existingTag = tags.find(tag => tag.name.toLowerCase() === tagName.toLowerCase());
      let tagId;

      if (existingTag) {
        tagId = existingTag.id;
      } else {
        tagId = await createTag(tagName);
        if (!tagId) return;
      }

      // Add tag to idea
      await addTagToIdea(tagId, focusedIdeaId);

      // Clear input and hide the tag input component
      setTagInputValue('');
      setTagInputVisible(false);
    } catch (error) {
      console.error("Error in handleAddTag:", error);
      // Don't hide the input on error so user can try again
    }
  };

  // Handle removing a tag from an idea
  const handleRemoveTag = async (tagId) => {
    if (!focusedIdeaId) return;
    await removeTagFromIdea(tagId, focusedIdeaId);
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

        // Safety check: If there are no idea divs but we have ideas in state, 
        // don't proceed with the sync as this could delete all ideas
        if (ideaDivs.length === 0 && ideas.length > 0) {
          console.warn("No idea divs found in the DOM but ideas exist in state. Skipping sync to prevent data loss.");
          isUpdatingRef.current = false;
          return;
        }

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

        // Another safety check: If we suddenly have no valid ideas but had some before,
        // this is likely an error condition, so abort
        if (validDomIdeas.length === 0 && ideas.length > 0) {
          console.warn("No valid ideas found in DOM but ideas exist in state. Skipping sync to prevent data loss.");
          isUpdatingRef.current = false;
          return;
        }

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

        // Only delete ideas if we have a reasonable number of ideas in the DOM
        // This prevents mass deletion when DOM parsing fails
        if (idsInDom.length >= ideas.length / 2 || idsInDom.length >= 5) {
          const deletedIdeas = ideas.filter(idea => !idsInDom.includes(idea.id));

          const deletePromises = deletedIdeas.map(idea =>
            deleteDoc(doc(db, 'ideas', idea.id))
          );

          await Promise.all([...updatePromises, ...deletePromises]);
        } else {
          // Only apply updates, skip deletions as a safety measure
          console.warn("Too few ideas in DOM compared to state. Skipping deletions to prevent data loss.");
          await Promise.all(updatePromises);
        }

        // Only update local state if we have a valid DOM representation
        if (validDomIdeas.length > 0) {
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
          });

          // Only filter out ideas not in DOM if we have enough ideas in DOM
          const filteredIdeas = idsInDom.length >= ideas.length / 2 || idsInDom.length >= 5
            ? updatedIdeas.filter(idea => idsInDom.includes(idea.id))
            : updatedIdeas;

          // Add any new ideas
          validDomIdeas.forEach(domIdea => {
            if (!filteredIdeas.some(idea => idea.id === domIdea.id)) {
              filteredIdeas.push({
                id: domIdea.id,
                content: domIdea.content,
                order: domIdea.order,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          });

          // Sort by order
          filteredIdeas.sort((a, b) => a.order - b.order);
          setIdeas(filteredIdeas);
        }
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

  // Handle tag input change
  const handleTagInputChange = (e) => {
    // Prevent event propagation to avoid triggering syncIdeasWithDOM
    e.stopPropagation();
    setTagInputValue(e.target.value);
  };

  // Get filtered tags based on input
  const getFilteredTags = () => {
    // Only show tags if user has typed something
    if (!tagInputValue.trim()) return [];

    // Filter tags that contain the exact sequence of characters
    return tags.filter(tag =>
      tag.name.toLowerCase().includes(tagInputValue.trim().toLowerCase())
    );
  };

  // Check if the exact tag already exists
  const exactTagExists = () => {
    return tags.some(tag =>
      tag.name.toLowerCase() === tagInputValue.toLowerCase()
    );
  };

  // Check if a tag is applied to the focused idea
  const isTagApplied = (tagId) => {
    return ideaTags.some(tag => tag.id === tagId);
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
        ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
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
      newDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
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

  // Handle tag input keydown for submission
  const handleTagInputKeyDown = (e) => {
    // Prevent event propagation to avoid triggering syncIdeasWithDOM
    e.stopPropagation();

    if (e.key === 'Enter' && tagInputValue.trim()) {
      e.preventDefault();
      handleAddTag(tagInputValue.trim());
    } else if (e.key === 'Escape') {
      setTagInputVisible(false);
      setTagInputValue('');
    }
  };

  // Track focused idea for sidebar
  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    // Check if the selection is inside the sidebar or any of its children
    const sidebarElement = document.querySelector('.idea-sidebar');
    if (sidebarElement) {
      // Check if the clicked element is the sidebar or a descendant of it
      let currentNode = range.startContainer;
      while (currentNode) {
        if (currentNode === sidebarElement || currentNode.classList?.contains('idea-sidebar')) {
          return;
        }
        currentNode = currentNode.parentNode;
      }
    }

    // Find the containing idea-item div
    let currentDiv = range.startContainer;
    while (currentDiv && (!currentDiv.classList || !currentDiv.classList.contains('idea-item'))) {
      if (!currentDiv.parentNode) break;
      currentDiv = currentDiv.parentNode;
    }

    // Reset all ideas to text-white/60 and remove focus styling
    if (editorRef.current) {
      const allIdeas = editorRef.current.querySelectorAll('.idea-item');
      allIdeas.forEach(idea => {
        idea.classList.remove('text-white');
        idea.classList.add('text-white/60');
        idea.classList.remove('idea-item-focused');
      });
    }

    if (currentDiv && currentDiv.classList && currentDiv.classList.contains('idea-item')) {
      const ideaId = currentDiv.getAttribute('data-idea-id');
      if (ideaId !== 'placeholder') {
        // Make focused idea text-white and add focus styling
        currentDiv.classList.remove('text-white/60');
        currentDiv.classList.add('text-white');
        currentDiv.classList.add('idea-item-focused');
        setFocusedIdeaId(ideaId);
      }
    } else {
      // We don't want to clear the focused idea if the click was outside the editor
      // This keeps the sidebar open when clicking within it
      if (range.startContainer.nodeType === Node.TEXT_NODE ||
        (range.startContainer.nodeType === Node.ELEMENT_NODE &&
          editorRef.current && editorRef.current.contains(range.startContainer))) {
        setFocusedIdeaId(null);
      }
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

  // Clear idea focus when sidebar is closed
  useEffect(() => {
    if (!focusedIdeaId && editorRef.current) {
      // Remove focus styling from all idea-items
      const allIdeas = editorRef.current.querySelectorAll('.idea-item');
      allIdeas.forEach(idea => {
        idea.classList.remove('idea-item-focused');
      });
    }
  }, [focusedIdeaId]);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;

    // Add global styles for idea-items
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .idea-item {
      }
      .idea-item:empty::after {
        content: '\u00A0';
        opacity: 0;
      }
      .idea-item-focused, .idea-item-focused:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }
    `;
    document.head.appendChild(styleEl);

    if (editorRef.current.innerHTML === '') {
      editorRef.current.innerHTML = '<div class="idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text" data-idea-id="placeholder">Type ideas, one per line</div>';
      const placeholderDiv = editorRef.current.querySelector('[data-idea-id="placeholder"]');
      if (placeholderDiv) {
        placeholderDiv.classList.add('text-4hite/50');
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

  // Filter tags based on current input
  const filteredTags = getFilteredTags();
  const showAddNewButton = tagInputValue.trim() !== '' && !exactTagExists();

  // Add a modification to the tag sidebar to ensure it doesn't trigger DOM sync
  const handleTagClick = (e) => {
    // Prevent event propagation to avoid triggering syncIdeasWithDOM
    e.stopPropagation();
  };

  // Handle tab click to toggle utility sidebar
  const handleTabClick = (tabName) => {
    // If clicking the active tab, close it; otherwise, open the clicked tab
    setActiveTab(activeTab === tabName ? null : tabName);
  };

  // Toggle tag selection state
  const toggleTagSelection = (tagId) => {
    setSelectedTags(prev => {
      const newSelectedTags = { ...prev, [tagId]: !prev[tagId] };
      
      // Update the selection state (all, none, or indeterminate)
      updateSelectionState(newSelectedTags);
      
      return newSelectedTags;
    });
  };
  
  // Toggle all tags selection state
  const toggleAllTags = () => {
    // Cycle through states: none -> all -> none
    if (selectionState === 'all') {
      // If all are selected, deselect all
      const newSelectedTags = {};
      tags.forEach(tag => {
        newSelectedTags[tag.id] = false;
      });
      setSelectedTags(newSelectedTags);
      setSelectionState('none');
    } else {
      // If none or some are selected, select all
      const newSelectedTags = {};
      tags.forEach(tag => {
        newSelectedTags[tag.id] = true;
      });
      setSelectedTags(newSelectedTags);
      setSelectionState('all');
    }
  };
  
  // Update the overall selection state based on individual selections
  const updateSelectionState = (selectedTagsObj) => {
    if (!tags.length) return;
    
    const selectedCount = Object.values(selectedTagsObj).filter(Boolean).length;
    
    if (selectedCount === 0) {
      setSelectionState('none');
    } else if (selectedCount === tags.length) {
      setSelectionState('all');
    } else {
      setSelectionState('indeterminate');
    }
  };
  
  // Update selection state when tags change
  useEffect(() => {
    updateSelectionState(selectedTags);
  }, [tags]);

  return (
    <div className="h-screen flex flex-row justify-start text-white/80 text-sm bg-neutral-900 selection:bg-rose-500 selection:text-white selection:text-white caret-rose-500 font-pressura font-normal">
      <div className="h-full flex flex-1 flex-col px-2 shadow-[1px_0_0_rgba(255,255,255,0.05)]">
        
        {/* Utility sidebar tabs */}
        {/* tab: view */}
        <div 
          className={`w-10 h-12 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'view' ? 'bg-white/[5%]' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
          onClick={() => handleTabClick('view')}
        >
          <span className={`material-symbols-rounded text-base ${activeTab === 'view' ? 'text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>sort</span>
        </div>
        {/* tab: tools */}
        <div 
          className={`group w-10 h-12 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'tools' ? 'bg-white/[5%]' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
          onClick={() => handleTabClick('tools')}
        >
          <span className={`material-symbols-rounded text-base ${activeTab === 'tools' ? 'text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>widgets</span>
        </div>
        {/* tab: tips */}
        <div 
          className={`group w-10 h-12 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'tips' ? 'bg-white/[5%]' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
          onClick={() => handleTabClick('tips')}
        >
          <span className={`material-symbols-rounded text-base ${activeTab === 'tips' ? 'text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>info</span>
        </div>
        
      </div>

      {/* Utility sidebar - only show when a tab is active */}
      {activeTab && (
        <div className="h-full min-w-[340px] max-w-[400px] flex flex-col pl-8 pr-10 overflow-auto idea-sidebar shadow-[1px_0_0_rgba(255,255,255,0.05)]">
        
          {activeTab === 'view' && (
            <>
              <div 
                className="w-fit flex flex-row items-center gap-1 -mx-3 gap-1 py-4 mt-1 px-3 text-white rounded-lg cursor-pointer select-none"
                onClick={toggleAllTags}
              >
                <span className="material-symbols-rounded text-base">
                  {selectionState === 'all' ? 'check_box' : 
                   selectionState === 'indeterminate' ? 'indeterminate_check_box' : 
                   'check_box_outline_blank'}
                </span>
                Tags
              </div>

              <hr className="w-[calc(100%+22px)] -mx-3 mb-2 border-[rgba(255,255,255,0.05)]" />

              {/* show a list of tags */}
              {(tags.length > 0 ? tags : [
                { id: 'placeholder-1', name: 'history' },
                { id: 'placeholder-2', name: 'science fiction' },
                { id: 'placeholder-3', name: 'art' }
              ]).map(tag => {
                // Get the global count for this tag
                const tagCount = tags.length === 0 ? 
                  (tag.id === 'placeholder-1' ? 21 : tag.id === 'placeholder-2' ? 15 : 9) : 
                  globalTagCounts[tag.id] || 0;
                
                return (
                  <div 
                    key={tag.id}
                    className="flex flex-row items-center gap-1 -mx-3 pt-1 pb-2 px-3 text-white leading-tight hover:bg-white/[2%] rounded-lg cursor-pointer"
                    onClick={() => toggleTagSelection(tag.id)}
                  >
                    <span className={`material-symbols-rounded text-base ${!selectedTags[tag.id] ? 'opacity-10' : ''}`}>
                      {selectedTags[tag.id] ? 'check' : 'check_box_outline_blank'}
                    </span>
                    <span className={`w-full ${!selectedTags[tag.id] ? 'opacity-40' : ''}`}>{tag.name}</span>
                    <span className="ml-1 opacity-40">{tagCount}</span>
                  </div>
                );
              })}
              
              {/* Remove the empty tags placeholder since we now have development placeholders */}
              {/* {tags.length === 0 && (
                <div className="flex flex-row items-center gap-1 -mx-3 pt-1 pb-2 px-3 text-white/40 leading-tight">
                  No tags yet
                </div>
              )} */}
            </>
          )}
          
          {activeTab === 'tools' && (
            <div className="w-fit flex flex-row items-center gap-1 -mx-3 gap-1 py-4 mt-1 px-3 text-white">
              <span className="material-symbols-rounded text-base">widgets</span>
              Tools
            </div>
          )}
          
          {activeTab === 'tips' && (
            <div className="w-fit flex flex-row items-center gap-1 -mx-3 gap-1 py-4 mt-1 px-3 text-white">
              <span className="material-symbols-rounded text-base">info</span>
              Tips
            </div>
          )}
        </div>
      )}

      {/* ideas */}
      <div className="w-full flex flex-row gap-3 p-3 pt-0 overflow-auto">

        {/* Idea column */}
        <div className="relative min-w-[400px] flex flex-1 flex-col">
          <div className="min-h-14 flex justify-center items-center p-4">
            <div className="flex items-center -mx-1 pb-1 pl-2 pr-3 whitespace-nowrap select-none">
              <span className="material-symbols-rounded text-base">tag</span>
              untagged
            </div>
          </div>
          <div
            ref={editorRef}
            contentEditable
            spellCheck="false"
            className="h-full p-4 focus:outline-none text-center leading-tight font-normal rounded-2xl shadow-[inset_0_0_1px_rgba(255,255,255,0.25)] whitespace-pre-wrap overflow-auto cursor-default select-none"
            onInput={handleChange}
            onKeyDown={handleKeyDown}
            onKeyPress={handleKeyPress}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        {/* Idea column - placeholder */}
        <div className="relative min-w-[400px] flex flex-1 flex-col">
          <div className="min-h-14 flex justify-center items-center p-4">
            <div className="flex items-center -mx-1 pb-1 pl-2 pr-3 whitespace-nowrap select-none">
              <span className="material-symbols-rounded text-base">tag</span>
              Future
            </div>
          </div>
          <div className="h-full p-4 focus:outline-none text-center leading-tight font-normal rounded-2xl shadow-[inset_0_0_1px_rgba(255,255,255,0.25)] whitespace-pre-wrap overflow-auto cursor-default select-none" />
        </div>

        {/* New tag column */}
        <div className="relative min-w-[400px] flex flex-1 flex-col">
          <div className="min-h-14 flex justify-center items-center p-4">
            <div className="flex items-center -mx-1 pb-1 pl-2 pr-3 text-white/40 hover:bg-white/5 hover:text-white rounded-full whitespace-nowrap select-none cursor-pointer">
              <span className="material-symbols-rounded text-base">add</span>
              New tag
            </div>
          </div>
          <div className="h-full p-4 focus:outline-none text-center leading-tight font-normal rounded-2xl border border-dashed border-white/[5%] whitespace-pre-wrap overflow-auto cursor-default select-none" />
        </div>

      </div>

      {/* Context sidebar */}
      {focusedIdea ? (
        <div
          className="h-full min-w-[400px] flex flex-1 flex-col px-8 overflow-auto idea-sidebar shadow-[-1px_0_0_rgba(255,255,255,0.05)]"
          onMouseDown={(e) => {
            // Prevent the mousedown from triggering a selection change
            // This is critical since selection changes can cause the sidebar to close
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="flex flex-1 flex-col justify-between">
            <div className="flex flex-1 flex-col">

              <div className="min-h-14 flex flex-row justify-between items-center gap-4 py-4 sticky top-0 z-10 bg-neutral-900 shadow-[0_1px_0_rgba(255,255,255,0.05),16px_0_0_rgba(23,23,23,1),-16px_0_0_rgba(23,23,23,1)]">
                <div className="flex flex-1 items-center leading-tight">
                  {formatContentForSidebar(focusedIdea.content)}
                </div>
                <span
                  className="material-symbols-rounded text-base cursor-pointer text-white/40 hover:text-white hover:scale-125 duration-100 ease-in-out"
                  onMouseDown={(e) => {
                    // Stop propagation to prevent the parent handler from blocking this click
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setFocusedIdeaId(null);
                  }}
                >
                  dock_to_left
                </span>
              </div>

              {/* Tags section */}
              <div
                className="flex flex-col justify-center py-4"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <div className="flex flex-row flex-wrap items-center -mx-2">
                  {/* Display tags for this idea */}
                  {ideaTags.map(tag => (
                    <div key={tag.id} className="group flex items-center -mx-1 pb-1 pl-2 pr-3 hover:bg-white/5 rounded-full whitespace-nowrap select-none">
                      <span className="group-hover:hidden material-symbols-rounded text-base">tag</span>
                      <span
                        className="hidden group-hover:block hover:scale-125 duration-100 ease-in-out material-symbols-rounded text-base cursor-pointer"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTag(tag.id);
                        }}
                      >
                        close
                      </span>
                      {tag.name}
                    </div>
                  ))}

                  {/* Add new tag button */}
                  <div
                    className="w-fit flex justify-center items-center -mx-1 pl-2 pr-3 text-white/40 hover:text-white hover:bg-white/5 rounded-full whitespace-nowrap cursor-pointer"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setTagInputVisible(!tagInputVisible);
                      setTagInputValue('');
                    }}
                  >
                    <span className="material-symbols-rounded text-base">add</span>
                    Tag
                  </div>
                </div>

                {/* Add new tag input */}
                {tagInputVisible && (
                  <div
                    className="flex flex-col -mx-3 mt-2 text-white bg-white/[2%] whitespace-nowrap rounded-lg overflow-clip"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    {/* Input field */}
                    <div
                      className="h-10 flex items-center gap-2 px-3 bg-white/[5%] rounded-lg"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <input
                        type="text"
                        value={tagInputValue}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleTagInputChange(e);
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          handleTagInputKeyDown(e);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          // Don't prevent default here to allow text selection in the input
                        }}
                        autoFocus
                        className="w-full bg-transparent border-none outline-none placeholder:text-white/40"
                      />
                      <span
                        className="material-symbols-rounded text-base cursor-pointer text-white/40 hover:scale-125 duration-100 ease-in-out hover:text-white"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                      >tune</span>
                      <span
                        className="material-symbols-rounded text-base cursor-pointer text-white/40 hover:scale-125 duration-100 ease-in-out hover:text-white"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setTagInputVisible(false);
                          setTagInputValue('');
                        }}
                      >cancel</span>
                    </div>

                    {/* Matching tags list */}
                    {filteredTags.map(tag => {
                      const isApplied = isTagApplied(tag.id);
                      return (
                        <div
                          key={tag.id}
                          className={`group h-11 flex items-center px-3 ${isApplied ? 'text-white/40' : ''} whitespace-nowrap select-none ${!isApplied ? 'hover:bg-white/[2%] cursor-pointer' : ''}`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (!isApplied) {
                              addTagToIdea(tag.id, focusedIdeaId);
                              setTagInputVisible(false);
                              setTagInputValue('');
                            }
                          }}
                        >
                          <span className="material-symbols-rounded text-base">tag</span>
                          <span className="w-full">{tag.name}</span>
                          {isApplied ? (
                            <span
                              className="material-symbols-rounded text-base hidden group-hover:block cursor-pointer hover:text-white"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleRemoveTag(tag.id);
                              }}
                            >
                              remove
                            </span>
                          ) : (
                            <span className="material-symbols-rounded text-base hidden group-hover:block">add</span>
                          )}
                        </div>
                      );
                    })}

                    {filteredTags.length > 0 && showAddNewButton && <hr className="border-[rgba(255,255,255,0.05)]" />}

                    {/* Add new tag button */}
                    {showAddNewButton && (
                      <div
                        className="h-11 flex items-center justify-between px-3 pb-1 whitespace-nowrap select-none hover:bg-white/[2%] cursor-pointer"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleAddTag(tagInputValue.trim());
                        }}
                      >
                        <span className="">Add "{tagInputValue.trim()}"</span>
                        <span className="material-symbols-rounded text-base">check</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <hr className="border-[rgba(255,255,255,0.05)]" />

              {/* Notes */}
              <div className="flex flex-col justify-center gap-y-2 py-4">
                {/* <div className="">In the summer of 1874, the Reverend Kingsley sojourned in nearby Manitou Springs for six weeks with Rose on her return visit, at the same time his brother, Dr. George Kingsley, M.D., was assisting the 4th Earl of Dunraven to create a ranch in Estes Park, Colorado, an adventure that would soon become dangerous when a Dunraven employee shot "Rocky Mountain Jim."</div> */}
                {/* <div className="">For the first time, the full story is told of the international investment intrigue behind the Kingsleys in Colorado.</div> */}
                <div className="w-fit flex justify-center items-center mt-2 -mx-3 select-none pl-2 pr-3 text-white/40 hover:text-white hover:bg-white/[2%] rounded-full whitespace-nowrap cursor-pointer"><span className="material-symbols-rounded text-base">add</span>Note</div>
              </div>

            </div>

            <hr className="border-[rgba(255,255,255,0.05)]" />


            {/* Meta */}
            <div className="min-h-14 flex flex-col justify-center gap-y-2 pt-4 pb-8">
              <div className="text-xs text-white/40">Created {formatDate(focusedIdea.createdAt)}</div>
              <div className="text-xs text-white/40">Updated {formatDate(focusedIdea.updatedAt)}</div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};

export default App;