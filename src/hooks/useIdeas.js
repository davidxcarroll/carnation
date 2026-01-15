import { useState, useRef, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

/**
 * Custom hook for managing ideas
 */
const useIdeas = (db, firebase) => {
  const [ideas, setIdeas] = useState([]);
  const [untaggedIdeas, setUntaggedIdeas] = useState([]);
  const [focusedIdeaId, setFocusedIdeaId] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Sort options
  const [sortBy, setSortBy] = useState('time'); // 'time' or 'alphabetical'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  
  // Reference to track update operations
  const isUpdatingRef = useRef(false);
  
  // Create a new idea
  const createNewIdea = useCallback(async (content, tagId = null, insertAfterIndex = -1) => {
    try {
      const result = await firebase.createIdea(content, tagId);
      return result ? result.id : null;
    } catch (error) {
      console.error("Error creating new idea:", error);
      return null;
    }
  }, [firebase]);

  // Update idea content
  const updateIdeaContent = useCallback(async (ideaId, content) => {
    if (!ideaId) return false;
    
    try {
      isUpdatingRef.current = true;
      await firebase.updateIdeaContent(ideaId, content);
      
      // Set a timeout to reset the updating flag
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 500);
      
      return true;
    } catch (error) {
      isUpdatingRef.current = false;
      console.error("Error updating idea content:", error);
      return false;
    }
  }, [firebase]);

  // Delete an idea
  const deleteIdea = useCallback(async (ideaId) => {
    try {
      return await firebase.deleteIdea(ideaId);
    } catch (error) {
      console.error("Error deleting idea:", error);
      return false;
    }
  }, [firebase]);

  // Get the focused idea object
  const getFocusedIdea = useCallback(() => {
    return ideas.find(idea => idea.id === focusedIdeaId) || null;
  }, [ideas, focusedIdeaId]);
  
  // Clean up empty ideas
  const cleanupEmptyIdeas = useCallback(async (ideasData) => {
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
          await firebase.deleteIdea(idea.id);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error cleaning up empty ideas:", error);
      return false;
    }
  }, [firebase]);
  
  // Find untagged ideas
  const findUntaggedIdeas = useCallback(async () => {
    try {
      // Get all ideas that have tags
      const ideaTagsRef = collection(db, 'idea_tags');
      const querySnapshot = await getDocs(ideaTagsRef);
      
      // Get unique idea IDs that have tags
      const taggedIdeaIds = new Set();
      querySnapshot.forEach(doc => {
        taggedIdeaIds.add(doc.data().ideaId);
      });
      
      // Filter out ideas that don't have tags
      const untagged = ideas.filter(idea => !taggedIdeaIds.has(idea.id));
      
      setUntaggedIdeas(untagged);
      return untagged;
    } catch (error) {
      console.error("Error finding untagged ideas:", error);
      return [];
    }
  }, [db, ideas]);
  
  // Sort ideas based on the current sort options
  const sortIdeas = useCallback((ideasToSort) => {
    let sortedIdeas = [...ideasToSort];

    if (sortBy === 'time') {
      sortedIdeas = sortedIdeas.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    } else if (sortBy === 'alphabetical') {
      sortedIdeas = sortedIdeas.sort((a, b) => {
        const contentA = (a.content || '').toLowerCase();
        const contentB = (b.content || '').toLowerCase();
        return sortOrder === 'asc'
          ? contentA.localeCompare(contentB)
          : contentB.localeCompare(contentA);
      });
    }
    
    return sortedIdeas;
  }, [sortBy, sortOrder]);
  
  // Toggle sort order
  const toggleSortOrder = useCallback(() => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);
  
  // Change sort type
  const changeSortBy = useCallback((sortType) => {
    if (sortType === 'time' || sortType === 'alphabetical') {
      setSortBy(sortType);
    }
  }, []);

  return {
    // State
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
    
    // Actions
    createNewIdea,
    updateIdeaContent,
    deleteIdea,
    getFocusedIdea,
    cleanupEmptyIdeas,
    findUntaggedIdeas,
    sortIdeas,
    toggleSortOrder,
    changeSortBy
  };
};

export default useIdeas; 