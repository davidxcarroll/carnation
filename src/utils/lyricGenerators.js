import { wordCollections } from '../data/topics';
import { songTemplates } from '../data/tunes';

export const getRandomWord = (theme, syllableCount) => {
  if (theme === 'anything') {
    // Collect all words with matching syllable count from ALL categories
    const allWords = Object.keys(wordCollections)
      .map(category => wordCollections[category][syllableCount] || [])
      .flat();
  
    // Return a random word from all words
    return allWords.length > 0 
      ? allWords[Math.floor(Math.random() * allWords.length)]
      : `[${syllableCount}-syllable word]`;
  }

  // Handle specific themes
  const themeWords = wordCollections[theme];
  if (!themeWords || !themeWords[syllableCount]) {
    return `[${syllableCount}-syllable ${theme} word]`;
  }
  
  const availableWords = themeWords[syllableCount];
  
  // If no words exist for this syllable count, return placeholder
  if (availableWords.length === 0) {
    return `[${syllableCount}-syllable ${theme} word]`;
  }
  
  return availableWords[Math.floor(Math.random() * availableWords.length)];
};

export const generateLyrics = (songId, theme) => {
  const song = Object.values(songTemplates).find(s => s.id === songId);
  if (!song) return [];

  const lyrics = [];
  const wordMap = new Map();  // For tracking words that should intentionally repeat
  let wordCounter = 1;

  // Handle nested array pattern
  song.pattern.forEach(line => {
    const currentLine = [];
    
    // Check if pattern is an array (new structure) or object (old structure)
    const patterns = Array.isArray(line) ? line : [line];
    
    patterns.forEach(part => {
      let word;
      
      if (part.wordKey) {
        // If wordKey exists, handle intentional repetition
        if (wordMap.has(part.wordKey)) {
          word = wordMap.get(part.wordKey);
        } else {
          word = getRandomWord(theme, part.syllables);
          wordMap.set(part.wordKey, word);
        }
      } else {
        // For words without wordKey, just get a random word
        const key = `word_${wordCounter++}`;
        word = getRandomWord(theme, part.syllables);
        wordMap.set(key, word);
      }

      const repetitions = part.repeat || part.count || 1;
      for (let i = 0; i < repetitions; i++) {
        currentLine.push(word);
      }
    });

    lyrics.push(currentLine.join(' '));
  });

  return lyrics;
};