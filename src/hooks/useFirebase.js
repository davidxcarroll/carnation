import { useCallback } from 'react';
import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';

/**
 * Custom hook for Firebase operations
 */
const useFirebase = (db) => {
  // Create a new idea
  const createIdea = useCallback(async (content, tagId = null) => {
    try {
      // Create the idea document
      const newIdea = {
        content: content || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const ideasRef = collection(db, 'ideas');
      const newIdeaRef = await addDoc(ideasRef, newIdea);
      
      // If a tag was specified, create the idea-tag relationship
      if (tagId) {
        await addTagToIdea(tagId, newIdeaRef.id);
      }
      
      // Return with JavaScript Date objects instead of serverTimestamp
      return {
        id: newIdeaRef.id,
        content: content || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error("Error creating idea:", error);
      return null;
    }
  }, [db]);

  // Create a new tag
  const createTag = useCallback(async (name) => {
    try {
      // Create the tag document
      const newTag = {
        name: name.trim(),
        createdAt: serverTimestamp()
      };
      
      const tagsRef = collection(db, 'tags');
      const newTagRef = await addDoc(tagsRef, newTag);
      
      // Return with JavaScript Date objects instead of serverTimestamp
      return {
        id: newTagRef.id,
        name: name.trim(),
        createdAt: new Date()
      };
    } catch (error) {
      console.error("Error creating tag:", error);
      return null;
    }
  }, [db]);

  // Add a tag to an idea
  const addTagToIdea = useCallback(async (tagId, ideaId) => {
    try {
      if (!tagId || !ideaId) return false;
      
      // Check if relationship already exists
      const ideaTagsRef = collection(db, 'idea_tags');
      const q = query(
        ideaTagsRef, 
        where('tagId', '==', tagId),
        where('ideaId', '==', ideaId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Create the relationship with a JavaScript Date instead of serverTimestamp
        await addDoc(ideaTagsRef, {
          tagId,
          ideaId,
          createdAt: new Date()
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error adding tag to idea:", error);
      return false;
    }
  }, [db]);

  // Remove a tag from an idea
  const removeTagFromIdea = useCallback(async (tagId, ideaId) => {
    try {
      if (!tagId || !ideaId) return false;
      
      // Find the relationship
      const ideaTagsRef = collection(db, 'idea_tags');
      const q = query(
        ideaTagsRef, 
        where('tagId', '==', tagId),
        where('ideaId', '==', ideaId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Delete the relationship
        await deleteDoc(querySnapshot.docs[0].ref);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error removing tag from idea:", error);
      return false;
    }
  }, [db]);

  // Update an idea's content
  const updateIdeaContent = useCallback(async (ideaId, content) => {
    try {
      if (!ideaId) return false;
      
      await setDoc(doc(db, 'ideas', ideaId), {
        content,
        updatedAt: new Date()
      }, { merge: true });
      
      return true;
    } catch (error) {
      console.error("Error updating idea:", error);
      return false;
    }
  }, [db]);

  // Delete an idea
  const deleteIdea = useCallback(async (ideaId) => {
    try {
      if (!ideaId) return false;
      
      // First delete all tag relationships
      const ideaTagsRef = collection(db, 'idea_tags');
      const q = query(ideaTagsRef, where('ideaId', '==', ideaId));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Then delete the idea itself
      await deleteDoc(doc(db, 'ideas', ideaId));
      
      return true;
    } catch (error) {
      console.error("Error deleting idea:", error);
      return false;
    }
  }, [db]);

  // Delete a tag and all its relationships
  const deleteTag = useCallback(async (tagId) => {
    try {
      if (!tagId) return false;
      
      // Delete all relationships
      const ideaTagsRef = collection(db, 'idea_tags');
      const q = query(ideaTagsRef, where('tagId', '==', tagId));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Delete the tag itself
      await deleteDoc(doc(db, 'tags', tagId));
      
      return true;
    } catch (error) {
      console.error("Error deleting tag:", error);
      return false;
    }
  }, [db]);

  return {
    createIdea,
    createTag,
    addTag: createTag,
    addTagToIdea,
    removeTagFromIdea,
    updateIdeaContent,
    deleteIdea,
    deleteTag
  };
};

export default useFirebase; 