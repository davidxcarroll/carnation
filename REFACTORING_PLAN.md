# Carnation App Refactoring Plan

## Goal

Reorganize the App.jsx file (2940 lines) into a maintainable structure that preserves all current functionality and appearance.

## Approach

**Incremental Extraction**: Move code in small, testable chunks rather than a complete rewrite.

## Recommended Structure

```
src/
├── components/           # UI Components
│   ├── IdeaList.jsx      # Ideas List & Items
│   ├── IdeaItem.jsx      # Individual Idea component
│   ├── TagBadge.jsx      # Tag badge component (DONE)
│   └── Sidebar.jsx       # Sidebar components
├── hooks/                # Custom React hooks
│   ├── useTextUtils.js   # Text utility functions (DONE)
│   ├── useFirebase.js    # Firebase operations (DONE)
│   ├── useIdeas.js       # Idea management logic
│   └── useKeyboard.js    # Keyboard handling logic
├── utils/                # Utility functions
│   └── textUtils.js      # Text manipulation utilities (DONE)
├── views/                # Main application views (Future)
│   ├── HomeView.jsx      # Main application view
│   ├── SettingsView.jsx  # Settings modal
│   └── AIBoostView.jsx   # AI enhancement interface
├── App.jsx               # Main app component (gradually simplified)
└── AppState.jsx          # Main state management (Future)
```

## Refactoring Steps

### Phase A: Core Utilities (Minimal Impact) ✓
1. [x] Extract text utilities to `utils/textUtils.js`
2. [x] Create `hooks/useTextUtils.js` for text related functionality
3. [x] Create `components/TagBadge.jsx` as a simple UI component
4. [x] Create `hooks/useFirebase.js` with Firebase operations

### Phase B: Careful Integration (Current Phase)
1. [x] Update App.jsx to use the useTextUtils hook
2. [x] Integrate TagBadge component in one place
3. [x] Introduce useFirebase hook for selected operations
4. [ ] Fix linter warnings and improve code quality

### Phase C: Component Extraction (Current Phase)
1. [x] Create `components/IdeaItem.jsx` for individual idea rendering
2. [x] Create `components/TagSelector.jsx` for tag selection UI
3. [x] Create `components/IdeaColumn.jsx` for a column of ideas
4. [x] Begin integrating the new components into App.jsx
5. [ ] Complete integration of all components and fix any issues

### Phase D: Business Logic Extraction (Current Phase)
1. [x] Create `hooks/useIdeas.js` for idea management logic
2. [x] Create `hooks/useTags.js` for tag management logic
3. [x] Create `hooks/useKeyboard.js` for keyboard handlers
4. [ ] Integrate these hooks into App.jsx incrementally
5. [ ] Test and ensure all functionality works correctly

### Phase E: View Extraction (Future)
1. [ ] Create initial `views/HomeView.jsx` component
2. [ ] Extract main UI from App.jsx into HomeView

## Implementation Notes

- Each change must be tested thoroughly before moving to the next
- At any point, we can revert to the original App.jsx if issues arise
- The app must remain fully functional throughout the process

## Current Progress

✅ Extracted utility functions to separate files
✅ Created a reusable TagBadge component
✅ Created hooks for text utilities and Firebase operations
✅ Created components for IdeaItem, TagSelector, and IdeaColumn
✅ Fixed linter warning regarding constant reassignment
✅ Integrated TagSelector and IdeaColumn components into App.jsx
✅ Created business logic hooks for ideas, tags, and keyboard handling
🔄 Working on integrating the business logic hooks

## Latest Updates
- Started incremental integration of useTags and useIdeas hooks in App.jsx
- Resolved naming conflicts by removing duplicate variable declarations
- Fixed import issues with useTextUtils hook to avoid duplication
- Created useIdeas hook for managing idea state and operations
- Created useTags hook for managing tag state and operations
- Created useKeyboard hook for keyboard event handling
- Integrated complete useTextUtils hook into App.jsx replacing scattered text utility functions
- Integrated TagSelector component to replace hardcoded tag selection UI
- Integrated IdeaColumn component for all columns (all, untagged, and tag columns)

## Current Status
- Now successfully using useTags hook for tag state management
- Gradually integrating useIdeas hook for state management 
- Started removing redundant state variables
- Still need to replace function implementations with hook implementations

## Next Steps
1. Continue replacing duplicate functionality in App.jsx with hook implementations
2. Test and ensure each hook works correctly when integrated
3. Finally integrate useKeyboard hook after other functionality is stable
4. Complete final testing to ensure all hooked functionality works correctly 