const fs = require("fs");
const path = require("path");
const config = require("../config");

const DATA_DIR = config.paths.dataDir;

// Ensure database directory and files exist
function initialize() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const defaultSchemas = {
        "tokens.json": [],
        "settings.json": {
            adminRoles: [],
            adminUserIds: [],
            defaultSpeed: "safe",
            defaultDelayMs: 1500,
            excludeBots: true,
            useAllBots: true
        },
        "broadcasts.json": [],
        "templates.json": [],
        "audit_logs.json": []
    };

    for (const [filename, defaultData] of Object.entries(defaultSchemas)) {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) {
            safeWrite(filePath, defaultData);
        } else {
            // Verify readability and heal if empty or corrupted
            try {
                const content = fs.readFileSync(filePath, "utf8").trim();
                if (!content) {
                    safeWrite(filePath, defaultData);
                }
            } catch (e) {
                console.error(`Healing corrupted file ${filename}:`, e.message);
                safeWrite(filePath, defaultData);
            }
        }
    }
}

// Thread-safe atomic file writing (writes to a .tmp file then renames)
function safeWrite(filePath, data) {
    try {
        const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(7)}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 4), "utf8");
        fs.renameSync(tempPath, filePath);
        return true;
    } catch (err) {
        console.error(`Failed to atomically write ${filePath}:`, err);
        // Fallback to direct write if rename fails on Windows lock
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf8");
            return true;
        } catch (innerErr) {
            console.error(`Critical write failure for ${filePath}:`, innerErr);
            return false;
        }
    }
}

// Safe read
function safeRead(filename, fallback = []) {
    try {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, "utf8");
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Failed to read ${filename}:`, err.message);
        return fallback;
    }
}

// ----------------- TOKENS API -----------------
const tokens = {
    getAll: () => safeRead("tokens.json", []),
    getById: (id) => tokens.getAll().find(t => t.id === id),
    getByToken: (token) => tokens.getAll().find(t => t.token === token),
    add: (token, botUser) => {
        const all = tokens.getAll();
        const existingIndex = all.findIndex(t => t.token === token || t.id === botUser.id);
        const record = {
            id: botUser.id,
            username: botUser.username,
            tag: botUser.tag || `${botUser.username}#0000`,
            avatar: botUser.avatar ? `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.avatar}.png` : null,
            token,
            status: "ready", // ready, rate_limited, invalid
            lastChecked: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            all[existingIndex] = { ...all[existingIndex], ...record };
        } else {
            all.push(record);
        }
        safeWrite(path.join(DATA_DIR, "tokens.json"), all);
        return record;
    },
    updateStatus: (tokenOrId, status, details = null) => {
        const all = tokens.getAll();
        const item = all.find(t => t.token === tokenOrId || t.id === tokenOrId);
        if (item) {
            item.status = status;
            item.lastChecked = new Date().toISOString();
            if (details) item.statusDetails = details;
            safeWrite(path.join(DATA_DIR, "tokens.json"), all);
        }
    },
    remove: (tokenOrId) => {
        const all = tokens.getAll();
        const filtered = all.filter(t => t.token !== tokenOrId && t.id !== tokenOrId);
        safeWrite(path.join(DATA_DIR, "tokens.json"), filtered);
        return filtered.length < all.length;
    },
    removeInvalid: (invalidIds) => {
        const all = tokens.getAll();
        const filtered = all.filter(t => !invalidIds.includes(t.id) && !invalidIds.includes(t.token));
        safeWrite(path.join(DATA_DIR, "tokens.json"), filtered);
        return all.length - filtered.length;
    }
};

// ----------------- SETTINGS API -----------------
const settings = {
    get: () => {
        const current = safeRead("settings.json", {});
        // Ensure defaults and backward compatibility
        return {
            adminRoles: Array.isArray(current.adminRoles) ? current.adminRoles : (current.adminRole ? [current.adminRole] : []),
            adminUserIds: Array.isArray(current.adminUserIds) ? current.adminUserIds : (Array.isArray(current.adminIds) ? current.adminIds : []),
            defaultSpeed: current.defaultSpeed || "safe",
            defaultDelayMs: current.defaultDelayMs || 1500,
            excludeBots: current.excludeBots !== false,
            useAllBots: current.useAllBots !== false
        };
    },
    update: (updates) => {
        const current = settings.get();
        const merged = { ...current, ...updates };
        safeWrite(path.join(DATA_DIR, "settings.json"), merged);
        return merged;
    },
    addAdminRole: (roleId) => {
        const current = settings.get();
        if (!current.adminRoles.includes(roleId)) {
            current.adminRoles.push(roleId);
            settings.update({ adminRoles: current.adminRoles });
        }
    },
    removeAdminRole: (roleId) => {
        const current = settings.get();
        settings.update({ adminRoles: current.adminRoles.filter(r => r !== roleId) });
    },
    addAdminUser: (userId) => {
        const current = settings.get();
        if (!current.adminUserIds.includes(userId)) {
            current.adminUserIds.push(userId);
            settings.update({ adminUserIds: current.adminUserIds });
        }
    },
    removeAdminUser: (userId) => {
        const current = settings.get();
        settings.update({ adminUserIds: current.adminUserIds.filter(u => u !== userId) });
    }
};

