# PulseBroadcast Engine 📡

> **Distributed Multi-Guild Announcement & Webhook Synchronization Dispatcher**

[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

A high-throughput announcement delivery engine designed for multi-server communities and network operations. Allows administrators to broadcast rich embeds with interactive action buttons across multiple channels or guilds simultaneously while enforcing strict sliding-window rate limit backoffs.

---

## ⚡ Features

- **Sliding-Window Rate Limiting**: Intelligent pacing engine preventing HTTP 429 drops during mass dispatch.
- **Rich Embed Composer**: Interactive builder supporting action rows, custom buttons, author branding, and timestamps.
- **Delivery Analytics**: Logs dispatch confirmations and isolates invalid or expired webhook endpoints.
- **Asynchronous Queue Worker**: Decoupled job runner ensuring non-blocking performance during heavy broadcasts.

---

## 🚀 Setup & Usage

### 1. Installation
```bash
git clone https://github.com/xSeiff/pulsebroadcast-engine.git
cd pulsebroadcast-engine
npm install
```

### 2. Configuration
```bash
cp .env.example .env
```
Provide your `DISCORD_TOKEN` and server configuration.

### 3. Run the Dispatcher
```bash
node src/index.js
```

---

## 📜 License
This project is licensed under the MIT License.

Developed by [Seif (@xSeiff)](https://github.com/xSeiff).
