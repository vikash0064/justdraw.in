# 🎨 justdraw.in — Collaborative Whiteboard, Architecture Diagrams & Notes Suite

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-justdraw--in.onrender.com-6366f1?style=for-the-badge)](https://justdraw-in.onrender.com)

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933.svg?logo=node.js)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101.svg?logo=socket.io)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248.svg?logo=mongodb)](https://www.mongodb.com/)

> 🌐 **Live at**: [https://justdraw-in.onrender.com](https://justdraw-in.onrender.com)

**justdraw.in** is an all-in-one real-time collaborative workspace platform. Built for designers, developers, students, and product teams, **justdraw** combines high-performance interactive whiteboard studios, cloud system architecture builders, SQL ER diagram modeling, and Apple Notes-style digital notebook canvas with AI intelligence.

---

## ✨ Features & Studio Modes

### 1. 🖌️ Freehand Whiteboard Studio (Board 1)
- Infinite vector drawing canvas with smooth pressure-sensitive pen, pencil, and highlighter strokes.
- Geometric shapes (rectangles, ellipses, diamonds, frames, custom curved arrows).
- Sticky notes, live text typing, and drag-and-drop web image embeds.

### 2. 🏛️ Cloud Architecture Studio (Board 2)
- Cloud infrastructure blueprints & microservice topology diagramming.
- Preset tech icons (Docker, Kubernetes, AWS Lambda, PostgreSQL, Redis, GraphQL, React, etc.).
- Auto-routing connection arrows and system design export.

### 3. 🗄️ SQL Entity-Relationship (ERD) Studio (Board 3)
- Interactive database schemas with visual field definitions (keys, data types, nullability).
- Foreign-key connecting lines and schema generator.

### 4. 📝 Digital A4 Notes Board Studio (Board 4 - Apple Notes Mode)
- Realistic vertical continuous A4 paper sheets (Plain, Ruled Lined, Dotted, and Grid patterns).
- Apple Pencil markup toolbar, laser pointer, and dark smooth eraser.
- Multi-page management strip with page thumbnails, reordering, duplicate, and PDF export.

### 5. 🤖 AI Diagram & Chat Integration
- Multi-LLM provider support (Gemini Flash, OpenAI GPT-4o-mini).
- Text-to-Diagram generator, Mermaid sequence/flowchart compiler, and Wireframe-to-React generator.

### 6. ⚡ Multi-User Collaboration & WebRTC
- Multi-user real-time cursors with color-coded presence tags.
- In-canvas audio/video peer-to-peer conferencing and team room chat.
- Live canvas comments with resolved/pending pin indicators.

### 7. 🚀 Built-in Render Free Tier Keep-Alive
- Silent automated background heartbeat service keeps the backend awake 24/7 on free-tier deployments.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Konva.js (React-Konva), Framer Motion, Lucide React, Socket.io-client.
- **Backend**: Node.js, Express, Socket.io, MongoDB / Mongoose, Passport JWT, WebRTC signaling.
- **Algorithms**: Handcrafted Trie indexer for instant board search & LRU Cache buffer for low-latency canvas broadcasting.

---

## 🚀 Quick Start (Local Development)

### 1. Clone the repository
```bash
git clone https://github.com/vikash0064/justdraw.in.git
cd justdraw.in
```

### 2. Backend Setup
```bash
cd server
npm install
npm run dev
```

### 3. Frontend Setup
```bash
cd ../client
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 📄 License & Author

Developed and maintained solely by **Vikash Kushwaha** ([@vikash0064](https://github.com/vikash0064)).  
Licensed under the **ISC License**.
