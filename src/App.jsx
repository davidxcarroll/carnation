import React, { useState, useRef, useEffect, useCallback } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where, limit, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import './index.css';
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  serverTimestamp
} from "firebase/firestore";
import useFirebase from './hooks/useFirebase';
import TagBadge from './components/TagBadge';
import TagSelector from './components/TagSelector';
import IdeaItem from './components/IdeaItem';
import IdeaColumn from './components/IdeaColumn';
import useTextUtils from './hooks/useTextUtils';
import useTags from './hooks/useTags';
import useIdeas from './hooks/useIdeas';
// import useKeyboard from './hooks/useKeyboard'; // Will integrate later

// Utility function moved to utils/textUtils.js

const App = () => {
  // Use our utility hooks
  const { stripHtmlAndDecodeEntities, setCursorAtEnd } = useTextUtils();
  const firebase = useFirebase(db);
  
  // Use the tags hook
  const { 
    tags, 
    setTags,
    selectedTags, 
    setSelectedTags,
    selectionState,
    setSelectionState,
    tagIdeasMap, 
    setTagIdeasMap,
    globalTagCounts, 
    setGlobalTagCounts,
    getTagsWithIdeas,
    toggleTagSelection,
    toggleAllTags,
    updateSelectionState
  } = useTags(db, firebase);
  
  // Use the ideas hook
  const { 
    ideas, 
    setIdeas,
    untaggedIdeas, 
    setUntaggedIdeas,
    focusedIdeaId, 
    setFocusedIdeaId,
    isInitialLoad, 
    setIsInitialLoad,
    sortBy, 
    sortOrder,
    isUpdatingRef,
    // Functions we'll integrate later since they have duplicates
    createNewIdea,
    updateIdeaContent,
    deleteIdea,
    getFocusedIdea,
    cleanupEmptyIdeas,
    findUntaggedIdeas
    // sortIdeas,
    // toggleSortOrder,
    // changeSortBy
  } = useIdeas(db, firebase);

  // We'll integrate useKeyboard hook later
  // const { handleKeyDown, handleKeyPress, handlePaste } = useKeyboard(...);

  // Remove duplicate state declarations
  const [tagInputVisible, setTagInputVisible] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');
  const [ideaTags, setIdeaTags] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [newTagInputVisible, setNewTagInputVisible] = useState(false);
  const [newTagInputValue, setNewTagInputValue] = useState('');
  // Notes states
  const [noteInputVisible, setNoteInputVisible] = useState(false);
  const [noteInputValue, setNoteInputValue] = useState('');
  const [ideaNotes, setIdeaNotes] = useState([]);
  // Brief state
  const [briefValue, setBriefValue] = useState('');
  const [briefId, setBriefId] = useState(null);
  const [briefSaveStatus, setBriefSaveStatus] = useState('saved'); // 'saved', 'saving', 'error', 'needs-save', 'local'
  // View layout state
  const [viewLayout, setViewLayout] = useState('vertical');
  // Title editing state
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState('');
  // Group by tag state
  const [groupByTag, setGroupByTag] = useState(false);
  // Add activeCollection state for refresh operations
  const [activeCollection, setActiveCollection] = useState('default');

  // New state to track if any column is in edit mode
  const [isAnyColumnEditing, setIsAnyColumnEditing] = useState(false);

  const editorRef = useRef(null);
  const columnRefs = useRef({});
  const updateTimeoutRef = useRef(null);
  const newTagInputRef = useRef(null);
  const noteInputRef = useRef(null);
  const titleEditRef = useRef(null);
  const ideasRef = collection(db, 'ideas');
  const tagsRef = collection(db, 'tags');
  const ideaTagsRef = collection(db, 'ideaTags');
  const notesRef = collection(db, 'notes');
  const briefRef = collection(db, 'brief');
  // Add this after other refs and before the main component code
  const suppressSelectionChangeRef = useRef(false);

  // Get ideas for a specific tag - moved to top to avoid "Cannot access before initialization" error
  const getIdeasByTag = (tagId) => {
    const ideaIds = tagIdeasMap[tagId] || [];
    return ideas.filter(idea => ideaIds.includes(idea.id))
      .sort((a, b) => a.order - b.order);
  };

  // Initialize column refs
  useEffect(() => {
    // Make sure untagged column always has a reference
    columnRefs.current.untagged = columnRefs.current.untagged || React.createRef();

    // Make sure 'all' column has a reference for non-grouped view
    columnRefs.current.all = columnRefs.current.all || React.createRef();

    // Make sure each tag has a reference
    tags.forEach(tag => {
      if (!columnRefs.current[tag.id]) {
        columnRefs.current[tag.id] = React.createRef();
      }
    });
    
    console.log("Column refs updated:", Object.keys(columnRefs.current));
  }, [tags]);

  // Load ideas from Firebase on startup - modified to handle multiple columns
  useEffect(() => {
    try {
      // Use the same ordering as our refresh queries to ensure consistent results
      const q = query(ideasRef, orderBy('updatedAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        // Skip if we're currently updating to avoid loops
        if (isUpdatingRef.current) return;

        try {
          const ideasData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          console.log(`Initial load: fetched ${ideasData.length} ideas`);

          // Only update state if we're not in the middle of creating a new idea
          if (!isUpdatingRef.current) {
            setIdeas(ideasData);
          }

          // Only update the editor content on initial load
          if (isInitialLoad) {
            setIsInitialLoad(false);
            // Using the hook version of cleanupEmptyIdeas
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

  // Set default focused idea when ideas are first loaded
  useEffect(() => {
    // Only set a default focused idea if we have ideas and none is currently focused
    if (ideas.length > 0 && !focusedIdeaId) {
      // Sort ideas by creation time - newest first
      const sortedIdeas = [...ideas].sort((a, b) => {
        const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA; // Newest first
      });

      // Focus the newest idea
      setFocusedIdeaId(sortedIdeas[0]?.id);
    }
  }, [ideas, focusedIdeaId]);

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

          // Default to having all tags selected
          const newSelectedTags = { ...selectedTags };
          tagsData.forEach(tag => {
            newSelectedTags[tag.id] = true;
          });
          setSelectedTags(newSelectedTags);
          setSelectionState('all');

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
      console.log('Setting up idea-tags relationship listener');
      const unsubscribe = onSnapshot(ideaTagsRef, (snapshot) => {
        try {
          // Get all idea-tag relationships
          const relationships = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          console.log(`Loaded ${relationships.length} idea-tag relationships`);

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
          console.log(`Found ${untagged.length} untagged ideas out of ${ideas.length} total ideas`);
          setUntaggedIdeas(untagged);

          // Force initialize columns to ensure they reflect the current state
          setTimeout(() => {
            // Initialize untagged column
            initializeColumnContent('untagged', untagged);
            
            // Initialize tag columns
            tags.forEach(tag => {
              if (columnRefs.current[tag.id] && tagToIdeas[tag.id]) {
                const taggedIdeas = ideas.filter(idea => 
                  tagToIdeas[tag.id].includes(idea.id)
                );
                initializeColumnContent(tag.id, taggedIdeas);
              }
            });
            
            // Initialize all ideas column if needed
            if (columnRefs.current.all) {
              initializeColumnContent('all', ideas);
            }
          }, 100);
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

    // If not grouping by tag and in vertical view, show all ideas in one column
    if (viewLayout === 'vertical' && !groupByTag) {
      // Initialize the 'all' column with all ideas
      initializeColumnContent('all', ideas);
    } else {
      // Initialize editor content for each column
      initializeColumnContent('untagged', untaggedIdeas);

      tags.forEach(tag => {
        const taggedIdeas = getIdeasByTag(tag.id);
        initializeColumnContent(tag.id, taggedIdeas);
      });
    }
  }, [ideas, tags, untaggedIdeas, tagIdeasMap, isInitialLoad, groupByTag, viewLayout, sortBy, sortOrder]);

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

      /* Edit mode styles */
      .edit-mode-active {
        background-color: rgba(30, 30, 30, 0.5) !important;
        padding: 12px !important;
        line-height: 1.6 !important;
      }
      
      .edit-mode-active .idea-item {
        background-color: transparent !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        cursor: text !important;
        color: rgba(255, 255, 255, 0.9) !important;
        display: inline !important;
        text-align: left !important;
      }
      
      .edit-mode-active .idea-item::after {
        content: '\\A';
        white-space: pre;
      }
      
      .edit-mode-active .idea-item:last-child::after {
        content: '';
      }
      
      .edit-mode-active .idea-item-focused,
      .edit-mode-active .idea-item:hover {
        background-color: transparent !important;
      }
      
      .edit-textarea {
        color: white !important;
        text-align: left !important;
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
    
    // Check if the column is in edit mode
    const isEditMode = columnRef.current.getAttribute('data-edit-mode') === 'true';
    
    // When a column gets focus, ensure it has a valid .idea-item, especially if it's empty
    if (isEditMode && columnRef.current.childNodes.length === 0) {
      // Create a placeholder div
      const placeholderDiv = document.createElement('div');
      placeholderDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 hover:bg-white/[2%] rounded-lg cursor-text';
      placeholderDiv.style.color = 'rgba(255, 255, 255, 0.3)';
      placeholderDiv.setAttribute('data-idea-id', 'placeholder');
      placeholderDiv.textContent = 'Add ideas';
      columnRef.current.appendChild(placeholderDiv);
      
      // Focus the placeholder
      placeholderDiv.focus();
    }
  };

  // Handle column blur - modified to prevent unwanted sync
  const handleBlur = (columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;
    
    // Check if the column is in edit mode
    const isEditMode = columnRef.current.getAttribute('data-edit-mode') === 'true';
    if (!isEditMode) return;
    
    // When focus leaves a column, clean up:
    // 1. Remove any placeholder divs if they weren't typed into
    // 2. Remove any empty temp divs
    
    setTimeout(() => {
      // Need to do this after a timeout to avoid race conditions with focus changes
      
      // Get the current active element to see if focus is still in this column
      const activeElement = document.activeElement;
      let insideColumn = columnRef.current.contains(activeElement);
      
      // If focus isn't inside this column anymore
      if (!insideColumn) {
        // Clean up temp divs with no content
        const tempDivs = columnRef.current.querySelectorAll('.idea-item[data-idea-id^="temp-"]');
        tempDivs.forEach(div => {
          if (!div.textContent.trim()) {
            div.remove();
          }
        });
        
        // Save all edited content
        handleChange(columnType, columnId);
      }
    }, 100);
  };

  // Create a new idea in Firebase
  const handleCreateNewIdea = async (content, tagId = null, insertAfterIndex = -1) => {
    try {
      console.log(`Creating new idea with content: ${content}, tagId: ${tagId}`);
      // Create the idea using our hook
      const newIdea = await firebase.createIdea(content, tagId);
      
      if (!newIdea) {
        console.error("Failed to create idea - no result returned");
        return null;
      }
      
      const newIdeaId = newIdea.id;
      console.log(`New idea created with ID: ${newIdeaId}`, newIdea);
      
      // UI updates for real-time feedback
      const columnToUpdate = tagId 
        ? columnRefs.current[tagId]
        : (viewLayout === 'vertical' && !groupByTag
            ? columnRefs.current.all
            : columnRefs.current.untagged);
            
      if (columnToUpdate && columnToUpdate.current) {
        const placeholder = columnToUpdate.current.querySelector('[data-idea-id="placeholder"]');
        if (placeholder) {
          // Replace placeholder
          const ideaDiv = document.createElement('div');
          ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-pointer';
          ideaDiv.setAttribute('data-idea-id', newIdeaId);
          ideaDiv.innerHTML = content || '';
          placeholder.parentNode.replaceChild(ideaDiv, placeholder);
          
          // Add click handler for selection
          ideaDiv.addEventListener('click', () => {
            // Set this idea as the focused idea
            setFocusedIdeaId(newIdeaId);
            
            // Apply focused styling to this idea only
            const allIdeas = document.querySelectorAll('.idea-item');
            allIdeas.forEach(item => {
              item.classList.remove('idea-item-focused');
              item.classList.remove('bg-neutral-800');
              item.classList.remove('text-white');
              item.classList.add('text-white/60');
            });
            
            ideaDiv.classList.add('idea-item-focused');
            ideaDiv.classList.add('bg-neutral-800');
            ideaDiv.classList.add('text-white');
            ideaDiv.classList.remove('text-white/60');
          });
        } else {
          // Add new idea to the column
          const ideaDiv = document.createElement('div');
          ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-pointer';
          ideaDiv.setAttribute('data-idea-id', newIdeaId);
          ideaDiv.innerHTML = content || '';
          columnToUpdate.current.appendChild(ideaDiv);
          
          // Add click handler for selection
          ideaDiv.addEventListener('click', () => {
            // Set this idea as the focused idea
            setFocusedIdeaId(newIdeaId);
            
            // Apply focused styling to this idea only
            const allIdeas = document.querySelectorAll('.idea-item');
            allIdeas.forEach(item => {
              item.classList.remove('idea-item-focused');
              item.classList.remove('bg-neutral-800');
              item.classList.remove('text-white');
              item.classList.add('text-white/60');
            });
            
            ideaDiv.classList.add('idea-item-focused');
            ideaDiv.classList.add('bg-neutral-800');
            ideaDiv.classList.add('text-white');
            ideaDiv.classList.remove('text-white/60');
          });
        }
      } else {
        console.warn(`Column not found for update: ${tagId ? tagId : 'untagged'}`);
      }
      
      // Force a refresh of ideas from Firestore after a small delay
      setTimeout(async () => {
        // Force a refresh by setting a flag and triggering a re-render
        console.log('Triggering data refresh after creating a new idea');
        const ideasQuery = query(ideasRef, orderBy('updatedAt', 'desc'));
        getDocs(ideasQuery).then(snapshot => {
          const refreshedIdeas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log(`Fetched ${refreshedIdeas.length} ideas directly`);
          setIdeas(refreshedIdeas);
        }).catch(error => {
          console.error('Error refreshing ideas:', error);
        });
      }, 500);
      
      return newIdeaId;
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

      // Create new tag in Firebase using our hook
      const newTagRef = await firebase.addTag({
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
  const handleAddTagToIdea = async (tagId, ideaId) => {
    if (!tagId || !ideaId) {
      console.error("Missing tagId or ideaId in handleAddTagToIdea");
      return;
    }

    try {
      // Use the firebase hook to add the tag
      await firebase.addTagToIdea(tagId, ideaId);

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
            ideaDiv.innerHTML = stripHtmlAndDecodeEntities(idea.content) || '';
            placeholder.parentNode.replaceChild(ideaDiv, placeholder);
          } else {
            // Append the idea to the column
            const ideaDiv = document.createElement('div');
            ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
            ideaDiv.setAttribute('data-idea-id', ideaId);
            ideaDiv.innerHTML = stripHtmlAndDecodeEntities(idea.content) || '';
            columnRef.current.appendChild(ideaDiv);
          }
        }
      }
    } catch (error) {
      console.error("Error adding tag to idea:", error);
    }
  };

  // Remove tag from idea
  const handleRemoveTagFromIdea = async (tagId, ideaId) => {
    if (!tagId || !ideaId) {
      console.error("Missing tagId or ideaId in handleRemoveTagFromIdea");
      return;
    }

    try {
      // Use the firebase hook to remove the tag
      await firebase.removeTagFromIdea(tagId, ideaId);

      // Update tag column immediately for better UX
      const columnRef = columnRefs.current[tagId];
      if (columnRef && columnRef.current) {
        // Find and remove the idea div from this column
        const ideaDiv = columnRef.current.querySelector(`[data-idea-id="${ideaId}"]`);
        if (ideaDiv) {
          ideaDiv.remove();
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
      await handleAddTagToIdea(tagId, focusedIdeaId);

      // Clear input and hide the tag input component
      setTagInputValue('');
      setTagInputVisible(false);
    } catch (error) {
      console.error("Error in handleAddTag:", error);
      // Don't hide the input on error so user can try again
    }
  };

  // Handle removing tags from focused idea
  const handleRemoveTag = async (tagId) => {
    if (!focusedIdeaId) return;
    
    try {
      // Use our handleRemoveTagFromIdea function
      await handleRemoveTagFromIdea(tagId, focusedIdeaId);
    } catch (error) {
      console.error("Error removing tag:", error);
    }
  };

  // Handle input changes for any column
  const handleChange = async (columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];
    
    if (!columnRef || !columnRef.current) return;
    
    // Check if the column is in edit mode - only process changes in edit mode
    const isEditMode = columnRef.current.getAttribute('data-edit-mode') === 'true';
    if (!isEditMode) return;

    // In edit mode, we treat all ideas as one continuous document with ideas separated by line breaks
    // We need to map each line to the appropriate idea div

    // Step 1: Get all existing idea elements
    const ideaDivs = Array.from(columnRef.current.querySelectorAll('.idea-item'));
    
    // Step 2: Each div represents an idea, we need to update the content in each
    let changedIdeas = [];
    
    // Process each idea div
    for (let i = 0; i < ideaDivs.length; i++) {
      const ideaDiv = ideaDivs[i];
      const ideaId = ideaDiv.getAttribute('data-idea-id');
      
      // Skip placeholder
      if (ideaId === 'placeholder') continue;
      
      // Get the content
      const content = ideaDiv.innerHTML.trim();
      const plainContent = stripHtmlAndDecodeEntities(content).trim();
      
      // For empty ideas, we'll delete them later in cleanup
      if (!plainContent) continue;
      
      // For temp IDs, create a new idea
      if (ideaId.startsWith('temp-')) {
        if (plainContent) {
          const newTagId = columnType === 'tag' ? columnId : null;
          const newIdeaId = await handleCreateNewIdea(content, newTagId);
          
          // Update the div with the real ID
          ideaDiv.setAttribute('data-idea-id', newIdeaId);
          
          changedIdeas.push({
            id: newIdeaId,
            content: plainContent
          });
        }
      } else {
        // Existing idea - check for content changes
        const existingIdea = ideas.find(idea => idea.id === ideaId);
        if (existingIdea) {
          const existingContent = stripHtmlAndDecodeEntities(existingIdea.content || '').trim();
          
          if (plainContent !== existingContent) {
            // Content has changed, update in database
            await handleUpdateIdeaContent(ideaId, content);
            
            changedIdeas.push({
              id: ideaId,
              content: plainContent
            });
          }
        }
      }
    }
    
    // Clean up ideas with empty content
    if (changedIdeas.length > 0) {
      handleCleanupEmptyIdeas(changedIdeas);
    }
  };

  // Helper function to add idea to a column if it doesn't exist
  const addIdeaToColumn = (columnElement, ideaId, content) => {
    const existingIdea = columnElement.querySelector(`[data-idea-id="${ideaId}"]`);
    if (!existingIdea) {
      // Check if there's a placeholder to replace
      const placeholder = columnElement.querySelector('[data-idea-id="placeholder"]');
      if (placeholder) {
        // Replace placeholder with the idea
        const ideaDiv = document.createElement('div');
        ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
        ideaDiv.setAttribute('data-idea-id', ideaId);
        ideaDiv.innerHTML = content || '';
        placeholder.parentNode.replaceChild(ideaDiv, placeholder);
      } else {
        // Add the idea to the column
        const ideaDiv = document.createElement('div');
        ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
        ideaDiv.setAttribute('data-idea-id', ideaId);
        ideaDiv.innerHTML = content || '';
        columnElement.appendChild(ideaDiv);
      }
    }
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
        safelyAddRange(selection, savedRange);
      } catch (e) {
        console.debug("Couldn't restore selection after ensuring idea divs");
      }
    }
  };

  // Add a helper function to safely add ranges to selection
  const safelyAddRange = (selection, range) => {
    if (!selection || !range) return;
    
    try {
      selection.addRange(range);
    } catch (error) {
      // Silently handle "The given range isn't in document" errors
      console.debug("Could not add range to selection:", error.message);
    }
  };

  // Listen for keydown events in any column
  const handleKeyDown = async (e, columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;
    
    // Check if the column is in edit mode - only process keydown in edit mode
    const isEditMode = columnRef.current.getAttribute('data-edit-mode') === 'true';
    if (!isEditMode) return;

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
        if (ideaId && !ideaId.startsWith('temp-') && ideaId !== 'placeholder') {
          const content = currentDiv.textContent.trim();
          
          if (content === '' || range.startOffset === 0) {
            // Delete the empty idea
            e.preventDefault();
            await handleDeleteIdea(ideaId);
            
            // Find previous sibling idea to focus
            let prevIdea = currentDiv.previousElementSibling;
            if (prevIdea && prevIdea.classList.contains('idea-item')) {
              prevIdea.focus();
              setCursorAtEnd(prevIdea);
            }
            
            return;
          }
        }
      }
    }

    // Handle enter key to create a new idea
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Stop default behavior of createRange
      suppressSelectionChangeRef.current = true;
      
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      
      // Find the containing idea-item div
      let currentDiv = range.startContainer;
      while (currentDiv && (!currentDiv.classList || !currentDiv.classList.contains('idea-item'))) {
        currentDiv = currentDiv.parentNode;
      }
      
      if (currentDiv) {
        const ideaId = currentDiv.getAttribute('data-idea-id');
        
        // Handle creating new idea after this one
        const ideaDivs = Array.from(columnRef.current.querySelectorAll('.idea-item'));
        const currentIndex = ideaDivs.indexOf(currentDiv);
        
        // Create a new temp idea div to insert after the current one
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newIdeaDiv = document.createElement('div');
        newIdeaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
        newIdeaDiv.setAttribute('data-idea-id', tempId);
        
        // If we're at the end of a line or the cursor isn't at the beginning,
        // split the text and put the rest in the new div
        if (range.startOffset > 0 || range.startContainer !== currentDiv.firstChild) {
          // Save the selection
          const selectedRange = range.cloneRange();
          
          // Split the text at cursor position
          selectedRange.setEndAfter(currentDiv.lastChild);
          const extractedText = selectedRange.extractContents();
          
          // Check if we extracted any content
          if (extractedText.textContent.trim()) {
            newIdeaDiv.appendChild(extractedText);
          }
        }
        
        // Insert the new div after the current one
        if (currentDiv.nextSibling) {
          currentDiv.parentNode.insertBefore(newIdeaDiv, currentDiv.nextSibling);
        } else {
          currentDiv.parentNode.appendChild(newIdeaDiv);
        }
        
        // Focus the new div
        newIdeaDiv.focus();
        
        // Wait a moment, then try to create a permanent idea for the current div if needed
        setTimeout(() => {
          // Only create a permanent idea if it's a temporary one with content
          if (ideaId && ideaId.startsWith('temp-') && currentDiv.textContent.trim()) {
            const newTagId = columnType === 'tag' ? columnId : null;
            handleCreateNewIdea(currentDiv.innerHTML, newTagId, currentIndex);
          }
          
          // Reset the selection change suppression
          suppressSelectionChangeRef.current = false;
          
          selection.removeAllRanges();
          safelyAddRange(selection, range);
        }, 50);
      }
    }
  };

  // Handle keypress in paragraphs with placeholders
  const handleKeyPress = (e, columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;
    
    // Check if the column is in edit mode - only process keypress in edit mode
    const isEditMode = columnRef.current.getAttribute('data-edit-mode') === 'true';
    if (!isEditMode) return;

    // Check if this is a placeholder being typed into
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Find the containing element
    let currentDiv = range.startContainer;
    while (currentDiv && (!currentDiv.classList || !currentDiv.classList.contains('idea-item'))) {
      currentDiv = currentDiv.parentNode;
      if (!currentDiv) return;
    }
    
    if (currentDiv.getAttribute('data-idea-id') === 'placeholder') {
      // Clear the placeholder text on first keystroke
      e.preventDefault();
      currentDiv.textContent = '';
      currentDiv.setAttribute('data-idea-id', `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      
      // Reset styles
      currentDiv.style.color = '';
      currentDiv.classList.add('text-white');
      
      // Re-insert the key that was pressed
      const textNode = document.createTextNode(e.key);
      currentDiv.appendChild(textNode);
      
      // Set cursor at end
      const newRange = document.createRange();
      newRange.setStartAfter(textNode);
      newRange.collapse(true);
      
      selection.removeAllRanges();
      safelyAddRange(selection, newRange);
    }
  };

  // Handle paste event to strip formatting
  const handlePaste = (e, columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];

    if (!columnRef || !columnRef.current) return;
    
    // Check if the column is in edit mode - only process paste in edit mode
    const isEditMode = columnRef.current.getAttribute('data-edit-mode') === 'true';
    if (!isEditMode) return;

    // Prevent default paste behavior
    e.preventDefault();
    
    // Get plain text from clipboard
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    
    // Insert at cursor position
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Find the containing idea-item div
    let currentDiv = range.startContainer;
    while (currentDiv && (!currentDiv.classList || !currentDiv.classList.contains('idea-item'))) {
      currentDiv = currentDiv.parentNode;
      if (!currentDiv) return;
    }
    
    // Handle paste into placeholder
    if (currentDiv.getAttribute('data-idea-id') === 'placeholder') {
      // Clear the placeholder and set a temporary ID
      currentDiv.textContent = text;
      currentDiv.setAttribute('data-idea-id', `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      
      // Reset styles
      currentDiv.style.color = '';
      
      // Set cursor at end
      setCursorAtEnd(currentDiv);
      return;
    }
    
    // Insert the text at the cursor position
    document.execCommand('insertText', false, text);
    
    // Make sure the change is saved
    handleChange(columnType, columnId);
  };

  // Handle tag input change
  const handleTagInputChange = (e) => {
    // Prevent event propagation to avoid triggering syncColumnIdeasWithDOM
    e.stopPropagation();
    setTagInputValue(e.target.value);
    // Don't force focus here - it's causing typing issues
  };

  // Handle tag input key down events
  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Only add if there's actual content
      if (tagInputValue.trim()) {
        handleAddTag(tagInputValue.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTagInputVisible(false);
      setTagInputValue('');
    }
    
    // Prevent propagation but don't interfere with normal keyboard behavior
    e.stopPropagation();
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

  // Update selection state when tags change
  useEffect(() => {
    updateSelectionState(selectedTags);
  }, [tags, updateSelectionState, selectedTags]);

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
        const newIdeaId = await handleCreateNewIdea('', tagId);

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
              
              // Create the element to focus
              let ideaToFocus = firstIdea;

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

                // Set this as the element to focus
                ideaToFocus = newDiv;
              }

              // Focus the div and set the caret
              ideaToFocus.focus();

              // Make sure it has a child for the selection
              if (!ideaToFocus.firstChild) {
                const textNode = document.createTextNode('\u00A0');
                ideaToFocus.appendChild(textNode);
              }

              // Create a selection at the beginning
              const range = document.createRange();
              range.setStart(ideaToFocus.firstChild, 0);
              range.setEnd(ideaToFocus.firstChild, 0);

              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);

              // Add focus styling
              ideaToFocus.classList.remove('text-white/60');
              ideaToFocus.classList.add('text-white');
              ideaToFocus.classList.add('idea-item-focused');
              ideaToFocus.classList.add('bg-neutral-800');

              // Set this as the focused idea
              setFocusedIdeaId(newIdeaId);

              // Scroll into view if needed
              ideaToFocus.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                ideaDiv.innerHTML = stripHtmlAndDecodeEntities(idea.content) || '';
                placeholder.parentNode.replaceChild(ideaDiv, placeholder);
              } else {
                // Append the idea to the untagged column if it doesn't already exist
                if (!untaggedRef.current.querySelector(`[data-idea-id="${ideaId}"]`)) {
                  const ideaDiv = document.createElement('div');
                  ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-text';
                  ideaDiv.setAttribute('data-idea-id', ideaId);
                  ideaDiv.innerHTML = stripHtmlAndDecodeEntities(idea.content) || '';
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
    const columnRef = columnRefs.current[columnId];
    if (!columnRef || !columnRef.current) {
      console.warn(`No column ref found for ${columnId}`);
      return;
    }

    // Check if the column is in edit mode
    const isEditMode = columnRef.current.getAttribute('data-edit-mode') === 'true';
    
    // Don't modify the DOM if in edit mode - the textarea handles content
    if (isEditMode) {
      console.log(`Skipping initialization of ${columnId} because it's in edit mode`);
      return;
    }

    console.log(`Initializing column ${columnId} with ${columnIdeas.length} ideas`);

    // Clear the current content
    columnRef.current.innerHTML = '';

    // Remember the focused div id so we can restore focus later
    const focusedDivId = focusedIdeaId;

    // Get the focusedIdea if we have one
    const focusedIdea = focusedIdeaId ? ideas.find(idea => idea.id === focusedIdeaId) : null;

    if (columnIdeas.length > 0) {
      // Sort ideas based on the current sort options
      let sortedIdeas = [...columnIdeas];

      if (sortBy === 'time') {
        sortedIdeas = sortedIdeas.sort((a, b) => {
          const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      } else if (sortBy === 'alphabetical') {
        sortedIdeas = sortedIdeas.sort((a, b) => {
          const contentA = stripHtmlAndDecodeEntities(a.content || '').toLowerCase();
          const contentB = stripHtmlAndDecodeEntities(b.content || '').toLowerCase();
          return sortOrder === 'asc'
            ? contentA.localeCompare(contentB)
            : contentB.localeCompare(contentA);
        });
      }

      console.log(`Rendering ${sortedIdeas.length} sorted ideas in column ${columnId}`);
      sortedIdeas.forEach((idea, idx) => {
        console.log(`  Idea ${idx + 1}: ${idea.id} - ${idea.content.substring(0, 20) || '[empty]'}`);
      });

      // In view mode, use the button-like styling
      sortedIdeas.forEach(idea => {
        const ideaDiv = document.createElement('div');
        
        // Make it function like a button
        ideaDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 text-white/60 hover:bg-white/[2%] rounded-lg cursor-pointer';
        
        // Add a click handler for selection
        ideaDiv.addEventListener('click', () => {
          // Set this idea as the focused idea
          setFocusedIdeaId(idea.id);
          
          // Apply focused styling to this idea only
          const allIdeas = document.querySelectorAll('.idea-item');
          allIdeas.forEach(item => {
            item.classList.remove('idea-item-focused');
            item.classList.remove('bg-neutral-800');
            item.classList.remove('text-white');
            item.classList.add('text-white/60');
          });
          
          ideaDiv.classList.add('idea-item-focused');
          ideaDiv.classList.add('bg-neutral-800');
          ideaDiv.classList.add('text-white');
          ideaDiv.classList.remove('text-white/60');
        });

        // Apply focus styling if this was the focused idea
        if (idea.id === focusedDivId || idea.id === focusedIdeaId) {
          ideaDiv.classList.add('idea-item-focused');
          ideaDiv.classList.add('bg-neutral-800');
          ideaDiv.classList.add('text-white');
          ideaDiv.classList.remove('text-white/60');
        }

        ideaDiv.setAttribute('data-idea-id', idea.id);
        ideaDiv.innerHTML = stripHtmlAndDecodeEntities(idea.content) || '';
        columnRef.current.appendChild(ideaDiv);
      });
    } else {
      console.log(`Adding placeholder to empty column ${columnId}`);
      // Add placeholder as a DOM element for empty columns
      const placeholderDiv = document.createElement('div');
      placeholderDiv.className = 'idea-item flex justify-center items-center p-2 pb-3 hover:bg-white/[2%] rounded-lg cursor-pointer';
      placeholderDiv.style.color = 'rgba(255, 255, 255, 0.3)';
      placeholderDiv.textContent = 'No ideas yet';
      placeholderDiv.setAttribute('data-idea-id', 'placeholder');
      columnRef.current.appendChild(placeholderDiv);
    }

    // If this column has the focused item, try to focus it
    if (focusedDivId) {
      const focusedElem = columnRef.current.querySelector(`[data-idea-id="${focusedDivId}"]`);
      if (focusedElem) {
        setTimeout(() => {
          focusedElem.focus();
          setCursorAtEnd(focusedElem);
        }, 10);
      }
    }
  };

  // Get the focused idea object
  const focusedIdea = ideas.find(idea => idea.id === focusedIdeaId) || null;

  // Track focused idea for sidebar
  const handleSelectionChange = () => {
    // Skip selection change if suppressed (needed during Enter key handling)
    if (suppressSelectionChangeRef.current) {
      return;
    }

    // Check if any column is in edit mode - if so, do nothing
    // This completely separates edit mode from the context sidebar
    const isAnyColumnInEditMode = Object.values(columnRefs.current).some(ref => 
      ref && ref.current && ref.current.getAttribute('data-edit-mode') === 'true'
    );
    
    if (isAnyColumnInEditMode) {
      return; // Don't update the sidebar when in edit mode
    }

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
    // If any column is in edit mode with unsaved changes, prevent tab switching
    if (isAnyColumnEditing) {
      console.log("Cannot switch tabs while editing a column");
      return;
    }
    
    // Toggle the tab (close if clicking on active tab)
    setActiveTab(activeTab === tabName ? null : tabName);
  };

  // Clean up empty ideas on page refresh - Using hook version now
  // This local implementation is removed in favor of the hook version

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
    // Remove the forced focus that's causing typing issues
  };

  // Handle note input key down events
  const handleNoteInputKeyDown = (e) => {
    // Prevent event propagation but allow normal keyboard behavior
    e.stopPropagation();
    
    if ((e.key === 'Enter' && e.ctrlKey) || (e.key === 'Enter' && e.metaKey)) {
      e.preventDefault();
      
      // Only add if there's actual content
      if (noteInputValue.trim()) {
        handleAddNote();
      }
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

  // Handle group by tag toggle
  const handleGroupByTagToggle = () => {
    // Only allow toggling when in vertical view
    if (viewLayout === 'vertical') {
      setGroupByTag(!groupByTag);
    }
  };

  // Handle sort by change
  const handleSortByChange = (sortType) => {
    // If clicking on the already selected sort option, toggle the sort order
    if (sortType === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Otherwise, change the sort type (default to descending for time, ascending for alphabetical)
      setSortBy(sortType);
      setSortOrder(sortType === 'time' ? 'desc' : 'asc');
    }
  };

  // Handle sort order toggle
  const handleSortOrderToggle = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  // Handle title edit change
  const handleTitleEditChange = (e) => {
    setTitleEditValue(e.target.value);
  };

  // Handle title edit keydown
  const handleTitleEditKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await saveTitleEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelTitleEdit();
    }
  };

  // Start editing title
  const startTitleEdit = () => {
    if (!focusedIdea) return;

    // Set current content as initial value
    setTitleEditValue(stripHtmlAndDecodeEntities(focusedIdea.content));
    setIsTitleEditing(true);

    // Focus the input after a brief delay
    setTimeout(() => {
      if (titleEditRef.current) {
        titleEditRef.current.focus();
        titleEditRef.current.select();
      }
    }, 50);
  };

  // Save title edit
  const saveTitleEdit = async () => {
    if (!focusedIdeaId || !titleEditValue.trim()) return;

    try {
      // Clean the content
      const cleanContent = stripHtmlAndDecodeEntities(titleEditValue.trim());

      // Update in Firestore
      await updateDoc(doc(db, 'ideas', focusedIdeaId), {
        content: cleanContent,
        updatedAt: new Date()
      });

      // Also update locally for immediate feedback
      setIdeas(prev => prev.map(idea =>
        idea.id === focusedIdeaId
          ? { ...idea, content: cleanContent, updatedAt: new Date() }
          : idea
      ));

      // Update UI in all columns where this idea appears
      updateIdeaInAllColumns(focusedIdeaId, cleanContent);

      // Exit edit mode
      setIsTitleEditing(false);
    } catch (error) {
      console.error("Error updating idea title:", error);
    }
  };

  // Cancel title edit
  const cancelTitleEdit = () => {
    setIsTitleEditing(false);
    setTitleEditValue('');
  };

  // Update idea content in all columns
  const updateIdeaInAllColumns = (ideaId, newContent) => {
    // Clean content once to avoid repeated parsing
    const cleanContent = stripHtmlAndDecodeEntities(newContent);

    // Update in all columns where this idea appears
    Object.keys(columnRefs.current).forEach(columnId => {
      const columnRef = columnRefs.current[columnId];
      if (columnRef && columnRef.current) {
        const ideaDiv = columnRef.current.querySelector(`[data-idea-id="${ideaId}"]`);
        if (ideaDiv) {
          ideaDiv.innerHTML = cleanContent;
        }
      }
    });
  };

  // Re-initialize columns when sort settings change
  useEffect(() => {
    if (ideas.length === 0 || isInitialLoad || isUpdatingRef.current) return;

    // Re-initialize all columns based on current grouping and sort settings
    if (viewLayout === 'vertical' && !groupByTag) {
      initializeColumnContent('all', ideas);
    } else {
      initializeColumnContent('untagged', untaggedIdeas);

      getTagsWithIdeas().forEach(tag => {
        if (selectedTags[tag.id]) {
          const taggedIdeas = getIdeasByTag(tag.id);
          initializeColumnContent(tag.id, taggedIdeas);
        }
      });
    }
  }, [sortBy, sortOrder]);

  // New useEffect to handle view layout changes
  useEffect(() => {
    // Skip if no ideas or still initializing
    if (ideas.length === 0 || isInitialLoad) return;

    // When switching layouts, ensure proper synchronization of ideas
    // Collect all tagged idea IDs
    const taggedIdeaIds = new Set();
    Object.keys(tagIdeasMap).forEach(tagId => {
      (tagIdeasMap[tagId] || []).forEach(ideaId => {
        taggedIdeaIds.add(ideaId);
      });
    });

    // Find ideas with no tags and update untaggedIdeas
    const untagged = ideas.filter(idea => !taggedIdeaIds.has(idea.id));
    setUntaggedIdeas(untagged);

    // Initialize the appropriate columns based on current layout mode
    if (viewLayout === 'vertical' && !groupByTag) {
      // In vertical layout without grouping, show all ideas in the "all" column
      initializeColumnContent('all', ideas);
    } else {
      // In horizontal layout or vertical with grouping, display by tags
      // Initialize untagged column
      initializeColumnContent('untagged', untagged);

      // Initialize tag columns if they're selected
      getTagsWithIdeas().forEach(tag => {
        if (selectedTags[tag.id]) {
          const taggedIdeas = getIdeasByTag(tag.id);
          initializeColumnContent(tag.id, taggedIdeas);
        }
      });
    }
  }, [viewLayout, groupByTag, ideas, tagIdeasMap, isInitialLoad]);

  // Update global tag counts whenever untaggedIdeas or ideas change
  useEffect(() => {
    // Skip if no ideas or still initializing
    if (ideas.length === 0 || isInitialLoad) return;

    // Calculate the total number of ideas in tags
    let taggedCount = 0;
    const seenIdeaIds = new Set();

    // Count each idea only once, even if it has multiple tags
    Object.keys(tagIdeasMap).forEach(tagId => {
      (tagIdeasMap[tagId] || []).forEach(ideaId => {
        if (!seenIdeaIds.has(ideaId)) {
          seenIdeaIds.add(ideaId);
          taggedCount++;
        }
      });
    });

    // Add untagged ideas count
    const totalCount = taggedCount + untaggedIdeas.length;

    // Update the global tag counts with the total
    setGlobalTagCounts(prev => ({
      ...prev,
      total: totalCount
    }));
  }, [untaggedIdeas, ideas, tagIdeasMap, isInitialLoad]);

  // Load creative brief from localStorage only during testing phase
  useEffect(() => {
    try {
      // Just load from localStorage during testing phase
      const savedBrief = localStorage.getItem('creativeBrief');
      if (savedBrief) {
        console.log("Using brief from localStorage for testing phase");
        setBriefValue(savedBrief);
        setBriefSaveStatus('local');
      }
    } catch (error) {
      console.error("Error loading brief:", error);
    }
  }, []);

  // Handle brief input change - simplified for testing phase
  const handleBriefChange = (e) => {
    const newValue = e.target.value;
    setBriefValue(newValue);
    
    // For testing phase, just save to localStorage
    localStorage.setItem('creativeBrief', newValue);
    setBriefSaveStatus('local');
  };

  // Function to save brief - simplified for testing phase
  const forceSaveBrief = async () => {
    try {
      setBriefSaveStatus('saving');
      
      // For testing phase, just save to localStorage
      localStorage.setItem('creativeBrief', briefValue);
      
      setTimeout(() => {
        setBriefSaveStatus('local');
      }, 500);
    } catch (error) {
      console.error("Error saving brief:", error);
      setBriefSaveStatus('error');
    }
  };

  // Reinitialize column content when tag selection changes
  useEffect(() => {
    // Skip on first render
    if (isInitialLoad) return;

    // Reinitialize content for untagged column if it's selected
    if (selectedTags['untagged']) {
      initializeColumnContent('untagged', untaggedIdeas);
    }

    // Reinitialize content for each selected tag
    tags.forEach(tag => {
      if (selectedTags[tag.id]) {
        const taggedIdeas = getIdeasByTag(tag.id);
        initializeColumnContent(tag.id, taggedIdeas);
      }
    });
  }, [selectedTags, untaggedIdeas, tagIdeasMap, isInitialLoad, tags, getIdeasByTag, initializeColumnContent]);

  // Clean up empty ideas
  const handleCleanupEmptyIdeas = async (ideasData) => {
    try {
      const emptyIdeas = ideasData.filter(idea => {
        // Check if content is empty or just whitespace/non-breaking space
        const content = idea.content || '';
        const strippedContent = content.replace(/&nbsp;|\u00A0|\s/g, '');
        return strippedContent === '';
      });

      if (emptyIdeas.length > 0) {
        console.log(`Cleaning up ${emptyIdeas.length} empty ideas`);

        // Delete all empty ideas
        for (const idea of emptyIdeas) {
          await deleteIdea(idea.id);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error cleaning up empty ideas:", error);
      return false;
    }
  };

  // Update idea content in Firebase
  const handleUpdateIdeaContent = async (ideaId, content) => {
    if (!ideaId) return false;
    
    try {
      // Use the hook version to update the content
      const result = await updateIdeaContent(ideaId, content);
      
      // Update UI in all columns where this idea appears
      if (result) {
        updateIdeaInAllColumns(ideaId, content);
      }
      
      return result;
    } catch (error) {
      console.error("Error updating idea content:", error);
      return false;
    }
  };

  // Delete an idea
  const handleDeleteIdea = async (ideaId) => {
    try {
      // Use the hook version to delete the idea
      const result = await deleteIdea(ideaId);
      
      // Additional UI cleanup could be done here if needed
      
      return result;
    } catch (error) {
      console.error("Error deleting idea:", error);
      return false;
    }
  };

  // Fix the clearColumnContent function to properly handle all column types
  const clearColumnContent = (columnType, columnId) => {
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];
    
    if (columnRef && columnRef.current) {
      console.log(`Clearing content for ${columnType}:${columnId}`);
      columnRef.current.innerHTML = '';
    } else {
      console.warn(`Could not find column ref for ${columnType}:${columnId}`);
      console.log('Available refs:', Object.keys(columnRefs.current));
    }
  };

  // Update handleEditModeChange to use the fixed clearColumnContent
  const handleEditModeChange = async (columnType, columnId, isEditMode, textareaContent) => {
    // Get the column reference
    const columnRef = columnType === 'untagged'
      ? columnRefs.current.untagged
      : columnRefs.current[columnId];
    
    // Update the global editing state to track if any column is being edited
    setIsAnyColumnEditing(isEditMode);
    
    if (columnRef && columnRef.current) {
      // Set the edit mode attribute on the column element
      columnRef.current.setAttribute('data-edit-mode', isEditMode);
      
      // If entering edit mode, clear the content so the textarea is the only child
      if (isEditMode) {
        console.log(`Entering edit mode for ${columnType}:${columnId}`);
        // Clear any focused idea to prevent context sidebar conflicts
        setFocusedIdeaId(null);
        
        // Close any open inputs in the sidebar
        if (tagInputVisible) {
          setTagInputVisible(false);
          setTagInputValue('');
        }
        
        if (noteInputVisible) {
          setNoteInputVisible(false);
          setNoteInputValue('');
        }
        
        clearColumnContent(columnType, columnId);
        return; // Exit early - don't reinitialize content when entering edit mode
      }
    }
    
    // Only process content when exiting edit mode with content
    if (!isEditMode && textareaContent !== undefined) {
      // User is exiting edit mode with content to process
      console.log(`Processing content from ${columnType}:${columnId}`);
      
      // Split the content by line breaks to get individual ideas
      const ideaContents = textareaContent.split('\n')
        .map(text => text.trim())
        .filter(text => text.length > 0);
      
      console.log(`Found ${ideaContents.length} ideas to process`);
      
      // Get the existing ideas for this column
      let columnIdeas = [];
      if (columnType === 'untagged') {
        columnIdeas = untaggedIdeas;
      } else if (columnType === 'tag') {
        columnIdeas = getIdeasByTag(columnId);
      } else if (columnType === 'all') {
        columnIdeas = ideas;
      }
      
      // Process all ideas
      const existingIdeaIds = columnIdeas.map(idea => idea.id);
      console.log(`Column has ${existingIdeaIds.length} existing ideas`);
      
      let index = 0;
      let updatedIdeas = false;
      
      // Create or update ideas
      for (const content of ideaContents) {
        if (index < existingIdeaIds.length) {
          // Update existing idea
          const ideaId = existingIdeaIds[index];
          console.log(`Updating idea ${ideaId} with content: ${content.substring(0, 20)}...`);
          await handleUpdateIdeaContent(ideaId, content);
          updatedIdeas = true;
        } else {
          // Create new idea
          const tagId = columnType === 'tag' ? columnId : null;
          console.log(`Creating new idea with content: ${content.substring(0, 20)}...`, `tagId: ${tagId}`);
          const newIdeaId = await handleCreateNewIdea(content, tagId);
          console.log(`New idea created with ID: ${newIdeaId}`);
          if (newIdeaId) {
            updatedIdeas = true;
          } else {
            console.error(`Failed to create new idea with content: ${content.substring(0, 20)}...`);
          }
        }
        index++;
      }
      
      // If there are fewer ideas in the textarea than in the database, delete the extras
      for (let i = index; i < existingIdeaIds.length; i++) {
        console.log(`Deleting extra idea ${existingIdeaIds[i]}`);
        await handleDeleteIdea(existingIdeaIds[i]);
        updatedIdeas = true;
      }
      
      // Force re-fetch of ideas from Firestore if updates were made
      if (updatedIdeas) {
        console.log('Updates were made, re-fetching ideas from Firestore');
        
        // Immediately update the local state with what we know
        if (columnType === 'tag' && tagId) {
          // We should manually trigger a fetch of the tag-idea relationships
          try {
            const ideaTagsQuery = query(ideaTagsRef);
            getDocs(ideaTagsQuery).then((snapshot) => {
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
              
              console.log('Updated tag-idea relationships', tagToIdeas);
              setTagIdeasMap(tagToIdeas);
              
              // Reinitialize columns with fresh data
              if (columnType === 'tag') {
                const taggedIdeas = ideas.filter(idea => 
                  tagToIdeas[tagId] && tagToIdeas[tagId].includes(idea.id)
                );
                console.log(`Reinitializing column ${tagId} with ${taggedIdeas.length} ideas based on fresh relationships`);
                initializeColumnContent(tagId, taggedIdeas);
              }
            }).catch(error => {
              console.error("Error fetching tag-idea relationships:", error);
            });
          } catch (error) {
            console.error("Error setting up tag-idea relationship query:", error);
          }
        }
        
        // Add a small delay to allow Firestore to update
        setTimeout(async () => {
          // Force a refresh by directly querying for new data
          console.log('Triggering data refresh after editing ideas');
          const ideasQuery = query(ideasRef, orderBy('updatedAt', 'desc'));
          getDocs(ideasQuery).then(snapshot => {
            const refreshedIdeas = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            console.log(`Fetched ${refreshedIdeas.length} ideas directly`);
            setIdeas(refreshedIdeas);
          }).catch(error => {
            console.error('Error refreshing ideas:', error);
          });
        }, 500);

        // Immediately reinitialize the columns with the latest data we have for better UX
        if (columnType === 'untagged') {
          // For untagged ideas, reinitialize with current data, will be updated later
          initializeColumnContent('untagged', untaggedIdeas);
        } else if (columnType === 'tag') {
          // For tagged ideas, get the current ideas with this tag to display
          const taggedIdeas = ideas.filter(idea => {
            // Check if this idea is associated with this tag
            const ideaIds = tagIdeasMap[columnId] || [];
            return ideaIds.includes(idea.id);
          });
          initializeColumnContent(columnId, taggedIdeas);
        } else if (columnType === 'all') {
          initializeColumnContent('all', ideas);
        }
      } else {
        // Re-initialize the column content with the updated data after saving
        if (columnType === 'untagged') {
          initializeColumnContent('untagged', untaggedIdeas);
        } else if (columnType === 'tag') {
          const taggedIdeas = ideas.filter(idea => {
            // Check if this idea is associated with this tag
            const ideaIds = tagIdeasMap[columnId] || [];
            return ideaIds.includes(idea.id);
          });
          initializeColumnContent(columnId, taggedIdeas);
        } else if (columnType === 'all') {
          initializeColumnContent('all', ideas);
        }
      }
    } else if (!isEditMode) {
      // Exiting edit mode without content to process (discarding)
      console.log(`Exiting edit mode (discard) for ${columnType}:${columnId}`);
      // Re-initialize the column content with the original data
      if (columnType === 'untagged') {
        initializeColumnContent('untagged', untaggedIdeas);
      } else if (columnType === 'tag') {
        const taggedIdeas = ideas.filter(idea => {
          // Check if this idea is associated with this tag
          const ideaIds = tagIdeasMap[columnId] || [];
          return ideaIds.includes(idea.id);
        });
        initializeColumnContent(columnId, taggedIdeas);
      } else if (columnType === 'all') {
        initializeColumnContent('all', ideas);
      }
    }
  };

  return (
    <div className="h-screen flex flex-col text-white/80 text-sm bg-neutral-900 selection:bg-rose-500 selection:text-white selection:text-white caret-rose-500 font-pressura font-light dark:[color-scheme:dark]">

      <div className="h-full flex flex-row overflow-auto">

        <div className="h-full flex flex-1 flex-col px-2 shadow-[1px_0_0_rgba(255,255,255,0.05)]">
          {/* Utility sidebar tabs */}

          {/* tab: close sidebar */}
          {/* <div
            className={`group w-10 h-12 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'sidebar' ? 'bg-neutral-800' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
          >
            <span className={`material-symbols-rounded text-base ${activeTab === 'sidebar' ? 'filled text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>left_panel_close</span>
          </div> */}

          {/* tab: view */}
          <div
            className={`group w-10 h-12 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'brief' ? 'bg-neutral-800' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
            onClick={() => handleTabClick('brief')}
          >
            <span className={`material-symbols-rounded text-base ${activeTab === 'brief' ? 'filled text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>explore</span>
          </div>

          {/* tab: view */}
          <div
            className={`group w-10 h-12 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'view' ? 'bg-neutral-800' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
            onClick={() => handleTabClick('view')}
          >
            <span className={`material-symbols-rounded text-base ${activeTab === 'view' ? 'filled text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>visibility</span>
          </div>

          {/* tab: tools */}
          <div
            className={`group w-10 h-12 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'tools' ? 'bg-neutral-800' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
            onClick={() => handleTabClick('tools')}
          >
            <span className={`material-symbols-rounded text-base ${activeTab === 'tools' ? 'filled text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>widgets</span>
          </div>

          {/* tab: tips */}
          <div
            className={`group w-10 h-12 flex flex-col justify-center items-center mt-2 -mb-2 select-none ${activeTab === 'tips' ? 'bg-neutral-800' : 'hover:bg-white/[2%]'} rounded-lg cursor-pointer`}
            onClick={() => handleTabClick('tips')}
          >
            <span className={`material-symbols-rounded text-base ${activeTab === 'tips' ? 'filled text-white' : 'text-white/40 group-hover:text-white group-hover:scale-125 transition-[transform] duration-100 ease-in-out'}`}>info</span>
          </div>

        </div>

        {/* Utility sidebar - only show when a tab is active */}
        {activeTab && (
          <div className="idea-sidebar h-full w-full max-w-[340px] flex flex-col px-8 overflow-auto shadow-[1px_0_0_rgba(255,255,255,0.05)]">
            {activeTab === 'brief' && (
              <>
                <div className="w-full flex flex-row items-center justify-between gap-6 py-4 text-white">
                  <div className="">Brief</div>
                  
                  <div className="w-full flex justify-start items-center">
                    {briefSaveStatus === 'saving' && (
                      <span className="text-white/40">Saving...</span>
                    )}
                    {briefSaveStatus === 'saved' && (
                      <span className="text-white/40">Auto-saved</span>
                    )}
                    {briefSaveStatus === 'local' && (
                      <span className="text-white/40">Saved locally</span>
                    )}
                    {briefSaveStatus === 'needs-save' && (
                      <button
                        onClick={forceSaveBrief}
                        className="flex items-center text-white/40 hover:text-white bg-white/[2%] hover:bg-white/[5%] rounded-lg px-3 pt-1 pb-2 -mx-3 -mt-1 -mb-2"
                      >
                        <span className="material-symbols-rounded text-base mr-1">save</span>
                        Save
                      </button>
                    )}
                    {briefSaveStatus === 'error' && (
                      <div className="flex items-center gap-2">
                        <span className="text-red-400">Error saving</span>
                        <button
                          onClick={forceSaveBrief}
                          className="flex items-center text-white/40 hover:text-white bg-white/[2%] hover:bg-white/[5%] rounded-lg px-3 pt-1 pb-2 -mx-3 -mt-1 -mb-2"
                        >
                          <span className="material-symbols-rounded text-base mr-1">refresh</span>
                          Retry
                        </button>
                      </div>
                    )}
                  </div>

                  <span
                    className="material-symbols-rounded text-base cursor-pointer text-white/40 hover:text-white hover:scale-125 duration-100 ease-in-out filled"
                    onClick={() => setActiveTab(null)}
                  >
                    close
                  </span>
                </div>

                <div className="w-[calc(100%+40px)] grid -mx-5 mb-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)] rounded-xl overflow-auto">
                  <textarea
                    value={briefValue}
                    onChange={handleBriefChange}
                    className="w-full min-h-[100px] pt-4 pb-8 px-5 bg-transparent placeholder:text-white/40 rounded-lg outline-none resize-none overflow-auto col-start-1 row-start-1"
                    placeholder="Describe project goals, target audience, key messages, and other important details for your project."
                  />
                  <div
                    className="w-full p-3 mb-2 whitespace-pre-wrap invisible overflow-hidden col-start-1 row-start-1"
                    aria-hidden="true"
                  >
                    {briefValue + '\n'}
                  </div>
                </div>

              </>
            )}
            {activeTab === 'view' && (
              <>
                <div className="w-[calc(100%+25px)] flex flex-row items-center justify-between w-full py-4 -mx-3 px-3 text-white">
                  <div className="w-full">View</div>
                  <span
                    className="material-symbols-rounded text-base cursor-pointer text-white/40 hover:text-white hover:scale-125 duration-100 ease-in-out filled"
                    onClick={() => setActiveTab(null)}
                  >
                    close
                  </span>
                </div>

                <hr className="w-full border-[rgba(255,255,255,0.05)]" />

                {/* Sort by select menu */}
                <div className="flex flex-row items-center gap-4 -mx-3 mt-2 px-3">

                  <div className="flex flex-row items-center gap-1 pt-1 pb-2 text-white">
                    {/* <span className="material-symbols-rounded text-base">sort</span> */}
                    Sort by
                  </div>

                  {/* Time sort option */}
                  <div
                    className={`min-h-9 flex flex-row items-center -mx-3 pt-1 pb-2 px-3 rounded-lg select-none ${sortBy === 'time' ? 'text-white' : 'text-white/40 hover:bg-white/[2%]'} cursor-pointer`}
                    onClick={() => handleSortByChange('time')}
                  >
                    {sortBy === 'time' && (
                      <span className="material-symbols-rounded text-base">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                    Time
                  </div>

                  {/* Alphabetical sort option */}
                  <div
                    className={`min-h-9 flex flex-row items-center -mx-3 pt-1 pb-2 px-3 rounded-lg select-none ${sortBy === 'alphabetical' ? 'text-white' : 'text-white/40 hover:bg-white/[2%]'} cursor-pointer`}
                    onClick={() => handleSortByChange('alphabetical')}
                  >
                    {sortBy === 'alphabetical' && (
                      <span className="material-symbols-rounded text-base">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                    Alpha
                  </div>

                  {/* Remove the separate Sort order toggle button */}

                </div>

                <hr className="w-full my-2 border-[rgba(255,255,255,0.05)]" />

                <div className="flex flex-row items-center justify-start gap-4 -mx-3 gap-1 px-3 text-white">

                  <span className="pb-1">Layout</span>

                  <div
                    className={`flex flex-row items-center gap-1 -mx-3 pt-1 pb-2 px-3 select-none ${viewLayout === 'vertical' ? 'text-white' : 'text-white/40'} leading-tight hover:bg-white/[2%] rounded-lg cursor-pointer`}
                    onClick={() => handleViewLayoutToggle('vertical')}
                  >
                    <span className={`material-symbols-rounded text-base ${viewLayout === 'vertical' ? 'filled' : ''}`}>view_agenda</span>
                    Vertical
                  </div>
                  <div
                    className={`flex flex-row items-center gap-1 -mx-3 pt-1 pb-2 px-3 select-none ${viewLayout === 'horizontal' ? 'text-white' : 'text-white/40'} leading-tight hover:bg-white/[2%] rounded-lg cursor-pointer`}
                    onClick={() => handleViewLayoutToggle('horizontal')}
                  >
                    <span className={`material-symbols-rounded text-base ${viewLayout === 'horizontal' ? 'filled' : ''}`}>view_column_2</span>
                    Horizontal
                  </div>
                </div>

                <hr className="w-full my-2 border-[rgba(255,255,255,0.05)]" />

                {/* Only show Group by Tag toggle in vertical layout */}
                {viewLayout === 'vertical' && (
                  <>
                    <div className="flex flex-row items-center justify-start gap-6 -mx-3 gap-1 px-3 text-white">
                      {/* Group by Tag toggle - only enabled in vertical view */}
                      <div
                        className={`flex flex-row items-center gap-1 -mx-3 pt-1 pb-2 px-3 select-none hover:bg-white/[2%] cursor-pointer rounded-lg`}
                        onClick={handleGroupByTagToggle}
                      >
                        <span className={`material-symbols-rounded text-base ${groupByTag ? 'filled text-white' : 'text-white/40'}`}>
                          {groupByTag ? 'toggle_on' : 'toggle_off'}
                        </span>
                        <span className={`${groupByTag ? 'text-white' : 'text-white/40'}`}>Group by Tag</span>
                      </div>
                    </div>

                    {groupByTag && (
                      <hr className="w-full my-2 border-[rgba(255,255,255,0.05)]" />
                    )}
                  </>
                )}

                {/* Only show Tags list when groupByTag is true or in horizontal layout */}
                {(groupByTag || viewLayout === 'horizontal') && (
                  <TagSelector 
                    tags={tags}
                    selectedTags={selectedTags}
                    toggleTagSelection={toggleTagSelection}
                    toggleAllTags={toggleAllTags}
                    selectionState={selectionState}
                    untaggedCount={untaggedIdeas.length}
                    tagCounts={globalTagCounts}
                  />
                )}
              </>
            )}

            {activeTab === 'tools' && (
              <>
                <div className="w-[calc(100%+25px)] flex flex-row items-center justify-between w-full py-4 -mx-3 px-3 text-white">
                  
                  <div className="w-full">Tools</div>
                  
                  <span
                    className="material-symbols-rounded text-base cursor-pointer text-white/40 hover:text-white hover:scale-125 duration-100 ease-in-out filled"
                    onClick={() => setActiveTab(null)}
                  >
                    close
                  </span>
                  
                </div>

                <hr className="w-full border-[rgba(255,255,255,0.05)]" />

                <div className="w-[calc(100%+25px)] flex flex-row items-center justify-between gap-2 w-full py-4 -mx-3 px-3 text-white hover:bg-white/[2%] rounded-lg cursor-pointer">
                  <div className="max-h-6 max-w-6 flex items-center justify-center rounded-full bg-neutral-500 text-black p-2 -my-4">
                    <span className="material-symbols-rounded text-base filled">swap_horiz</span>
                  </div>
                  <div className="w-full -pt-1 pb-1">Importer Exporter</div>
                </div>

                <hr className="w-full border-[rgba(255,255,255,0.05)]" />

                <div className="w-[calc(100%+25px)] flex flex-row items-center justify-between gap-2 w-full py-4 -mx-3 px-3 text-white hover:bg-white/[2%] rounded-lg cursor-pointer">
                  <div className="max-h-6 max-w-6 flex items-center justify-center rounded-full bg-purple-500 text-black p-2 -my-4">
                    <span className="material-symbols-rounded text-base filled">rocket_launch</span>
                  </div>
                  <div className="w-full -pt-1 pb-1">AI Boost</div>
                </div>

                <hr className="w-full border-[rgba(255,255,255,0.05)]" />

                <div className="w-[calc(100%+25px)] flex flex-row items-center justify-between gap-2 w-full py-4 -mx-3 px-3 text-white hover:bg-white/[2%] rounded-lg cursor-pointer">
                  <div className="max-h-6 max-w-6 flex items-center justify-center rounded-full bg-orange-500 text-black p-2 -my-4">
                    <span className="material-symbols-rounded text-base filled">import_contacts</span>
                  </div>
                  <div className="w-full -pt-1 pb-1">Onym Library</div>
                </div>

                <hr className="w-full border-[rgba(255,255,255,0.05)]" />

                <div className="w-[calc(100%+25px)] flex flex-row items-center justify-between gap-2 w-full py-4 -mx-3 px-3 text-white hover:bg-white/[2%] rounded-lg cursor-pointer">
                  <div className="max-h-6 max-w-6 flex items-center justify-center rounded-full bg-teal-500 text-black p-2 -my-4">
                    <span className="material-symbols-rounded text-base filled">workspaces</span>
                  </div>
                  <div className="w-full -pt-1 pb-1">Pieratt 3-Step</div>
                </div>

                <hr className="w-full border-[rgba(255,255,255,0.05)]" />
              </>
            )}

            {activeTab === 'tips' && (
              <>
                <div className="w-full flex flex-row items-center justify-between w-full py-4 text-white">
                  <div className="w-full">Tips</div>
                  <span
                    className="material-symbols-rounded text-base cursor-pointer text-white/40 hover:text-white hover:scale-125 duration-100 ease-in-out filled"
                    onClick={() => setActiveTab(null)}
                  >
                    close
                  </span>
                </div>

                <hr className="w-full border-[rgba(255,255,255,0.05)]" />
              </>
            )}
          </div>
        )}

        {/* ideas container with dynamic class based on viewLayout */}
        <div className={`w-full flex ${viewLayout === 'horizontal' ? 'flex-row gap-3' : 'flex-col'} p-3 pt-0 ${viewLayout === 'vertical' && !groupByTag ? 'h-full' : 'overflow-auto'}`}>
          {/* When in vertical view, if groupByTag is false, show all ideas in a single column */}
          {viewLayout === 'vertical' && !groupByTag ? (
            <IdeaColumn
              title="All ideas"
              count={ideas.length}
              isSticky={viewLayout === 'vertical' && groupByTag}
              handleChange={handleChange}
              handleKeyDown={handleKeyDown}
              handleKeyPress={handleKeyPress}
              handlePaste={handlePaste}
              handleFocus={handleFocus}
              handleBlur={handleBlur}
              columnType="all"
              columnId="all"
              ref={columnRefs.current.all}
              onEditModeChange={(isEditMode, textareaContent) => handleEditModeChange('all', 'all', isEditMode, textareaContent)}
              setFocusedIdeaId={setFocusedIdeaId}
              groupByTag={groupByTag}
            />
          ) : (
            <>
              {/* Untagged column - always display if selected */}
              {selectedTags['untagged'] && (
                <IdeaColumn
                  title="untagged"
                  count={untaggedIdeas.length}
                  isSticky={viewLayout === 'vertical' && groupByTag}
                  handleChange={handleChange}
                  handleKeyDown={handleKeyDown}
                  handleKeyPress={handleKeyPress}
                  handlePaste={handlePaste}
                  handleFocus={handleFocus}
                  handleBlur={handleBlur}
                  columnType="untagged"
                  columnId="untagged"
                  ref={columnRefs.current.untagged}
                  onEditModeChange={(isEditMode, textareaContent) => handleEditModeChange('untagged', 'untagged', isEditMode, textareaContent)}
                  setFocusedIdeaId={setFocusedIdeaId}
                  groupByTag={groupByTag}
                />
              )}

              {/* Tagged columns - display one per selected tag */}
              {getTagsWithIdeas().map(tag => {
                if (selectedTags[tag.id]) {
                  return (
                    <IdeaColumn
                      key={tag.id}
                      title={tag.name}
                      count={globalTagCounts[tag.id] || 0}
                      isSticky={viewLayout === 'vertical' && groupByTag}
                      handleChange={handleChange}
                      handleKeyDown={handleKeyDown}
                      handleKeyPress={handleKeyPress}
                      handlePaste={handlePaste}
                      handleFocus={handleFocus}
                      handleBlur={handleBlur}
                      columnType="tag"
                      columnId={tag.id}
                      ref={columnRefs.current[tag.id]}
                      onEditModeChange={(isEditMode, textareaContent) => handleEditModeChange('tag', tag.id, isEditMode, textareaContent)}
                      setFocusedIdeaId={setFocusedIdeaId}
                      groupByTag={groupByTag}
                    />
                  );
                }
                return null;
              })}

              {/* New tag column */}
              <div className="relative group min-w-[400px] flex flex-1 flex-col">
                <div className="min-h-14 max-h-14 flex justify-center items-center px-4">
                  {!newTagInputVisible ? (
                    <div
                      className="flex items-center -mx-1 pb-1 pl-2 pr-3 text-white/40 group-hover:bg-white/5 group-hover:text-white rounded-lg whitespace-nowrap select-none cursor-pointer"
                      onClick={() => {
                        // Close any open inputs in the context sidebar
                        if (focusedIdeaId) {
                          if (tagInputVisible) {
                            setTagInputVisible(false);
                            setTagInputValue('');
                          }
                          
                          if (noteInputVisible) {
                            setNoteInputVisible(false);
                            setNoteInputValue('');
                          }
                        }
                        
                        setNewTagInputVisible(true);
                        setTimeout(() => {
                          if (newTagInputRef && newTagInputRef.current) {
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
            </>
          )}
        </div>

        {/* Context sidebar */}
        {
          !isAnyColumnEditing && focusedIdeaId && focusedIdea && (
            <div
              className="idea-sidebar h-full min-w-[400px] flex flex-1 flex-col px-8 overflow-auto shadow-[-1px_0_0_rgba(255,255,255,0.05)] relative z-30"
              onMouseDown={(e) => {
                // Prevent the mousedown from triggering a selection change
                // This is critical since selection changes can cause the sidebar to close
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                // Prevent click events from bubbling up
                e.preventDefault();
                e.stopPropagation();
              }}
              onKeyDown={(e) => {
                // Prevent keydown events from affecting idea columns
                e.stopPropagation();
              }}
            >
              <div className="flex flex-1 flex-col justify-between">
                <div className="flex flex-1 flex-col">
                  <div className="relative min-h-14 flex flex-row justify-between items-center py-4 sticky top-0 z-10 bg-neutral-900 shadow-[0_1px_0_rgba(255,255,255,0.05),16px_0_0_rgba(23,23,23,1),-16px_0_0_rgba(23,23,23,1)]">
                    <div 
                      className="h-10 w-full flex items-center px-3 -mx-3 -my-2 mr-10 rounded-lg outline-none leading-tight cursor-pointer"
                      onClick={() => {
                        // Find the idea in the main column
                        const ideaId = focusedIdeaId;
                        if (!ideaId) return;
                        
                        // Find which tag(s) this idea belongs to
                        const tags = ideaTags;
                        let foundInColumn = false;
                        
                        // First try to find in tag columns
                        for (const tag of tags) {
                          const columnRef = columnRefs.current[tag.id];
                          if (columnRef && columnRef.current) {
                            const ideaDiv = columnRef.current.querySelector(`[data-idea-id="${ideaId}"]`);
                            if (ideaDiv) {
                              // Idea found in this column
                              ideaDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              ideaDiv.focus();
                              
                              // Apply focus styling
                              ideaDiv.classList.remove('text-white/60');
                              ideaDiv.classList.add('text-white');
                              ideaDiv.classList.add('idea-item-focused');
                              ideaDiv.classList.add('bg-neutral-800');
                              
                              foundInColumn = true;
                              break;
                            }
                          }
                        }
                        
                        // If not found in tag columns, try the untagged column
                        if (!foundInColumn && columnRefs.current.untagged && columnRefs.current.untagged.current) {
                          const ideaDiv = columnRefs.current.untagged.current.querySelector(`[data-idea-id="${ideaId}"]`);
                          if (ideaDiv) {
                            ideaDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            ideaDiv.focus();
                            
                            // Apply focus styling
                            ideaDiv.classList.remove('text-white/60');
                            ideaDiv.classList.add('text-white');
                            ideaDiv.classList.add('idea-item-focused');
                            ideaDiv.classList.add('bg-neutral-800');
                          }
                        }
                      }}
                    >
                      {stripHtmlAndDecodeEntities(focusedIdea.content)}
                    </div>
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 z-10 right-2 material-symbols-rounded text-base cursor-pointer text-white/40 hover:text-white hover:scale-125 duration-100 ease-in-out filled p-1`}
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
                      close
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
                    {/* Tags section - use the TagBadge component */}
                    <div className="flex flex-wrap gap-4 ">
                      {ideaTags.map(tag => (
                        <TagBadge
                          key={tag.id}
                          name={tag.name}
                          onRemove={() => handleRemoveTagFromIdea(tag.id, focusedIdeaId)}
                        />
                      ))}
                      
                      {/* Add tag button - only show if an idea is focused */}
                      {focusedIdeaId && (
                        <div
                          className="w-fit flex justify-center items-center -mx-3 pb-1 pl-2 pr-3 text-white/40 hover:text-white hover:bg-white/[2%] rounded-lg whitespace-nowrap cursor-pointer"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            // Close note input if it's open
                            if (noteInputVisible) {
                              setNoteInputVisible(false);
                              setNoteInputValue('');
                            }
                            setTagInputVisible(!tagInputVisible);
                            setTagInputValue('');
                          }}
                        >
                          <span className="material-symbols-rounded text-base">add</span>
                          Tag
                        </div>
                      )}
                    </div>

                    {/* Add new tag input */}
                    {tagInputVisible && (
                      <div
                        className="flex flex-col -mx-3 mt-2 text-white bg-white/[2%] whitespace-nowrap rounded-lg overflow-clip relative z-20"
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
                          onClick={(e) => {
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
                                  handleAddTagToIdea(tag.id, focusedIdeaId);
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
                          <div key={note.id} className={`group w-full flex flex-col gap-4 p-3 rounded-lg overflow-auto ${note.isError ? 'bg-red-900/20' : 'hover:shadow-[inset_0_0_1px_rgba(255,255,255,0.25)]'}`}>
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
                          className="w-fit flex justify-center items-center mt-2 pb-1 pl-2 pr-3 text-white/40 hover:text-white hover:bg-white/[2%] rounded-lg whitespace-nowrap cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Close tag input if it's open
                            if (tagInputVisible) {
                              setTagInputVisible(false);
                              setTagInputValue('');
                            }
                            setNoteInputVisible(true);
                            // Focus the textarea after a short delay to ensure it's rendered
                            setTimeout(() => {
                              if (noteInputRef.current) {
                                noteInputRef.current.focus();
                              }
                            }, 50);
                          }}
                        >
                          <span className="material-symbols-rounded text-base">add</span>
                          Note
                        </div>
                      ) : (
                        <div 
                          className="w-full flex flex-col mt-2 relative z-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                        >
                          <div className="w-full grid">
                            <textarea
                              ref={noteInputRef}
                              value={noteInputValue}
                              onChange={handleNoteInputChange}
                              onKeyDown={handleNoteInputKeyDown}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                              className="w-[calc(100%+24px)] min-h-[36px] p-3 mb-2 bg-white/[2%] focus:bg-white/[5%] rounded-lg border-none outline-none placeholder:text-white/40 resize-none overflow-hidden col-start-1 row-start-1"
                              placeholder="Add a note..."
                              autoFocus
                            />
                            <div
                              className="w-[calc(100%+24px)] p-3 mb-2 whitespace-pre-wrap invisible overflow-hidden col-start-1 row-start-1"
                              aria-hidden="true"
                            >
                              {noteInputValue + '\n'}
                            </div>
                          </div>
                          <div className="flex justify-between gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                          >
                            <button
                              className="flex items-center pb-1 pl-2 pr-3 text-white bg-white/[2%] hover:bg-white/[5%] rounded-lg whitespace-nowrap cursor-pointer"
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
                              className="flex items-center pb-1 pl-2 pr-3 text-white/40 hover:text-white rounded-lg whitespace-nowrap cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setNoteInputVisible(false);
                                setNoteInputValue('');
                              }}
                            >
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
          )
        }
      </div>
      <div className="flex flex-row gap-8 px-6 pt-3 pb-4 bg-black/20 shadow-[0_-1px_0_0_rgba(255,255,255,0.05)]">
        <div className="w-full flex flex-row gap-8">
          <div className="flex flex-row items-center gap-1 -mx-3 pt-2 pb-3 px-4 select-none uppercase font-medium leading-tight text-white/40 hover:text-white hover:bg-white/[2%] rounded-lg cursor-pointer">Brief</div>
          <div className="flex flex-row items-center gap-1 -mx-3 pt-2 pb-3 px-4 select-none uppercase font-medium leading-tight bg-white/[5%] rounded-lg cursor-pointer">Ideate</div>
          <div className="flex flex-row items-center gap-1 -mx-3 pt-2 pb-3 px-4 select-none uppercase font-medium leading-tight text-white/40 hover:text-white hover:bg-white/[2%] rounded-lg cursor-pointer">Shortlist</div>
          <div className="flex flex-row items-center gap-1 -mx-3 pt-2 pb-3 px-4 select-none uppercase font-medium leading-tight text-white/40 hover:text-white hover:bg-white/[2%] rounded-lg cursor-pointer">Validate</div>
          <div className="flex flex-row items-center gap-1 -mx-3 pt-2 pb-3 px-4 select-none uppercase font-medium leading-tight text-white/40 hover:text-white hover:bg-white/[2%] rounded-lg cursor-pointer">Decide</div>
        </div>
        <div className="flex flex-row items-center gap-1 -mx-3 pt-2 pb-3 px-4 select-none uppercase font-medium leading-tight text-white/40 hover:text-white hover:bg-white/[2%] rounded-lg cursor-pointer">Settings</div>
      </div>
    </div>
  );
}

export default App;