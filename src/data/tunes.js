export const songTemplates = {
  frereJacques: {
    name: "Frère Jacques",
    id: "tuneFrere",
    pattern: [
      [   // Line 1: "are you sleeping"
        { syllables: 1, count: 1, wordKey: 'word1' },   // "are"
        { syllables: 1, count: 1, wordKey: 'word2' },   // "you"
        { syllables: 2, count: 1, wordKey: 'word3' }    // "sleeping"
      ],
      [   // Line 2: repeat of line 1
        { syllables: 1, count: 1, wordKey: 'word1' },   // "are"
        { syllables: 1, count: 1, wordKey: 'word2' },   // "you"
        { syllables: 2, count: 1, wordKey: 'word3' }    // "sleeping"
      ],
      [   // Line 3: "brother John"
        { syllables: 2, count: 1, wordKey: 'word4' },   // "brother"
        { syllables: 1, count: 1, wordKey: 'word5' }    // "John"
      ],
      [   // Line 4: repeat of line 3
        { syllables: 2, count: 1, wordKey: 'word4' },   // "brother"
        { syllables: 1, count: 1, wordKey: 'word5' }    // "John"
      ],
      [   // Line 5: "morning bells are ringing"
        { syllables: 2, count: 1, wordKey: 'word6' },   // "morning"
        { syllables: 1, count: 1, wordKey: 'word7' },   // "bells"
        { syllables: 1, count: 1, wordKey: 'word8' },   // "are"
        { syllables: 2, count: 1, wordKey: 'word9' }    // "ringing"
      ],
      [   // Line 6: repeat of line 5
        { syllables: 2, count: 1, wordKey: 'word6' },   // "morning"
        { syllables: 1, count: 1, wordKey: 'word7' },   // "bells"
        { syllables: 1, count: 1, wordKey: 'word8' },   // "are"
        { syllables: 2, count: 1, wordKey: 'word9' }    // "ringing"
      ],
      [   // Line 7: "ding dang dong"
        { syllables: 1, count: 1, wordKey: 'word10' },   // "ding"
        { syllables: 1, count: 1, wordKey: 'word11' },   // "dang"
        { syllables: 1, count: 1, wordKey: 'word12' }    // "dong"
      ],
      [   // Line 8: repeat of line 7
        { syllables: 1, count: 1, wordKey: 'word10' },   // "ding"
        { syllables: 1, count: 1, wordKey: 'word11' },   // "dang"
        { syllables: 1, count: 1, wordKey: 'word12' }    // "dong"
      ]
    ],
    original: [
      "are you sleeping",
      "are you sleeping",
      "brother John",
      "brother John",
      "morning bells are ringing",
      "morning bells are ringing",
      "ding dang dong",
      "ding dang dong"
    ]
  },
  rowYourBoat: {
    name: "Row Row Row Your Boat",
    id: "tuneRow",
    pattern: [
      [   // "Row row row your boat"
        { syllables: 1, count: 1, wordKey: 'row' },    // "Row"
        { syllables: 1, count: 1, wordKey: 'row' },    // "row"
        { syllables: 1, count: 1, wordKey: 'row' },    // "row"
        { syllables: 1, count: 1 },                    // "your"
        { syllables: 1, count: 1 }                     // "boat"
      ],
      [   // "Gently down the stream"
        { syllables: 2, count: 1 },                    // "gently"
        { syllables: 1, count: 1 },                    // "down"
        { syllables: 1, count: 1 },                    // "the"
        { syllables: 1, count: 1 }                     // "stream"
      ],
      [   // "Merrily merrily merrily merrily"
        { syllables: 3, count: 1, wordKey: 'merrily' }, // "merrily"
        { syllables: 3, count: 1, wordKey: 'merrily' }, // "merrily"
        { syllables: 3, count: 1, wordKey: 'merrily' }, // "merrily"
        { syllables: 3, count: 1, wordKey: 'merrily' }  // "merrily"
      ],
      [   // "Life is but a dream"
        { syllables: 1, count: 1 },                    // "life"
        { syllables: 1, count: 1 },                    // "is"
        { syllables: 1, count: 1 },                    // "but"
        { syllables: 1, count: 1 },                     // "a"
        { syllables: 1, count: 1 }                     // "dream"
      ]
    ],
    original: [
      "Row, row, row your boat",
      "Gently down the stream",
      "Merrily, merrily, merrily, merrily",
      "Life is but a dream"
    ]
  },
  maryLamb: {
    name: "Mary Had a Little Lamb",
    id: "tuneMary",
    pattern: [
      [   // "Mary had a little lamb"
        { syllables: 2, count: 1, wordKey: 'mary' },   // "Mary"
        { syllables: 1, count: 1 },                    // "had"
        { syllables: 1, count: 1 },                    // "a"
        { syllables: 2, count: 1, wordKey: 'little' }, // "little"
        { syllables: 1, count: 1, wordKey: 'lamb' }    // "lamb"
      ],
      [   // "Little lamb"
        { syllables: 2, count: 1, wordKey: 'little' }, // "little"
        { syllables: 1, count: 1, wordKey: 'lamb' }    // "lamb"
      ],
      [   // "Little lamb"
        { syllables: 2, count: 1, wordKey: 'little' }, // "little"
        { syllables: 1, count: 1, wordKey: 'lamb' }    // "lamb"
      ],
      [   // "Mary had a little lamb"
        { syllables: 2, count: 1, wordKey: 'mary' },   // "Mary"
        { syllables: 1, count: 1 },                    // "had"
        { syllables: 1, count: 1 },                    // "a"
        { syllables: 2, count: 1, wordKey: 'little' }, // "little"
        { syllables: 1, count: 1, wordKey: 'lamb' }    // "lamb"
      ],
      [   // "Whose fleece was white as snow"
        { syllables: 1, count: 1 },                    // "whose"
        { syllables: 1, count: 1 },                    // "fleece"
        { syllables: 1, count: 1 },                    // "was"
        { syllables: 1, count: 1 },                    // "white"
        { syllables: 1, count: 1 },                    // "as"
        { syllables: 1, count: 1 }                     // "snow"
      ]
    ],
    original: [
      "Mary had a little lamb",
      "Little lamb",
      "Little lamb",
      "Mary had a little lamb",
      "Whose fleece was white as snow"
    ]
  },
  twinkleStar: {
    name: "Twinkle Twinkle",
    id: "tuneTwinkle",
    pattern: [
      [   // Line 1: "Twinkle twinkle little star"
        { syllables: 2, count: 1, wordKey: 'twinkle1' },  // "Twinkle"
        { syllables: 2, count: 1, wordKey: 'twinkle2' },  // "twinkle"
        { syllables: 2, count: 1, wordKey: 'little' },    // "little"
        { syllables: 1, count: 1, wordKey: 'star' }       // "star"
      ],
      [   // Line 2: "How I wonder what you are"
        { syllables: 1, count: 1, wordKey: 'how' },       // "How"
        { syllables: 1, count: 1, wordKey: 'i' },         // "I"
        { syllables: 2, count: 1, wordKey: 'wonder' },    // "wonder"
        { syllables: 1, count: 1, wordKey: 'what' },      // "what"
        { syllables: 1, count: 1, wordKey: 'you' },       // "you"
        { syllables: 1, count: 1, wordKey: 'are' }        // "are"
      ],
      [   // Line 3: "Up above the world so high"
        { syllables: 1, count: 1, wordKey: 'up' },        // "Up"
        { syllables: 2, count: 1, wordKey: 'above' },     // "above"
        { syllables: 1, count: 1, wordKey: 'the' },       // "the"
        { syllables: 1, count: 1, wordKey: 'world' },     // "world"
        { syllables: 1, count: 1, wordKey: 'so' },        // "so"
        { syllables: 1, count: 1, wordKey: 'high' }       // "high"
      ],
      [   // Line 4: "Like a diamond in the sky"
        { syllables: 1, count: 1, wordKey: 'like' },      // "Like"
        { syllables: 1, count: 1, wordKey: 'a' },         // "a"
        { syllables: 2, count: 1, wordKey: 'diamond' },   // "diamond"
        { syllables: 1, count: 1, wordKey: 'in' },        // "in"
        { syllables: 1, count: 1, wordKey: 'the' },       // "the"
        { syllables: 1, count: 1, wordKey: 'sky' }        // "sky"
      ],
      [   // Line 5: repeat of line 1
        { syllables: 2, count: 1, wordKey: 'twinkle1' },  // "Twinkle"
        { syllables: 2, count: 1, wordKey: 'twinkle2' },  // "twinkle"
        { syllables: 2, count: 1, wordKey: 'little' },    // "little"
        { syllables: 1, count: 1, wordKey: 'star' }       // "star"
      ],
      [   // Line 6: repeat of line 2
        { syllables: 1, count: 1, wordKey: 'how' },       // "How"
        { syllables: 1, count: 1, wordKey: 'i' },         // "I"
        { syllables: 2, count: 1, wordKey: 'wonder' },    // "wonder"
        { syllables: 1, count: 1, wordKey: 'what' },      // "what"
        { syllables: 1, count: 1, wordKey: 'you' },       // "you"
        { syllables: 1, count: 1, wordKey: 'are' }        // "are"
      ]
    ],
    original: [
      "Twinkle twinkle little star",
      "How I wonder what you are",
      "Up above the world so high",
      "Like a diamond in the sky",
      "Twinkle twinkle little star",
      "How I wonder what you are"
    ]
  },
  hotCrossBuns: {
    name: "Hot Cross Buns",
    id: "tuneBuns",
    pattern: [
      [   // Line 1: "Hot cross buns"
        { syllables: 1, count: 1, wordKey: 'hot' },      // "Hot"
        { syllables: 1, count: 1, wordKey: 'cross' },    // "cross"
        { syllables: 1, count: 1, wordKey: 'buns' }      // "buns"
      ],
      [   // Line 2: "Hot cross buns"
        { syllables: 1, count: 1, wordKey: 'hot' },      // "Hot"
        { syllables: 1, count: 1, wordKey: 'cross' },    // "cross"
        { syllables: 1, count: 1, wordKey: 'buns' }      // "buns"
      ],
      [   // Line 3: "One a penny"
        { syllables: 1, count: 1, wordKey: 'one' },      // "One"
        { syllables: 1, count: 1, wordKey: 'a' },        // "a"
        { syllables: 2, count: 1, wordKey: 'penny1' },   // "penny"
      ],
      [   // Line 4: "Two a penny"
        { syllables: 1, count: 1, wordKey: 'two' },      // "two"
        { syllables: 1, count: 1, wordKey: 'a' },        // "a"
        { syllables: 2, count: 1, wordKey: 'penny2' }    // "penny"
      ],
      [   // Line 5: "Hot cross buns"
        { syllables: 1, count: 1, wordKey: 'hot' },      // "Hot"
        { syllables: 1, count: 1, wordKey: 'cross' },    // "cross"
        { syllables: 1, count: 1, wordKey: 'buns' }      // "buns"
      ]
    ],
    original: [
      "Hot cross buns",
      "Hot cross buns",
      "One a penny, two a penny",
      "Hot cross buns"
    ]
  }
  // jingleBells: {
  //   name: "Jingle Bells",
  //   id: "tuneJingle",
  //   pattern: [
  //     [   // Line 1: "Jingle bells"
  //       { syllables: 2, count: 1, wordKey: 'jingle1' },  // "Jingle"
  //       { syllables: 1, count: 1, wordKey: 'bells1' }    // "bells"
  //     ],
  //     [   // Line 2: "Jingle bells" (repeat)
  //       { syllables: 2, count: 1, wordKey: 'jingle1' },  // "Jingle"
  //       { syllables: 1, count: 1, wordKey: 'bells1' }    // "bells"
  //     ],
  //     [   // Line 3: "Jingle all the way"
  //       { syllables: 2, count: 1, wordKey: 'jingle2' },  // "Jingle"
  //       { syllables: 1, count: 1, wordKey: 'all' },      // "all"
  //       { syllables: 1, count: 1, wordKey: 'the' },      // "the"
  //       { syllables: 1, count: 1, wordKey: 'way' }       // "way"
  //     ],
  //     [   // Line 4: "Oh what fun it is to ride"
  //       { syllables: 1, count: 1, wordKey: 'oh' },       // "Oh"
  //       { syllables: 1, count: 1, wordKey: 'what' },     // "what"
  //       { syllables: 1, count: 1, wordKey: 'fun' },      // "fun"
  //       { syllables: 1, count: 1, wordKey: 'it' },       // "it"
  //       { syllables: 1, count: 1, wordKey: 'is' },       // "is"
  //       { syllables: 1, count: 1, wordKey: 'to' },       // "to"
  //       { syllables: 1, count: 1, wordKey: 'ride' }      // "ride"
  //     ],
  //     [   // Line 5: "in a one horse open sleigh"
  //       { syllables: 1, count: 1, wordKey: 'in' },       // "in"
  //       { syllables: 1, count: 1, wordKey: 'a' },        // "a"
  //       { syllables: 1, count: 1, wordKey: 'one' },      // "one"
  //       { syllables: 1, count: 1, wordKey: 'horse' },    // "horse"
  //       { syllables: 2, count: 1, wordKey: 'open' },     // "open"
  //       { syllables: 1, count: 1, wordKey: 'sleigh' }    // "sleigh"
  //     ]
  //   ],
  //   original: [
  //     "Jingle bells",
  //     "Jingle bells",
  //     "Jingle all the way",
  //     "Oh what fun it is to ride",
  //     "in a one horse open sleigh"
  //   ]
  // },
};