// ----------------- BROADCASTS API -----------------
const broadcasts = {
    getAll: () => safeRead("broadcasts.json", []),
    getById: (id) => broadcasts.getAll().find(b => b.id === id),
    create: (data) => {
        const all = broadcasts.getAll();
        const newRecord = {
            id: Date.now().toString(),
            guildId: data.guildId,
            authorId: data.authorId,
            authorTag: data.authorTag,
            message: data.message,
            targetMode: data.targetMode || "all",
            roles: data.roles || [],
            excludeBots: data.excludeBots !== false,
            speedMode: data.speedMode || "safe",
            delayMs: data.delayMs || 1500,
            botCount: data.botCount || 1,
            totalTargets: data.totalTargets || 0,
            successCount: 0,
            failureCount: 0,
            errorSummary: {
                dmsClosed: 0,
                blocked: 0,
                isBot: 0,
                rateLimited: 0,
                tokenInvalid: 0,
                other: 0
            },
            status: "running", // running, paused, cancelled, completed
            startedAt: new Date().toISOString(),
            completedAt: null
        };
        all.push(newRecord);
        safeWrite(path.join(DATA_DIR, "broadcasts.json"), all);
        return newRecord;
    },
    update: (id, updates) => {
        const all = broadcasts.getAll();
        const index = all.findIndex(b => b.id === id);
        if (index >= 0) {
            all[index] = { ...all[index], ...updates };
            safeWrite(path.join(DATA_DIR, "broadcasts.json"), all);
            return all[index];
        }
        return null;
    },
    getStats: () => {
        const all = broadcasts.getAll();
        const completed = all.filter(b => b.status === "completed" || b.status === "cancelled");
        const totalSuccessful = all.reduce((acc, b) => acc + (b.successCount || 0), 0);
        const totalFailed = all.reduce((acc, b) => acc + (b.failureCount || 0), 0);
        const totalMessages = totalSuccessful + totalFailed;
        const successRate = totalMessages > 0 ? ((totalSuccessful / totalMessages) * 100).toFixed(1) : "100.0";

        return {
            totalBroadcasts: all.length,
            completedCount: completed.length,
            totalSuccessful,
            totalFailed,
            successRate
        };
    }
};

// ----------------- TEMPLATES API -----------------
const templates = {
    getAll: () => safeRead("templates.json", []),
    getById: (id) => templates.getAll().find(t => t.id === id),
    create: (name, content, authorTag) => {
        const all = templates.getAll();
        const record = {
            id: Date.now().toString(),
            name,
            content,
            authorTag,
            createdAt: new Date().toISOString(),
            useCount: 0
        };
        all.push(record);
        safeWrite(path.join(DATA_DIR, "templates.json"), all);
        return record;
    },
    delete: (id) => {
        const all = templates.getAll();
        const filtered = all.filter(t => t.id !== id);
        safeWrite(path.join(DATA_DIR, "templates.json"), filtered);
    },
    incrementUsage: (id) => {
        const all = templates.getAll();
        const item = all.find(t => t.id === id);
        if (item) {
            item.useCount = (item.useCount || 0) + 1;
            safeWrite(path.join(DATA_DIR, "templates.json"), all);
        }
    }
};

// ----------------- AUDIT LOGS API -----------------
const auditLogs = {
    getAll: () => safeRead("audit_logs.json", []),
    log: (userId, username, action, details) => {
        const all = auditLogs.getAll();
        all.push({
            id: Date.now().toString(),
            userId,
            username,
            action,
            details,
            timestamp: new Date().toISOString()
        });
        if (all.length > 500) all.shift();
        safeWrite(path.join(DATA_DIR, "audit_logs.json"), all);
    },
    getRecent: (count = 10) => {
        const all = auditLogs.getAll();
        return all.slice(-count).reverse();
    }
};

module.exports = {
    initialize,
    tokens,
    settings,
    broadcasts,
    templates,
    auditLogs
};
