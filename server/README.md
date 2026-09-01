# justdraw.in Server

[![Node Version](https://img.shields.io/badge/Node.js-18.x-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express Framework](https://img.shields.io/badge/Express-4.21.2-000000.svg?logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB Database](https://img.shields.io/badge/MongoDB-Mongoose%208.x-47A248.svg?logo=mongodb&logoColor=white)](https://www.mongodb.com)

This repository contains the backend REST API service, Socket.io real-time broadcast engine, WebRTC signalling handler, AI diagram pipelines, and custom Data Structures & Algorithms (DSA) optimization modules for **justdraw.in**.

---

## 🏛️ System Architecture

The server handles persistent data persistence via MongoDB while maintaining high-performance WebSocket connections for real-time multiplayer diagramming and WebRTC session management.

### Core Technologies
* **Runtime**: Node.js
* **API Framework**: Express.js with robust validation (`express-validator`) and security armor (`helmet`, `cors`).
* **Database & ODM**: MongoDB managed via Mongoose schemas (Workspaces, Boards, Pages, Users, AIUsage, Comments).
* **Real-time WebSockets**: Socket.io 4.x configured with JWT auth middleware and guest mode anonymity.
* **Authentication**: Stateless JSON Web Tokens (JWT) paired with Bcrypt password hash encryption and OAuth Google strategies.
* **File Processing**: Multer middleware for document asset upload handling.
* **Auto Keep-Alive**: Silent 5-minute heartbeat service keeping Render free-tier deployments warm 24/7.

---

## ⚡ Bespoke Data Structures & Algorithms (DSA) Integration

To overcome traditional SaaS database query bottlenecks under high user load, **justdraw** implements hand-crafted algorithm engines inside `/src/utils/`:

### 1. O(1) Least Recently Used (LRU) Cache (`lruCache.js`)
* **Data Structures Used**: Custom **Doubly Linked List** + **Hash Map (Map)**.
* **Mechanism**: Keeps the most active whiteboard workspaces in Node memory. All insertions and access operations execute in strictly $O(1)$ constant time by adjusting node pointer references. When capacity ($N=500$) is surpassed, the least recently used board at the tail is evicted cleanly.

### 2. O(k) Prefix Trie (`trie.js`)
* **Data Structures Used**: **Multi-way Character Trie (Prefix Tree)** with custom `TrieNode` maps.
* **Mechanism**: Provides instantaneous prefix matching for board titles and symbols without triggering slow database regex scans ($O(N)$). Searching executes in $O(k)$ time where $k$ represents query character length.

---

## 🚀 Local Installation & Setup

1. **Install Node Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the `server/` root directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/justdraw
   CLIENT_URL=http://localhost:5173
   JWT_SECRET=super_secret_enterprise_jwt_key_string
   ```

3. **Launch Server Service**:
   * **Development (Hot-Reload with Nodemon)**:
     ```bash
     npm run dev
     ```
   * **Production Node Server**:
     ```bash
     npm start
     ```

Verify server health by browsing to: `http://localhost:5000/api/health`.
