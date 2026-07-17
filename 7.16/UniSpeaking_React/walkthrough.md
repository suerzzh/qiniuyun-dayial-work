# Walkthrough - UniSpeaking React Workspace

We have successfully migrated the UniSpeaking UI prototype from Monday's vanilla JS structure to this modern **Vite + React** single page application (SPA).

## Workspace Structure

This directory `Week2/Tue./UniSpeaking_React` contains:
- **[package.json](file:///Users/lx/Library/Mobile%20Documents/com~apple~CloudDocs/七牛云/英语口语陪练/milestone1/Week2/Tue./UniSpeaking_React/package.json)**: Configured React and Vite dependencies.
- **[vite.config.js](file:///Users/lx/Library/Mobile%20Documents/com~apple~CloudDocs/七牛云/英语口语陪练/milestone1/Week2/Tue./UniSpeaking_React/vite.config.js)**: Configures Vite to compile JSX using the React plugin.
- **[index.html](file:///Users/lx/Library/Mobile%20Documents/com~apple~CloudDocs/七牛云/英语口语陪练/milestone1/Week2/Tue./UniSpeaking_React/index.html)**: Sets up the React DOM mounting point and imports `/src/main.jsx`.
- **[styles.css](file:///Users/lx/Library/Mobile%20Documents/com~apple~CloudDocs/七牛云/英语口语陪练/milestone1/Week2/Tue./UniSpeaking_React/styles.css)**: Kept fully intact for 100% style fidelity.
- **`src/`**: The entire React source code:
  - **[main.jsx](file:///Users/lx/Library/Mobile%20Documents/com~apple~CloudDocs/七牛云/英语口语陪练/milestone1/Week2/Tue./UniSpeaking_React/src/main.jsx)**: Application mounting entrypoint.
  - **[App.jsx](file:///Users/lx/Library/Mobile%20Documents/com~apple~CloudDocs/七牛云/英语口语陪练/milestone1/Week2/Tue./UniSpeaking_React/src/App.jsx)**: Handles hash-routing, global reactive states, theme binding, and shell layouts.
  - **[data.js](file:///Users/lx/Library/Mobile%20Documents/com~apple~CloudDocs/七牛云/英语口语陪练/milestone1/Week2/Tue./UniSpeaking_React/src/data.js)**: Unified mockup data collections.
  - **`components/`**: Reusable elements: `Icon`, `VoiceOrb`, `StageProgress`, `ProfileSidebar`, `PageHeading`.
  - **`views/`**: React functional components for the 9 pages (Auth, Conversation, CustomScene, Membership, Profile, Review, ReviewDetail, Scenes, Training).

---

## Local Development Instructions

You can run this React project on your local machine with the following commands:

1. Open your terminal and navigate to this workspace:
   ```bash
   cd "/Users/lx/Library/Mobile Documents/com~apple~CloudDocs/七牛云/英语口语陪练/milestone1/Week2/Tue./UniSpeaking_React"
   ```
2. Install the package dependencies:
   ```bash
   npm install
   ```
3. Start the Vite local development server:
   ```bash
   npm run dev
   ```
4. Open the local address outputted in the terminal (usually `http://localhost:5173`) in your browser to test and develop!
