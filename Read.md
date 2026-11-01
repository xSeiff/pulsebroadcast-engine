# Discord Broadcast Bot v3 — Made by xseif

A high-performance Discord broadcast bot built with **Discord.js v14**, designed to broadcast direct messages across server members using multi-token parallel sharding, intelligent rate-limiting, and deep real-time progress monitoring.

---

## 🌟 Key Features

- **⚡ Distributed Multi-Token Sharding**:
  - Distributes member lists evenly across all healthy bot tokens (e.g., 10 bots broadcasting to 1,000 members = 100 members per bot simultaneously).
  - Maximizes throughput while preventing individual tokens from triggering Discord rate limits.

- **🎛️ Interactive Modern Dashboard**:
  - Full support for Discord Slash Commands: `/panel`, `/broadcast`, `/tokens`, `/settings`.
  - Built with modern Discord.js v14 UI components (`RoleSelectMenuBuilder`, `UserSelectMenuBuilder`, `StringSelectMenuBuilder`, Modals, and Buttons).

- **🛡️ Adaptive Send Speed & Anti-Ban Controls**:
  - **Safe / Anti-Ban**: ~1,500ms delay per token per DM.
  - **Balanced**: ~750ms delay per token per DM.
  - **Fast**: ~350ms delay per token per DM.
  - **Custom Delay**: Set any millisecond delay down to the millisecond.
  - **Automatic 429 Backoff**: Detects Discord rate limits and pauses the specific affected token for the exact retry window without stopping the entire broadcast.

- **🎯 Advanced Target Filtering**:
  - **All Members**: Broadcast to the entire server.
  - **Members With Specific Roles (Whitelist)**: Multi-select target roles with native Discord Role picker.
  - **Exclude Specific Roles (Blacklist)**: Exclude members who hold specific roles.
  - **Members With No Roles Only**: Target newcomers and unverified members who haven't acquired any role yet.
  - **Bot Filter**: Toggle whether bots are included or excluded.

- **📊 Overhauled Live Progress Monitor**:
  - High-resolution visual progress bar with live percentage and counters.
  - Real-time speed metrics (DMs/sec), elapsed time, and ETA countdown.
  - **Interactive Controls**: Live `Pause`, `Resume`, and `Cancel` buttons during the broadcast.

- **🔍 Comprehensive Error Reason Breakdown**:
  - 🚫 DMs Disabled / Privacy Settings (Error `50007`)
  - 🛑 Blocked / Missing Mutual Server
  - 🤖 Target is a Bot / System Message Denied
  - ⚠️ Rate Limited (HTTP `429`)
  - ❌ Token Flagged or Locked Mid-Broadcast
  - ❓ Other unexpected errors

- **🔑 Dedicated Token Hub**:
  - Live token health indicator (🟢 Valid, 🔴 Invalid, 🟡 Rate-limited).
  - Single and bulk token imports via Modal.
  - Dropdown token removal and one-click invalid token cleanup.
  - Choose specific tokens or use all healthy tokens.

- **🔒 Permissions & Access Control**:
  - Server Owner and Administrators retain master control.
  - Whitelist allowed roles using `RoleSelectMenu`.
  - Whitelist individual users using `UserSelectMenu`.

---

## 🚀 Getting Started

### 1. Requirements
- Node.js v18 or higher (v20+ recommended)
- Bot tokens with `GuildMembers` (`0x2`) Gateway Intent enabled in the [Discord Developer Portal](https://discord.com/developers/applications).

### 2. Configuration
Create or edit your `.env` file in the root folder:
```env
DISCORD_TOKEN=your_main_bot_token_here
CLIENT_ID=your_main_bot_application_id_here
GUILD_ID=optional_guild_id_for_instant_command_testing
```

### 3. Installation
```bash
npm install
```

### 4. Running the Bot
```bash
npm start
```

---

## 📜 Credits & Author
- **Developer**: xseif
- **Version**: 3.0.0
