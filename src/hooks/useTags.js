import { useState, useCallback } from 'react';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';

/**
 * Custom hook for managing tags
 */
const useTags = (db, firebase) => {
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState({ 'untagged': true });
  const [selectionState, setSelectionState] = useState('all');
  const [tagIdeasMap, setTagIdeasMap] = useState({});
  const [globalTagCounts, setGlobalTagCounts] = useState({});

  // Toggle selection of a tag
  const toggleTagSelection = useCallback((tagId) => {
    setSelectedTags(prev => {
      const newSelectedTags = { ...prev, [tagId]: !prev[tagId] };

      // Update the selection state (all, none, or indeterminate)
      updateSelectionState(newSelectedTags);

      return newSelectedTags;
    });
  }, []);

  // Toggle all tags selection state
  const toggleAllTags = useCallback(() => {
    // Cycle through states: none -> all -> none
    if (selectionState === 'all') {
      // If all are selected, deselect all
      const newSelectedTags = { 'untagged': false };
      tags.forEach(tag => {
        newSelectedTags[tag.id] = false;
      });
      setSelectedTags(newSelectedTags);
      setSelectionState('none');
    } else {
      // If none or some are selected, select all
      const newSelectedTags = { 'untagged': true };
      tags.forEach(tag => {
        newSelectedTags[tag.id] = true;
      });
      setSelectedTags(newSelectedTags);
      setSelectionState('all');
    }
  }, [tags, selectionState]);

  // Update the overall selection state based on individual selections
  const updateSelectionState = useCallback((selectedTagsObj) => {
    if (!tags.length) return;

    // Count the total number of tag options (include untagged as a tag option)
    const totalTagOptions = tags.length + 1;

    // Count how many are selected
    const selectedCount = Object.values(selectedTagsObj).filter(Boolean).length;

    if (selectedCount === 0) {
      setSelectionState('none');
    } else if (selectedCount === totalTagOptions) {
      setSelectionState('all');
    } else {
      setSelectionState('indeterminate');
    }
  }, [tags]);

  // Add a tag to an idea
  const addTagToIdea = useCallback(async (tagId, ideaId) => {
    try {
      await firebase.addTagToIdea(tagId, ideaId);
      return true;
    } catch (error) {
      console.error("Error adding tag to idea:", error);
      return false;
    }
  }, [firebase]);

  // Remove a tag from an idea
  const removeTagFromIdea = useCallback(async (tagId, ideaId) => {
    try {
      await firebase.removeTagFromIdea(tagId, ideaId);
      return true;
    } catch (error) {
      console.error("Error removing tag from idea:", error);
      return false;
    }
  }, [firebase]);

  // Delete a tag and all its associations
  const deleteTag = useCallback(async (tagId, tagName) => {
    // Show native confirmation dialog
    const confirmed = window.confirm(`Delete tag "${tagName}"? This cannot be undone.`);

    if (!confirmed) return false;

    try {
      await firebase.deleteTag(tagId);
      return true;
    } catch (error) {
      console.error("Error deleting tag:", error);
      alert("Error deleting tag. Please try again.");
      return false;
    }
  }, [firebase]);

  // Create a new tag
  const createTag = useCallback(async (name) => {
    try {
      return await firebase.createTag(name);
    } catch (error) {
      console.error("Error creating tag:", error);
      return null;
    }
  }, [firebase]);

  // Get tags for a specific idea
  const getTagsForIdea = useCallback(async (ideaId) => {
    if (!ideaId) return [];
    
    try {
      const ideaTagsRef = collection(db, 'idea_tags');
      const q = query(ideaTagsRef, where('ideaId', '==', ideaId));
      const querySnapshot = await getDocs(q);
      
      // Map the relationship docs to get the tag IDs
      const tagIds = querySnapshot.docs.map(doc => doc.data().tagId);
      
      // Return the actual tag objects
      return tags.filter(tag => tagIds.includes(tag.id));
    } catch (error) {
      console.error("Error getting tags for idea:", error);
      return [];
    }
  }, [db, tags]);

  // Get ideas for a specific tag
  const getIdeasByTag = useCallback((tagId) => {
    const ideaIds = tagIdeasMap[tagId] || [];
    return ideaIds;
  }, [tagIdeasMap]);

  // Get tags that have ideas
  const getTagsWithIdeas = useCallback(() => {
    return tags.filter(tag => globalTagCounts[tag.id] && globalTagCounts[tag.id] > 0);
  }, [tags, globalTagCounts]);

  return {
    // State
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
    
    // Actions
    toggleTagSelection,
    toggleAllTags,
    updateSelectionState,
    addTagToIdea,
    removeTagFromIdea,
    deleteTag,
    createTag,
    getTagsForIdea,
    getIdeasByTag,
    getTagsWithIdeas
  };
};

export default useTags; 