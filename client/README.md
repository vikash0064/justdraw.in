# justdraw.in Client

[![React Version](https://img.shields.io/badge/React-19.2.0-blue.svg?logo=react)](https://react.dev)
[![Vite Engine](https://img.shields.io/badge/Vite-7.3.1-646CFF.svg?logo=vite&logoColor=white)](https://vite.dev)
[![Konva Canvas](https://img.shields.io/badge/Canvas-React--Konva-00C4CC.svg)](https://konvajs.org/docs/react/)

This repository contains the frontend single-page application (SPA) for **justdraw.in**, a real-time collaborative whiteboard, cloud architecture diagramming, and digital A4 Apple Notes suite.

---

## 🛠️ Architecture & Technology Stack

Designed from the ground up for zero-lag collaborative interaction, the frontend client bridges declarative React UI components with imperative high-speed HTML5 Canvas graphics.

### Core Technologies
* **Framework**: [React 19](https://react.dev/) via [Vite](https://vitejs.dev/) for sub-second hot module replacement (HMR) and optimized production builds.
* **Graphics & Rendering**: [Konva.js](https://konvajs.org/) / [React-Konva](https://konvajs.org/docs/react/) for handling complex 2D canvas manipulation, shape drag-and-drop, transform bounding boxes, and layer scaling.
* **Real-time Communication**: [Socket.io-client](https://socket.io/) for bidirectional WebSocket synchronization of strokes, shapes, pointers, and group chat messaging.
* **WebRTC Video Calls**: [simple-peer](https://github.com/feross/simple-peer) for establishing low-latency peer-to-peer media streams (video, microphone audio, screen sharing) inside active workspaces.
* **Animations & Styling**: [Framer Motion](https://www.framer.com/motion/) for fluid interface transitions, paired with clean Vanilla CSS design tokens.
* **Asset Export Engine**: [jsPDF](https://github.com/parallax/jsPDF) and Konva data URL serialization to generate high-resolution PNG snapshots and multi-page PDF documents.

---

## 🎨 Key Features

* **Multiplayer Cursor Tracking**: Renders live remote avatars and pointer coordinates across distributed team sessions.
* **Infinite Canvas Engine**: Includes support for free-hand sketch drawing, geometric shapes, sticky notes, typography layers, and database ER schema tables.
* **Embedded Video Collaboration**: Unifies voice and video streaming inside the drawing workspace without switching tabs or requiring external plugins.
* **Algorithmic Autocomplete Integration**: Interacts with backend **Prefix Trie** endpoints to provide instantaneous, zero-delay board search suggestions.
* **Responsive Workspace Dashboard**: Intuitive management of workspaces, member permissions, guest access links, and multi-page canvas tabs.

---

## 🚀 Local Developer Setup

### Prerequisites
* Node.js v18+ and npm

### Installation Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the `client/` root specifying your backend API target:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

### Production Build & Linting

* **Compile Bundle**:
  ```bash
  npm run build
  ```
  Generates production assets inside `/dist`.
