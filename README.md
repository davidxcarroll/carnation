# Carnation

A modern idea management tool to organize your thoughts by tags and categories.

## Project Structure

The codebase has been organized to improve maintainability and separation of concerns:

```
src/
├── components/                 # Reusable UI components
│   ├── IdeaComponents.jsx      # Idea-related UI components
│   ├── TagComponents.jsx       # Tag-related UI components
│   └── ToolsPanel.jsx          # Tools panel components
├── contexts/                   # React contexts for state management
│   ├── AppContext.jsx          # Main application state
│   └── FirebaseContext.jsx     # Firebase-related operations
├── hooks/                      # Custom React hooks
│   ├── useIdeas.js             # Idea management logic
│   ├── useKeyboardHandlers.js  # Keyboard interaction logic
│   └── useTags.js              # Tag management logic
├── utils/                      # Utility functions
│   └── textUtils.js            # Text manipulation utilities
├── views/                      # Main application views
│   ├── AIBoostView.jsx         # AI enhancement interface
│   ├── HomeView.jsx            # Main application view
│   └── SettingsView.jsx        # Settings interface
├── App.jsx                     # Main app component
├── firebase.js                 # Firebase configuration
├── index.css                   # Global styles
└── main.jsx                    # Application entry point
```

## Implementation Approach

The application has been structured following these principles:

1. **Context-Based State Management**: Using React contexts to manage and share application state without prop drilling.

2. **Custom Hooks for Logic**: Isolating business logic in custom hooks for better reuse and testing.

3. **Component Patterns**: 
   - Views: Full-page components that combine multiple UI elements
   - Components: Reusable UI elements grouped by domain (ideas, tags, etc.)
   - Patterns: Reusable UI patterns kept in single files rather than traditional component libraries

4. **Modular Firebase Integration**: Firebase services are wrapped in a context to make them easily accessible throughout the app.

## How to Switch to the New Structure

To migrate to the new structure:

1. Make sure you have all the new files in place
2. Rename `src/App.jsx.reorganized` to `src/App.jsx` to replace the original file
3. Start the application as usual

## Adding New Features

The modular structure makes it easy to add new features:

1. **New Tool or Modal**: Add a new view in the `views/` directory and update `HomeView.jsx` to display it.

2. **New Data Feature**: Add the necessary Firebase operations to `FirebaseContext.jsx` and create a custom hook in the `hooks/` directory.

3. **New UI Component**: Add it to the appropriate file in `components/` directory or create a new component file if it's a new category.

4. **New Global State**: Add it to the appropriate context in `contexts/` directory.

## Recommended Development Approach

When developing new features, consider these tips:

1. Start by understanding the feature's data requirements and add them to the appropriate context
2. Create or update hooks for the business logic
3. Implement the UI components
4. Integrate the feature into the appropriate view

This approach maintains separation of concerns and keeps the codebase maintainable.

## Development

This project uses React with Vite and Firebase for backend services.

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Firebase account

### Setup

1. Clone the repository
```bash
git clone https://github.com/davidxcarroll/carnation.git
cd carnation
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file with your Firebase configuration
```
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

4. Start the development server
```bash
npm start
```

## License

This project is licensed under the MIT License.
