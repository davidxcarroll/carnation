import React, { useState, useRef, useEffect, useCallback } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where, limit, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import './index.css';
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  serverTimestamp
} from "firebase/firestore";

const App = () => {
  const [ideas, setIdeas] = useState([]);
  const [focusedIdeaId, setFocusedIdeaId] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [tags, setTags] = useState([]);
  const [tagInputVisible, setTagInputVisible] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');
  const [ideaTags, setIdeaTags] = useState([]);
  const [globalTagCounts, setGlobalTagCounts] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [selectedTags, setSelectedTags] = useState({});
  const [selectionState, setSelectionState] = useState('none');
  const [newTagInputVisible, setNewTagInputVisible] = useState(false);
  const [newTagInputValue, setNewTagInputValue] = useState('');
  const [tagIdeasMap, setTagIdeasMap] = useState({});
  const [untaggedIdeas, setUntaggedIdeas] = useState([]);
  // Notes states
  const [noteInputVisible, setNoteInputVisible] = useState(false);
  const [noteInputValue, setNoteInputValue] = useState('');
  const [ideaNotes, setIdeaNotes] = useState([]);
  // View layout state
  const [viewLayout, setViewLayout] = useState('horizontal');

  const editorRef = useRef(null);
  const columnRefs = useRef({});
  const isUpdatingRef = useRef(false);
  const updateTimeoutRef = useRef(null);
  const newTagInputRef = useRef(null);
  const noteInputRef = useRef(null);
  const ideasRef = collection(db, 'ideas');
  const tagsRef = collection(db, 'tags');
  const ideaTagsRef = collection(db, 'ideaTags');
  const notesRef = collection(db, 'notes');

  // Get ideas for a specific tag - moved to top to avoid "Cannot access before initialization" error
  const getIdeasByTag = (tagId) => {
    const ideaIds = tagIdeasMap[tagId] || [];
    return ideas.filter(idea => ideaIds.includes(idea.id))
      .sort((a, b) => a.order - b.order);
  };

  // Get tags that have ideas
  const getTagsWithIdeas = () => {
    return tags.filter(tag => globalTagCounts[tag.id] && globalTagCounts[tag.id] > 0);
  };

  // Initialize column refs
  useEffect(() => {
    // Make sure untagged column always has a reference
    columnRefs.current.untagged = columnRefs.current.untagged || React.createRef();

    // Make sure each tag has a reference
    tags.forEach(tag => {
      columnRefs.current[tag.id] = columnRefs.current[tag.id] || React.createRef();
    });
  }, [tags]);

  // Load ideas from Firebase on startup - modified to handle multiple columns
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

          // Only update state if we're not in the middle of creating a new idea
          if (!isUpdatingRef.current) {
            setIdeas(ideasData);
          }

          // Only update the editor content on initial load
          if (isInitialLoad) {
            setIsInitialLoad(false);
            cleanupEmptyIdeas(ideasData);
          }
        } catch (error) {
          console.error("Error processing ideas data:", error);
        }
      }, (error) => {
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
      const q = query(tagsRef, orderBy('createdAt', 'asc')); // Sort by creation time
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

  // Load all idea-tag relationships and organize by tag
  useEffect(() => {
    try {
      const unsubscribe = onSnapshot(ideaTagsRef, (snapshot) => {
        try {
          // Get all idea-tag relationships
          const relationships = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Group ideas by tag ID
          const tagToIdeas = {};
          relationships.forEach(rel => {
            if (!tagToIdeas[rel.tagId]) {
              tagToIdeas[rel.tagId] = [];
            }
            if (!tagToIdeas[rel.tagId].includes(rel.ideaId)) {
              tagToIdeas[rel.tagId].push(rel.ideaId);
            }
          });

          setTagIdeasMap(tagToIdeas);

          // Count the number of unique ideas per tag
          const tagCounts = {};
          Object.keys(tagToIdeas).forEach(tagId => {
            // Only count actual ideas, not placeholders
            const ideaIds = tagToIdeas[tagId];
            const actualIdeas = ideaIds.filter(ideaId => {
              // Filter out any placeholder or non-existent ideas
              return ideas.some(idea => idea.id === ideaId);
            });
            tagCounts[tagId] = actualIdeas.length;
          });

          setGlobalTagCounts(tagCounts);

          // Find ideas with no tags
          const taggedIdeaIds = new Set(relationships.map(rel => rel.ideaId));
          const untagged = ideas.filter(idea => !taggedIdeaIds.has(idea.id));
          setUntaggedIdeas(untagged);

          // Force initialize untagged column to ensure it reflects the current state
          initializeColumnContent('untagged', untagged);
        } catch (error) {
          console.error("Error processing tag-idea relationships:", error);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up tag-idea relationships listener:", error);
    }
  }, [ideas, tags]);

  // Initialize column content after ideas and tags are loaded
  useEffect(() => {
    if (ideas.length === 0 || isInitialLoad) return;

    // Initialize editor content for each column
    initializeColumnContent('untagged', untaggedIdeas);

    tags.forEach(tag => {
      const taggedIdeas = getIdeasByTag(tag.id);
      initializeColumnContent(tag.id, taggedIdeas);
    });
  }, [ideas, tags, untaggedIdeas, tagIdeasMap, isInitialLoad]);

  // Initialize editor styles
  useEffect(() => {
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

    // Clean up styles on unmount
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // Handle column focus for any column
  const handleFocus = (columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;

    // Clear placeholder text
    const placeholderDiv = columnRef.current.querySelector('[data-idea-id="placeholder"]');
    if (placeholderDiv && placeholderDiv.textContent === 'Add ideas') {
      // Replace placeholder with an empty idea div
      const newDiv = document.createElement('div');
      newDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';

      // Generate a temporary ID that will be replaced when synced
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      newDiv.setAttribute('data-idea-id', tempId);
      newDiv.setAttribute('data-has-placeholder', 'true');

      // Add a non-breaking space to ensure the div has content and height
      const textNode = document.createTextNode('\u00A0'); // Non-breaking space
      newDiv.appendChild(textNode);

      // Replace the placeholder with our new div
      placeholderDiv.parentNode.replaceChild(newDiv, placeholderDiv);

      // Focus the new div and set cursor at the beginning
      newDiv.focus();

      // Set the cursor position to beginning
      const selection = window.getSelection();
      selection.removeAllRanges();
      const range = document.createRange();
      range.setStart(newDiv.firstChild, 0);
      range.setEnd(newDiv.firstChild, 0);
      selection.addRange(range);
    }
  };

  // Set cursor at the end of text in a div
  const setCursorAtEnd = (element) => {
    if (!element) return;

    // Check if element is a valid node
    if (!element.nodeType) return;

    // Try to place cursor at the end of the element
    const range = document.createRange();
    const selection = window.getSelection();

    // Find the last text node if it exists
    let lastTextNode = null;

    if (element.nodeType === Node.TEXT_NODE) {
      lastTextNode = element;
    } else if (element.lastChild) {
      // If it's an element node with children, find the last text node
      const findLastTextNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node;
        if (node.lastChild) return findLastTextNode(node.lastChild);
        return null;
      };
      lastTextNode = findLastTextNode(element);
    }

    if (lastTextNode && lastTextNode.nodeType === Node.TEXT_NODE) {
      // If we found a text node, set the cursor to the end of its content
      range.setStart(lastTextNode, lastTextNode.textContent.length);
      range.setEnd(lastTextNode, lastTextNode.textContent.length);
    } else {
      // Otherwise, just put the cursor at the end of the element
      range.selectNodeContents(element);
      range.collapse(false); // Collapse to end
    }

    selection.removeAllRanges();
    selection.addRange(range);
  };

  // Handle column blur - modified to prevent unwanted sync
  const handleBlur = (columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;

    // If editor is empty, show placeholder
    if (columnRef.current.textContent.trim() === '') {
      // Clear any existing content
      columnRef.current.innerHTML = '';

      // Add placeholder as a DOM element with forced text-white/30 style
      const placeholderDiv = document.createElement('div');
      placeholderDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 hover:bg-white/[2%] rounded-lg cursor-text';
      placeholderDiv.style.color = 'rgba(255, 255, 255, 0.3)'; // Force color with inline style
      placeholderDiv.setAttribute('data-idea-id', 'placeholder');
      placeholderDiv.textContent = 'Add ideas';
      columnRef.current.appendChild(placeholderDiv);
    }

    // Don't sync on blur to avoid cursor issues
  };

  // Create a new idea in Firebase
  const createNewIdea = async (content, tagId = null, insertAfterIndex = -1) => {
    try {
      // If insertAfterIndex is negative, just use the length of the relevant ideas array
      const relevantIdeas = tagId
        ? getIdeasByTag(tagId)
        : untaggedIdeas;

      if (insertAfterIndex < 0) {
        insertAfterIndex = relevantIdeas.length - 1;
      }

      // Calculate new order based on surrounding ideas
      const newOrder = insertAfterIndex >= 0 && relevantIdeas.length > 0
        ? relevantIdeas[insertAfterIndex].order + 0.5
        : ideas.length > 0 ? Math.max(...ideas.map(i => i.order)) + 1 : 0;

      // Create new idea in Firebase
      const newIdeaRef = await addDoc(ideasRef, {
        content: content || '',
        order: newOrder,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create the new idea object
      const newIdea = {
        id: newIdeaRef.id,
        content: content || '',
        order: newOrder,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Update local ideas state immediately
      setIdeas(prevIdeas => {
        return [...prevIdeas, newIdea];
      });

      // If this idea is being created in a tag column, tag it immediately
      if (tagId) {
        await addTagToIdea(tagId, newIdeaRef.id);
      }

      return newIdeaRef.id;
    } catch (error) {
      console.error("Error creating new idea:", error);
      return null;
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
        createdAt: new Date() // Ensure createdAt is set for sorting
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

      // Update tag columns immediately for better UX
      const taggedIdeas = getIdeasByTag(tagId);
      const idea = ideas.find(i => i.id === ideaId);

      if (idea && !taggedIdeas.some(i => i.id === ideaId)) {
        // Update the tag's column to include the new idea
        const columnRef = columnRefs.current[tagId];
        if (columnRef && columnRef.current) {
          const placeholder = columnRef.current.querySelector('[data-idea-id="placeholder"]');

          if (placeholder) {
            // Replace placeholder with the idea
            const ideaDiv = document.createElement('div');
            ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
            ideaDiv.setAttribute('data-idea-id', ideaId);
            ideaDiv.innerHTML = idea.content || '';
            placeholder.parentNode.replaceChild(ideaDiv, placeholder);
          } else {
            // Append the idea to the column
            const ideaDiv = document.createElement('div');
            ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
            ideaDiv.setAttribute('data-idea-id', ideaId);
            ideaDiv.innerHTML = idea.content || '';
            columnRef.current.appendChild(ideaDiv);
          }
        }
      }
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

      // Update tag column immediately for better UX
      const columnRef = columnRefs.current[tagId];
      if (columnRef && columnRef.current) {
        // Find and remove the idea div from this column
        const ideaDiv = columnRef.current.querySelector(`[data-idea-id="${ideaId}"]`);
        if (ideaDiv) {
          ideaDiv.remove();

          // If no ideas left, add placeholder
          if (columnRef.current.querySelectorAll('.idea-item').length === 0) {
            const placeholderDiv = document.createElement('div');
            placeholderDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 hover:bg-white/[2%] rounded-lg cursor-text';
            placeholderDiv.style.color = 'rgba(255, 255, 255, 0.3)'; // Force color with inline style
            placeholderDiv.setAttribute('data-idea-id', 'placeholder');
            placeholderDiv.textContent = 'Add ideas';
            columnRef.current.appendChild(placeholderDiv);
          }
        }
      }

      // Check if this was the last tag for this idea
      const allTagsForIdeaQuery = query(
        ideaTagsRef,
        where('ideaId', '==', ideaId)
      );
      const remainingTagsSnapshot = await getDocs(allTagsForIdeaQuery);

      // If no more tags, add to untagged column
      if (remainingTagsSnapshot.empty) {
        const idea = ideas.find(i => i.id === ideaId);
        const untaggedRef = columnRefs.current.untagged;

        if (idea && untaggedRef && untaggedRef.current) {
          const placeholder = untaggedRef.current.querySelector('[data-idea-id="placeholder"]');

          if (placeholder) {
            // Replace placeholder with the idea
            const ideaDiv = document.createElement('div');
            ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
            ideaDiv.setAttribute('data-idea-id', ideaId);
            ideaDiv.innerHTML = idea.content || '';
            placeholder.parentNode.replaceChild(ideaDiv, placeholder);
          } else {
            // Append the idea to the untagged column if it doesn't already exist
            if (!untaggedRef.current.querySelector(`[data-idea-id="${ideaId}"]`)) {
              const ideaDiv = document.createElement('div');
              ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
              ideaDiv.setAttribute('data-idea-id', ideaId);
              ideaDiv.innerHTML = idea.content || '';
              untaggedRef.current.appendChild(ideaDiv);
            }
          }
        }
      }
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

  // Handle input changes for any column
  const handleChange = async (columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;

    // Get the current selection
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    // Find the containing idea-item div
    let currentDiv = range.startContainer;
    while (currentDiv && (!currentDiv.classList || !currentDiv.classList.contains('idea-item'))) {
      if (!currentDiv.parentNode) return;
      currentDiv = currentDiv.parentNode;
    }

    if (!currentDiv || !currentDiv.classList.contains('idea-item')) return;

    // Remember the caret position
    const caretPosition = range.startOffset;
    const textNode = range.startContainer;

    // Force the cursor to the end of the text after a timeout
    setTimeout(() => {
      setCursorAtEnd(currentDiv);
    }, 0);

    // Get the idea ID
    const ideaId = currentDiv.getAttribute('data-idea-id');
    if (!ideaId || ideaId === 'placeholder') return;

    // Do direct update to Firebase without changing the DOM
    if (ideaId && !ideaId.startsWith('temp-')) {
      // Skip rapid updates - only update after a brief pause in typing
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        try {
          await updateDoc(doc(db, 'ideas', ideaId), {
            content: currentDiv.innerHTML,
            updatedAt: new Date()
          });

          // Place cursor at the end again after update
          setCursorAtEnd(currentDiv);
        } catch (error) {
          console.error("Error updating idea:", error);
        }
      }, 1000);
    } else if (ideaId.startsWith('temp-') && currentDiv.textContent.trim() !== '') {
      // For temporary IDs, create a permanent idea without changing the DOM
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        try {
          const newIdeaId = await createNewIdea(currentDiv.innerHTML, columnType === 'untagged' ? null : columnId);
          if (newIdeaId) {
            // Just update the ID attribute, don't change anything else
            currentDiv.setAttribute('data-idea-id', newIdeaId);

            // Place cursor at the end again after update
            setCursorAtEnd(currentDiv);
          }
        } catch (error) {
          console.error("Error creating permanent idea:", error);
        }
      }, 1000);
    }

    // When a keystroke happens, ensure all content is wrapped in idea-item divs
    ensureIdeaItemDivs(columnRef.current);
  };

  // Completely rewritten to avoid DOM manipulation during typing
  const syncColumnIdeasWithDOM = useCallback((columnType, columnId) => {
    // This function is now only used when initializing columns
    // or when explicitly needed to sync after certain operations
    // It does NOT get called during normal typing to avoid cursor issues

    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;

    // Skip if we're in the middle of creating a new idea
    if (isUpdatingRef.current) return;

    // Do not use a timeout here - execute immediately
    try {
      // Get all idea divs from the editor
      const ideaDivs = columnRef.current.querySelectorAll('.idea-item');

      // Skip placeholders
      const validDomIdeas = Array.from(ideaDivs)
        .filter(div => div.getAttribute('data-idea-id') !== 'placeholder')
        .map((div, index) => {
          let content = div.innerHTML;

          if (div.hasAttribute('data-has-placeholder') && (content === '&nbsp;' || content === '\u00A0')) {
            content = '';
          }

          return {
            id: div.getAttribute('data-idea-id'),
            content: content,
            order: index,
            element: div
          };
        });

      // For initial syncs and special operations only
      // During normal typing, handleChange takes care of Firebase updates
    } catch (error) {
      console.error(`Error in syncColumnIdeasWithDOM for ${columnType} ${columnId || ''}:`, error);
    }
  }, []);

  // Ensure all content is wrapped in idea-item divs for any column
  const ensureIdeaItemDivs = (columnElement) => {
    if (!columnElement) return;

    // Save selection
    const selection = window.getSelection();
    const savedRange = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

    // Get all childNodes in the editor
    const childNodes = Array.from(columnElement.childNodes);

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

  // Listen for keydown events in any column
  const handleKeyDown = async (e, columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;

    // Handle backspace at beginning of empty idea to delete it
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);

      // Find the containing idea-item div
      let currentDiv = range.startContainer;
      while (currentDiv && (!currentDiv.classList || !currentDiv.classList.contains('idea-item'))) {
        currentDiv = currentDiv.parentNode;
      }

      if (currentDiv) {
        const ideaId = currentDiv.getAttribute('data-idea-id');
        // Only apply to real ideas, not placeholders
        if (ideaId && ideaId !== 'placeholder' && !ideaId.startsWith('temp-')) {
          const isEmpty = currentDiv.textContent.trim() === '' || currentDiv.textContent === '\u00A0';
          const isAtStart = range.startOffset === 0;

          // If at the start of an empty idea or the cursor is at the beginning of the idea
          if (isEmpty || isAtStart) {
            const ideaDivs = Array.from(columnRef.current.querySelectorAll('.idea-item'));
            const currentIndex = ideaDivs.findIndex(div => div.getAttribute('data-idea-id') === ideaId);

            // Find previous idea to focus after deletion (if there is one)
            if (currentIndex > 0) {
              const prevIdeaDiv = ideaDivs[currentIndex - 1];
              const prevIdeaId = prevIdeaDiv.getAttribute('data-idea-id');

              if (isEmpty) {
                // Delete the empty idea from database
                try {
                  e.preventDefault();
                  await deleteDoc(doc(db, 'ideas', ideaId));

                  // Remove the div from DOM for immediate feedback
                  currentDiv.remove();

                  // Focus the previous idea and place cursor at the end
                  setFocusedIdeaId(prevIdeaId);
                  setCursorAtEnd(prevIdeaDiv);

                  return; // Exit early after handling deletion
                } catch (error) {
                  console.error("Error deleting idea:", error);
                }
              }
            }
          }
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default Enter behavior

      try {
        // Set updating flag to prevent syncColumnIdeasWithDOM from running
        isUpdatingRef.current = true;

        // Get current position
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);

        // Find the containing idea-item div
        let currentDiv = range.startContainer;
        while (currentDiv && (!currentDiv.classList || !currentDiv.classList.contains('idea-item'))) {
          currentDiv = currentDiv.parentNode;
        }

        if (!currentDiv) {
          isUpdatingRef.current = false;
          return; // Not inside an idea-item
        }

        const currentIdeaId = currentDiv.getAttribute('data-idea-id');
        if (currentIdeaId === 'placeholder') {
          isUpdatingRef.current = false;
          return;
        }

        // Get the current text before and after the cursor
        const beforeText = currentDiv.textContent.substring(0, range.startOffset);
        const afterText = currentDiv.textContent.substring(range.startOffset);

        // Update the current idea with just the text before the cursor
        if (currentIdeaId && !currentIdeaId.startsWith('temp-')) {
          await updateDoc(doc(db, 'ideas', currentIdeaId), {
            content: beforeText,
            updatedAt: new Date()
          });

          // Update the current div with the text before cursor
          currentDiv.innerHTML = beforeText || '';
        }

        // Create new idea in Firebase with the text after the cursor
        const newIdeaId = await createNewIdea(afterText, columnType === 'untagged' ? null : columnId, 0);

        if (!newIdeaId) {
          isUpdatingRef.current = false;
          return;
        }

        // Create new div for the new idea
        const newDiv = document.createElement('div');
        newDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text idea-item-focused bg-neutral-800 text-white';
        newDiv.setAttribute('data-idea-id', newIdeaId);

        // Make sure we add a proper text node (not HTML)
        const textNode = document.createTextNode(afterText || '');
        newDiv.appendChild(textNode);

        // Insert at the top of the column
        const firstIdea = columnRef.current.querySelector('.idea-item');
        if (firstIdea) {
          columnRef.current.insertBefore(newDiv, firstIdea);
        } else {
          columnRef.current.appendChild(newDiv);
        }

        // Set focus state before focusing the element
        setFocusedIdeaId(newIdeaId);

        // Focus the new div and set cursor at end
        newDiv.focus();
        setCursorAtEnd(newDiv);

        // Scroll into view smoothly
        newDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Clear any pending timeouts
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }

        // Reset the updating flag after a reasonable delay
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 1000);
      } catch (error) {
        console.error("Error handling Enter key:", error);
        isUpdatingRef.current = false;
      }
    }
  };

  // Handle keypress in paragraphs with placeholders
  const handleKeyPress = (e, columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;

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
    if (currentDiv && currentDiv.nodeType === Node.ELEMENT_NODE && currentDiv.hasAttribute && currentDiv.hasAttribute('data-has-placeholder')) {
      // Only do this for actual character keys, not control keys
      if (e.key.length === 1) {
        e.preventDefault(); // Prevent default character insertion

        // Clear the div's content (remove the nbsp)
        currentDiv.innerHTML = '';

        // Insert the pressed character
        const textNode = document.createTextNode(e.key);
        currentDiv.appendChild(textNode);

        // Move cursor to end of this character using our new helper function
        setCursorAtEnd(currentDiv);

        // Remove the placeholder marker
        currentDiv.removeAttribute('data-has-placeholder');

        // Don't sync with Firebase here - handleChange will do that
      }
    }
  };

  // Handle paste event to strip formatting
  const handlePaste = (e, columnType, columnId) => {
    e.preventDefault();

    // Get plain text from clipboard
    const text = e.clipboardData.getData('text/plain');

    // Insert text at cursor position
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    // Insert the text
    range.deleteContents();
    range.insertNode(document.createTextNode(text));

    // Move cursor to end of pasted text
    range.setStartAfter(range.endContainer);
    range.setEndAfter(range.endContainer);
    selection.removeAllRanges();
    selection.addRange(range);

    // Sync with Firebase
    syncColumnIdeasWithDOM(columnType, columnId);
  };

  // Handle tag input change
  const handleTagInputChange = (e) => {
    // Prevent event propagation to avoid triggering syncColumnIdeasWithDOM
    e.stopPropagation();
    setTagInputValue(e.target.value);
  };

  // Handle tag input key down events
  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(tagInputValue.trim());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTagInputVisible(false);
      setTagInputValue('');
    }
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

  // Handle new tag input change
  const handleNewTagInputChange = (e) => {
    setNewTagInputValue(e.target.value);
  };

  // Handle new tag input submission
  const handleNewTagSubmit = async () => {
    if (!newTagInputValue.trim()) return;

    try {
      // Check if tag already exists
      const existingTag = tags.find(tag => tag.name.toLowerCase() === newTagInputValue.toLowerCase());
      if (existingTag) {
        // Tag already exists, just clear the input
        setNewTagInputValue('');
        setNewTagInputVisible(false);
        return;
      }

      // Create new tag in Firebase
      const tagId = await createTag(newTagInputValue.trim());

      // Store the newly created tag ID to focus its column
      if (tagId) {
        // Create first idea in this new tag
        const newIdeaId = await createNewIdea('', tagId);

        // Set a timeout to allow the DOM to update with the new column
        setTimeout(() => {
          // Focus the first idea in the new column
          const columnRef = columnRefs.current[tagId];
          if (columnRef && columnRef.current) {
            // Get the placeholder or first idea div
            const firstIdea = columnRef.current.querySelector('.idea-item');

            if (firstIdea) {
              // Check if it's a placeholder
              const isPlaceholder = firstIdea.getAttribute('data-idea-id') === 'placeholder';

              if (isPlaceholder) {
                // Replace placeholder with an empty editable div
                const newDiv = document.createElement('div');
                newDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
                newDiv.setAttribute('data-idea-id', newIdeaId);
                newDiv.setAttribute('data-has-placeholder', 'true');

                // Add a non-breaking space to ensure the div has content and height
                const textNode = document.createTextNode('\u00A0');
                newDiv.appendChild(textNode);

                // Replace the placeholder
                firstIdea.parentNode.replaceChild(newDiv, firstIdea);

                // Set this as the new first idea
                firstIdea = newDiv;
              }

              // Focus the div and set the caret
              firstIdea.focus();

              // Make sure it has a child for the selection
              if (!firstIdea.firstChild) {
                const textNode = document.createTextNode('\u00A0');
                firstIdea.appendChild(textNode);
              }

              // Create a selection at the beginning
              const range = document.createRange();
              range.setStart(firstIdea.firstChild, 0);
              range.setEnd(firstIdea.firstChild, 0);

              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);

              // Add focus styling
              firstIdea.classList.remove('text-white/60');
              firstIdea.classList.add('text-white');
              firstIdea.classList.add('idea-item-focused');
              firstIdea.classList.add('bg-neutral-800');

              // Set this as the focused idea
              setFocusedIdeaId(newIdeaId);

              // Scroll into view if needed
              firstIdea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 500); // Wait for DOM to update
      }

      // Clear input and hide
      setNewTagInputValue('');
      setNewTagInputVisible(false);
    } catch (error) {
      console.error("Error creating new tag:", error);
    }
  };

  // Handle new tag input key down
  const handleNewTagInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNewTagSubmit();
    } else if (e.key === 'Escape') {
      setNewTagInputVisible(false);
      setNewTagInputValue('');
    }
  };

  // Delete a tag and all its associations
  const deleteTag = async (tagId, tagName) => {
    // Show native confirmation dialog
    const confirmed = window.confirm(`Delete tag "${tagName}"? This cannot be undone.`);

    if (!confirmed) return;

    try {
      // First, get all ideas that have this tag
      const q = query(ideaTagsRef, where('tagId', '==', tagId));
      const querySnapshot = await getDocs(q);

      // Keep track of which ideas need to be checked for becoming untagged
      const affectedIdeaIds = querySnapshot.docs.map(doc => doc.data().ideaId);

      // Delete all relationships
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // For each affected idea, check if it has any other tags
      for (const ideaId of affectedIdeaIds) {
        const remainingTagsQuery = query(
          ideaTagsRef,
          where('ideaId', '==', ideaId)
        );
        const remainingTagsSnapshot = await getDocs(remainingTagsQuery);

        // If no tags left, manually add to untagged column for immediate UI update
        if (remainingTagsSnapshot.empty) {
          const idea = ideas.find(i => i.id === ideaId);
          if (idea) {
            // Manually update untagged ideas state for immediate effect
            setUntaggedIdeas(prev => {
              if (!prev.some(i => i.id === ideaId)) {
                return [...prev, idea];
              }
              return prev;
            });

            // Also update the DOM for immediate UI feedback
            const untaggedRef = columnRefs.current.untagged;
            if (untaggedRef && untaggedRef.current) {
              const placeholder = untaggedRef.current.querySelector('[data-idea-id="placeholder"]');

              if (placeholder) {
                // Replace placeholder with the idea
                const ideaDiv = document.createElement('div');
                ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
                ideaDiv.setAttribute('data-idea-id', ideaId);
                ideaDiv.innerHTML = idea.content || '';
                placeholder.parentNode.replaceChild(ideaDiv, placeholder);
              } else {
                // Append the idea to the untagged column if it doesn't already exist
                if (!untaggedRef.current.querySelector(`[data-idea-id="${ideaId}"]`)) {
                  const ideaDiv = document.createElement('div');
                  ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
                  ideaDiv.setAttribute('data-idea-id', ideaId);
                  ideaDiv.innerHTML = idea.content || '';
                  untaggedRef.current.appendChild(ideaDiv);
                }
              }
            }
          }
        }
      }

      // Delete the tag itself
      await deleteDoc(doc(db, 'tags', tagId));

      console.log(`Tag "${tagName}" deleted successfully`);
    } catch (error) {
      console.error("Error deleting tag:", error);
      alert("Error deleting tag. Please try again.");
    }
  };

  // Initialize column content with ideas
  const initializeColumnContent = (columnId, columnIdeas) => {
    const columnRef = columnId === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;

    // Save the current selection and focused element
    const selection = window.getSelection();
    const savedRange = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    const activeElement = document.activeElement;

    // Keep track of the currently focused idea ID, if any
    let focusedDivId = null;
    if (activeElement && activeElement.classList && activeElement.classList.contains('idea-item')) {
      focusedDivId = activeElement.getAttribute('data-idea-id');
    }

    // Create elements directly instead of using innerHTML
    columnRef.current.innerHTML = '';

    if (columnIdeas.length > 0) {
      // Sort ideas by creation time - newest first
      const sortedIdeas = [...columnIdeas].sort((a, b) => {
        const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA; // Newest first
      });

      // Add each idea as a DOM element
      sortedIdeas.forEach(idea => {
        const ideaDiv = document.createElement('div');
        ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';

        // Apply focus styling if this was the focused idea
        if (idea.id === focusedDivId || idea.id === focusedIdeaId) {
          ideaDiv.classList.add('idea-item-focused');
          ideaDiv.classList.add('bg-neutral-800');
          ideaDiv.classList.add('text-white');
          ideaDiv.classList.remove('text-white/60');
        }

        ideaDiv.setAttribute('data-idea-id', idea.id);
        ideaDiv.innerHTML = idea.content || '';
        columnRef.current.appendChild(ideaDiv);
      });
    } else {
      // Add placeholder as a DOM element
      const placeholderDiv = document.createElement('div');
      placeholderDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 hover:bg-white/[2%] rounded-lg cursor-text';
      placeholderDiv.style.color = 'rgba(255, 255, 255, 0.3)'; // Force color with inline style
      placeholderDiv.setAttribute('data-idea-id', 'placeholder');
      placeholderDiv.textContent = 'Add ideas';
      columnRef.current.appendChild(placeholderDiv);
    }

    // Try to restore focus and selection if we had one
    if (focusedDivId && savedRange) {
      // Find the div with the previously focused idea ID
      const newFocusedDiv = columnRef.current.querySelector(`[data-idea-id="${focusedDivId}"]`);
      if (newFocusedDiv) {
        try {
          // Focus the div and try to restore a similar selection
          newFocusedDiv.focus();

          // Create a new range positioned similarly to the old one
          const newRange = document.createRange();
          const nodeToSelect = newFocusedDiv.firstChild || newFocusedDiv;

          // Try to position cursor similarly to before
          if (nodeToSelect.nodeType === Node.TEXT_NODE) {
            const offset = Math.min(savedRange.startOffset, nodeToSelect.textContent.length);
            newRange.setStart(nodeToSelect, offset);
            newRange.setEnd(nodeToSelect, offset);
          } else {
            newRange.selectNodeContents(nodeToSelect);
            newRange.collapse(true);
          }

          selection.removeAllRanges();
          selection.addRange(newRange);
        } catch (e) {
          console.log("Couldn't restore selection after initializing column content");
        }
      }
    }
  };

  // Get the focused idea object
  const focusedIdea = ideas.find(idea => idea.id === focusedIdeaId) || null;

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
          return; // Don't change focus if clicked in sidebar
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

    // Reset focus styling on all columns
    for (const id in columnRefs.current) {
      const columnRef = columnRefs.current[id];
      if (columnRef && columnRef.current) {
        const allIdeas = columnRef.current.querySelectorAll('.idea-item');
        allIdeas.forEach(idea => {
          idea.classList.remove('text-white');
          idea.classList.add('text-white/60');
          idea.classList.remove('idea-item-focused');
          idea.classList.remove('bg-neutral-800');
        });
      }
    }

    if (currentDiv && currentDiv.classList && currentDiv.classList.contains('idea-item')) {
      const ideaId = currentDiv.getAttribute('data-idea-id');
      if (ideaId !== 'placeholder') {
        // Make focused idea text-white and add focus styling
        currentDiv.classList.remove('text-white/60');
        currentDiv.classList.add('text-white');
        currentDiv.classList.add('idea-item-focused');
        currentDiv.classList.add('bg-neutral-800');

        setFocusedIdeaId(ideaId);
      }
    } else {
      // Only clear the focused idea if we're not clicking in the sidebar
      const isSidebarClick = sidebarElement && sidebarElement.contains(range.startContainer);
      if (!isSidebarClick) {
        setFocusedIdeaId(null);
      }
    }
  };

  // Set up selection change listener
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Handle tab click to toggle utility sidebar
  const handleTabClick = (tabName) => {
    // If clicking the active tab, close it; otherwise, open the clicked tab
    setActiveTab(activeTab === tabName ? null : tabName);
  };

  // Clean up empty ideas on page refresh
  const cleanupEmptyIdeas = async (ideasData) => {
    try {
      const emptyIdeas = ideasData.filter(idea => {
        // Check if content is empty or just whitespace/non-breaking space
        const content = idea.content || '';
        const strippedContent = content.replace(/&nbsp;|\u00A0|\s/g, '');
        return strippedContent === '';
      });

      if (emptyIdeas.length > 0) {
        console.log(`Cleaning up ${emptyIdeas.length} empty ideas on page refresh`);

        // Delete all empty ideas
        const deletePromises = emptyIdeas.map(idea =>
          deleteDoc(doc(db, 'ideas', idea.id))
        );

        await Promise.all(deletePromises);
      }
    } catch (error) {
      console.error("Error cleaning up empty ideas:", error);
    }
  };

  // Load notes for the focused idea
  useEffect(() => {
    // Clear notes when no idea is focused
    if (!focusedIdeaId) {
      setIdeaNotes([]);
      return () => { }; // No cleanup needed when no idea is focused
    }

    try {
      // Create a query for notes with the current focused idea ID
      // Note: This query requires a Firestore composite index on ideaId + createdAt
      const q = query(
        notesRef,
        where('ideaId', '==', focusedIdeaId),
        orderBy('createdAt', 'asc')
      );

      // Set up the snapshot listener for this specific idea's notes
      const unsubscribeNotes = onSnapshot(q, (snapshot) => {
        try {
          const notesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
          }));

          // Only update notes if the focusedIdeaId hasn't changed
          if (focusedIdeaId) {
            setIdeaNotes(notesData);
          }
        } catch (error) {
          console.error("Error processing notes data:", error);
          setIdeaNotes([{
            id: 'error',
            content: 'Error loading notes. Please try again later.',
            createdAt: new Date(),
            isError: true
          }]);
        }
      }, (error) => {
        console.error("Error in notes snapshot listener:", error);

        // Special handling for index error
        if (error?.code === 'failed-precondition' || error.message?.includes('index')) {
          setIdeaNotes([{
            id: 'error',
            content: `This feature requires an index. Please click here to create it: 
            
https://console.firebase.google.com/project/_/firestore/indexes`,
            createdAt: new Date(),
            isError: true,
            isIndex: true
          }]);
        } else {
          setIdeaNotes([{
            id: 'error',
            content: 'Error loading notes. Please try again later.',
            createdAt: new Date(),
            isError: true
          }]);
        }
      });

      // Clean up the snapshot listener when the focused idea changes
      return () => {
        unsubscribeNotes();
      };
    } catch (error) {
      console.error("Error setting up notes query:", error);
      setIdeaNotes([{
        id: 'error',
        content: 'Error setting up notes. Please refresh the page.',
        createdAt: new Date(),
        isError: true
      }]);

      return () => { }; // No cleanup needed for a failed setup
    }
  }, [focusedIdeaId]);

  // Add a new note
  const handleAddNote = async () => {
    if (!focusedIdeaId || !noteInputValue.trim()) return;

    try {
      console.log("Attempting to add note to Firestore...", {
        ideaId: focusedIdeaId,
        content: noteInputValue.trim(),
        createdAt: new Date()
      });

      // Create new note in Firebase
      const noteRef = await addDoc(notesRef, {
        ideaId: focusedIdeaId,
        content: noteInputValue.trim(),
        createdAt: new Date()
      });

      console.log("Note added successfully with ID:", noteRef.id);

      // Clear input and hide the note input component
      setNoteInputValue('');
      setNoteInputVisible(false);
    } catch (error) {
      console.error("Error adding note:", error);
      // Show a more user-friendly error
      alert("There was an error adding your note. Please try again.");
    }
  };

  // Delete a note
  const handleDeleteNote = async (noteId) => {
    try {
      console.log("Attempting to delete note with ID:", noteId);
      await deleteDoc(doc(db, 'notes', noteId));
      console.log("Note deleted successfully");
    } catch (error) {
      console.error("Error deleting note:", error);
      alert("There was an error deleting your note. Please try again.");
    }
  };

  // Handle note input change
  const handleNoteInputChange = (e) => {
    setNoteInputValue(e.target.value);
  };

  // Handle note input key down events
  const handleNoteInputKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleAddNote();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setNoteInputVisible(false);
      setNoteInputValue('');
    }
  };

  // Handle view layout toggle
  const handleViewLayoutToggle = (layout) => {
    setViewLayout(layout);
  };

  return (
    <div className="h-screen flex flex-row text-white/80 text-sm bg-neutral-900 selection:bg-rose-500 selection:text-white selection:text-white caret-rose-500 font-pressura font-normal">
      <div className="h-full flex flex-1 flex-col px-2 shadow-[1px_0_0_rgba(255,255,255,0.05)]">

        {/* Utility sidebar tabs */}
        {/* tab: view */}
        <div
          className={`group w-10 h-10 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'view' ? 'bg-neutral-800' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
          onClick={() => handleTabClick('view')}
        >
          <span className={`material-symbols-rounded text-base ${activeTab === 'view' ? 'text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>sort</span>
        </div>
        {/* tab: tools */}
        <div
          className={`group w-10 h-10 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'tools' ? 'bg-neutral-800' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
          onClick={() => handleTabClick('tools')}
        >
          <span className={`material-symbols-rounded text-base ${activeTab === 'tools' ? 'text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>widgets</span>
        </div>
        {/* tab: tips */}
        <div
          className={`group w-10 h-10 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'tips' ? 'bg-neutral-800' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
          onClick={() => handleTabClick('tips')}
        >
          <span className={`material-symbols-rounded text-base ${activeTab === 'tips' ? 'text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>info</span>
        </div>

      </div>

      {/* Utility sidebar - only show when a tab is active */}
      {activeTab && (
        <div className="idea-sidebar h-full min-w-[340px] max-w-[400px] flex flex-col pl-8 pr-10 overflow-auto bg-neutral-800">

          {activeTab === 'view' && (
            <>
              <div className="flex flex-row items-center justify-start gap-4 -mx-3 gap-1 pt-3 px-3 text-white">
                <div
                  className={`flex flex-row items-center gap-1 -mx-3 pt-1 pb-2 px-3 select-none ${viewLayout === 'horizontal' ? 'text-white' : 'text-white/40'} leading-tight hover:bg-white/[2%] rounded-lg cursor-pointer`}
                  onClick={() => handleViewLayoutToggle('horizontal')}
                >
                  <span className="material-symbols-rounded text-base">view_agenda</span>
                  Horizontal
                </div>
                <div
                  className={`flex flex-row items-center gap-1 -mx-3 pt-1 pb-2 px-3 select-none ${viewLayout === 'vertical' ? 'text-white' : 'text-white/40'} leading-tight hover:bg-white/[2%] rounded-lg cursor-pointer`}
                  onClick={() => handleViewLayoutToggle('vertical')}
                >
                  <span className="material-symbols-rounded text-base">view_column_2</span>
                  Vertical
                </div>
              </div>

              <hr className="w-[calc(100%+22px)] my-3 -mx-3 border-[rgba(255,255,255,0.05)]" />

              <div className="flex flex-row items-center justify-between gap-4 -mx-3 px-3 text-white hover:bg-white/[2%] rounded-lg cursor-pointer">

                <div className="w-full flex flex-row items-center gap-1 pt-1 pb-2 select-none" onClick={toggleAllTags}>
                  <span className="material-symbols-rounded text-base">
                    {selectionState === 'all' ? 'check_box' :
                      selectionState === 'indeterminate' ? 'indeterminate_check_box' :
                        'check_box_outline_blank'}
                  </span>
                  <span className="">Tags</span>
                  <span className="ml-1 opacity-40">{Object.values(globalTagCounts).reduce((sum, count) => sum + count, 0)}</span>
                </div>
                <div className="flex flex-row items-center gap-1">
                  <span className="material-symbols-rounded text-base cursor-pointer text-white/40 hover:scale-125 duration-100 ease-in-out hover:text-white">tune</span>
                </div>
              </div>

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
                    <span className={`${!selectedTags[tag.id] ? 'opacity-40' : ''}`}>{tag.name}</span>
                    <span className="ml-1 opacity-40">{tagCount}</span>
                  </div>
                );
              })}



              <hr className="w-[calc(100%+22px)] my-3 -mx-3 border-[rgba(255,255,255,0.05)]" />


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

      {/* ideas container with dynamic class based on viewLayout */}
      <div className={`w-full flex ${viewLayout === 'horizontal' ? 'flex-row gap-3' : 'flex-col'} p-3 pt-0 overflow-auto`}>

        {/* Untagged column - always display */}
        <div className="relative min-w-[400px] flex flex-1 flex-col">
          <div className="min-h-14 flex justify-center items-center p-4">
            <div className="flex items-center -mx-1 pb-1 pl-2 pr-3 whitespace-nowrap select-none">
              <span className="material-symbols-rounded text-base">tag</span>
              untagged
            </div>
          </div>
          <div
            ref={columnRefs.current.untagged}
            contentEditable
            spellCheck="false"
            className="h-full p-4 focus:outline-none text-center leading-tight font-normal rounded-2xl shadow-[inset_0_0_1px_rgba(255,255,255,0.25)] whitespace-pre-wrap overflow-auto cursor-default select-none"
            onInput={() => handleChange('untagged', 'untagged')}
            onKeyDown={(e) => handleKeyDown(e, 'untagged', 'untagged')}
            onKeyPress={(e) => handleKeyPress(e, 'untagged', 'untagged')}
            onPaste={(e) => handlePaste(e, 'untagged', 'untagged')}
            onFocus={() => handleFocus('untagged', 'untagged')}
            onBlur={() => handleBlur('untagged', 'untagged')}
          >
            {/* Content will be set via initializeColumnContent */}
          </div>
        </div>

        {/* Tag-based columns - display for all tags */}
        {tags.map(tag => (
          <div key={tag.id} className="relative group min-w-[400px] flex flex-1 flex-col">
            <div className="relative min-h-14 flex justify-center items-center py-4 px-6">
              <div className="flex items-center pb-1 pl-2 pr-3 select-none">
                <span className="material-symbols-rounded text-base">tag</span>
                <span className="truncate">{tag.name}</span>
                <span
                  className="absolute top-1/2 -translate-y-1/2 right-2 material-symbols-rounded text-base cursor-pointer text-white/40 ml-1 invisible group-hover:visible hover:scale-125 transition-[transform] duration-100 ease-in-out hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTag(tag.id, tag.name);
                  }}
                >more_horiz</span>
              </div>
            </div>
            <div
              ref={columnRefs.current[tag.id]}
              contentEditable
              spellCheck="false"
              className="h-full p-4 focus:outline-none text-center leading-tight font-normal rounded-2xl shadow-[inset_0_0_1px_rgba(255,255,255,0.25)] whitespace-pre-wrap overflow-auto cursor-default select-none"
              onInput={() => handleChange('tag', tag.id)}
              onKeyDown={(e) => handleKeyDown(e, 'tag', tag.id)}
              onKeyPress={(e) => handleKeyPress(e, 'tag', tag.id)}
              onPaste={(e) => handlePaste(e, 'tag', tag.id)}
              onFocus={() => handleFocus('tag', tag.id)}
              onBlur={() => handleBlur('tag', tag.id)}
            >
              {/* Content will be set via initializeColumnContent */}
            </div>
          </div>
        ))}

        {/* New tag column - always display at the end */}
        <div className="relative group min-w-[400px] flex flex-1 flex-col">
          <div className="min-h-14 max-h-14 flex justify-center items-center px-4">
            {!newTagInputVisible ? (
              <div
                className="flex items-center -mx-1 pb-1 pl-2 pr-3 text-white/40 group-hover:bg-white/5 group-hover:text-white rounded-full whitespace-nowrap select-none cursor-pointer"
                onClick={() => {
                  setNewTagInputVisible(true);
                  setTimeout(() => {
                    if (newTagInputRef.current) {
                      newTagInputRef.current.focus();
                    }
                  }, 0);
                }}
              >
                <span className="material-symbols-rounded text-base">add</span>
                New tag
              </div>
            ) : (
              <div
                className="relative w-full h-10 flex items-center justify-between gap-2 px-3 bg-white/[5%] rounded-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={newTagInputRef}
                  type="text"
                  value={newTagInputValue}
                  onChange={handleNewTagInputChange}
                  onKeyDown={handleNewTagInputKeyDown}
                  className="w-full px-6 bg-transparent border-none outline-none placeholder:text-white/40 text-center"
                  placeholder="Enter tag name"
                  autoFocus
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 right-3 material-symbols-rounded text-base cursor-pointer text-white/40 hover:scale-125 duration-100 ease-in-out hover:text-white"
                  onClick={(e) => {
                    setNewTagInputVisible(false);
                    setNewTagInputValue('');
                  }}
                >cancel</span>
              </div>
            )}
          </div>
          <div className="h-full p-4 focus:outline-none text-center leading-tight font-normal rounded-2xl border border-dashed border-white/[5%] whitespace-pre-wrap overflow-auto cursor-default select-none" />
        </div>

      </div>

      {/* Context sidebar */}
      {focusedIdeaId && focusedIdea && (
        <div
          className="idea-sidebar h-full min-w-[400px] flex flex-1 flex-col px-8 overflow-auto bg-neutral-800"
          onMouseDown={(e) => {
            // Prevent the mousedown from triggering a selection change
            // This is critical since selection changes can cause the sidebar to close
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Prevent click events from bubbling up
            e.stopPropagation();
          }}
        >
          <div className="flex flex-1 flex-col justify-between">
            <div className="flex flex-1 flex-col">

              <div className="min-h-14 flex flex-row justify-between items-center gap-4 py-4 sticky top-0 z-10 bg-neutral-800 shadow-[0_1px_0_rgba(255,255,255,0.05),16px_0_0_rgba(38,38,38,1),-16px_0_0_rgba(38,38,38,1)]">
                <div className="flex flex-1 items-center leading-tight">
                  {focusedIdea.content}
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
                    className="w-fit flex justify-center items-center -mx-1 pb-1 pl-2 pr-3 text-white/40 hover:text-white hover:bg-white/5 rounded-full whitespace-nowrap cursor-pointer"
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
                      className="w-full h-10 flex items-center gap-2 px-3 bg-white/[5%] rounded-lg"
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
                          setTagInputVisible(false);
                          setTagInputValue('');
                        }}
                      >cancel</span>
                    </div>

                    {/* Matching tags list */}
                    {getFilteredTags().map(tag => {
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

                    {getFilteredTags().length > 0 && exactTagExists() && <hr className="border-[rgba(255,255,255,0.05)]" />}

                    {/* Add new tag button */}
                    {exactTagExists() && (
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

              {/* Notes section */}
              <div
                className="flex flex-col justify-center -mt-2 py-4"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <div className="w-[calc(100%+24px)] flex flex-col w-full -mx-3">

                  {/* Display notes for this idea */}
                  {ideaNotes
                    .filter(note => note.ideaId === focusedIdeaId || note.isError)
                    .map(note => (
                      <div key={note.id} className={`group w-full flex flex-col gap-1 p-3 rounded-lg ${note.isError ? 'bg-red-900/20' : 'hover:shadow-[inset_0_0_1px_rgba(255,255,255,0.25)]'}`}>
                        <div className={`whitespace-pre-wrap leading-tight break-words ${note.isIndex ? 'cursor-pointer' : ''}`}
                          onClick={note.isIndex ? () => {
                            window.open('https://console.firebase.google.com/project/_/firestore/indexes', '_blank');
                          } : undefined}>
                          {note.content}
                        </div>
                        {!note.isError && (
                          <div className="flex justify-between items-start">
                            <div className="text-sm text-white/40 mb-1">
                              {note.createdAt.toLocaleString()}
                            </div>
                            <span
                              className="hidden group-hover:block material-symbols-rounded text-base cursor-pointer text-white/40 hover:text-white"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteNote(note.id);
                              }}
                            >
                              delete
                            </span>
                          </div>
                        )}
                      </div>
                    ))}

                  {/* Add new note button or input */}
                  {!noteInputVisible ? (
                    <div
                      className="w-fit flex justify-center items-center mt-2 pb-1 pl-2 pr-3 text-white/40 hover:text-white hover:bg-white/5 rounded-full whitespace-nowrap cursor-pointer"
                      onClick={() => {
                        setNoteInputVisible(true);
                        setTimeout(() => {
                          if (noteInputRef.current) {
                            noteInputRef.current.focus();
                          }
                        }, 0);
                      }}
                    >
                      <span className="material-symbols-rounded text-base">add</span>
                      Note
                    </div>
                  ) : (
                    <div className="w-full flex flex-col mt-2">
                      <textarea
                        ref={noteInputRef}
                        value={noteInputValue}
                        onChange={handleNoteInputChange}
                        onKeyDown={handleNoteInputKeyDown}
                        className="w-full min-h-[100px] p-3 mb-2 bg-white/[5%] rounded-lg border-none outline-none placeholder:text-white/40 resize-y"
                        placeholder="Add a note..."
                        autoFocus
                      />
                      <div className="flex justify-between gap-2">
                        <button
                          className="flex items-center pb-1 pl-2 pr-3 text-white bg-white/5 rounded-full whitespace-nowrap cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddNote();
                          }}
                        >
                          <span className="material-symbols-rounded text-base">add</span>
                          Add Note
                        </button>
                        <button
                          className="flex items-center pb-1 pl-2 pr-3 text-white/40 hover:text-white rounded-full whitespace-nowrap cursor-pointer"
                          onClick={() => {
                            setNoteInputVisible(false);
                            setNoteInputValue('');
                          }}
                        >
                          {/* <span className="material-symbols-rounded text-base">close</span> */}
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            <hr className="border-[rgba(255,255,255,0.05)]" />


            {/* Meta */}
            <div className="min-h-14 flex flex-col justify-center gap-y-2 pt-4 pb-8">
              {/* Delete button */}
              <div className="text-white/40">Created {focusedIdea.createdAt.toDate ? focusedIdea.createdAt.toDate().toLocaleString() : focusedIdea.createdAt.toLocaleString()}</div>
              <div className="text-white/40">Updated {focusedIdea.updatedAt.toDate ? focusedIdea.updatedAt.toDate().toLocaleString() : focusedIdea.updatedAt.toLocaleString()}</div>
              <div
                className="flex flex-row items-center gap-1 pb-1 text-white/40 hover:text-white/80 cursor-pointer"
                onClick={() => {
                  if (focusedIdeaId) {
                    // Delete idea from Firebase
                    deleteDoc(doc(db, 'ideas', focusedIdeaId))
                      .then(() => {
                        console.log(`Idea ${focusedIdeaId} deleted`);
                        // Clear the focused idea
                        setFocusedIdeaId(null);
                      })
                      .catch(error => {
                        console.error("Error deleting idea:", error);
                      });
                  }
                }}
              >
                <span className="material-symbols-rounded text-base">delete</span>
                <span>Delete idea</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;