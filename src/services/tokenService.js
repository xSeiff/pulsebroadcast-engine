const { Client, GatewayIntentBits } = require("discord.js");
const storage = require("../database/storage");

/**
 * Token Management Hub & Worker Pool Service
 * Fast REST validation, health checking, bulk import, and multi-bot client instantiation.
 * Made by xseif
 */

// Validate a bot token directly via Discord REST API v10
async function validateTokenREST(token) {
    const cleanToken = token.trim().replace(/^Bot\s+/i, "");
    if (!cleanToken) {
        return { valid: false, status: "invalid", error: "Empty token provided" };
    }

    try {
        const response = await fetch("https://discord.com/api/v10/users/@me", {
            headers: {
                Authorization: `Bot ${cleanToken}`
            }
        });

        if (response.status === 200) {
            const data = await response.json();
            return {
                valid: true,
                status: "ready",
                user: {
                    id: data.id,
                    username: data.username,
                    tag: `${data.username}#${data.discriminator || "0"}`,
                    avatar: data.avatar
                }
            };
        } else if (response.status === 429) {
            const data = await response.json().catch(() => ({}));
            return {
                valid: true,
                status: "rate_limited",
                retryAfter: data.retry_after || 2,
                error: "Rate limited by Discord"
            };
        } else if (response.status === 401) {
            return {
                valid: false,
                status: "invalid",
                error: "Unauthorized (Invalid or revoked token)"
            };
        } else {
            return {
                valid: false,
                status: "invalid",
                error: `HTTP ${response.status} from Discord API`
            };
        }
    } catch (err) {
        return {
            valid: false,
            status: "error",
            error: err.message
        };
    }
}

// Check health of all currently saved tokens
async function checkAllTokensHealth() {
    const all = storage.tokens.getAll();
    const results = [];

    for (const record of all) {
        const check = await validateTokenREST(record.token);
        if (check.valid && check.status === "ready") {
            storage.tokens.updateStatus(record.id, "ready");
            results.push({ ...record, status: "ready" });
        } else if (check.status === "rate_limited") {
            storage.tokens.updateStatus(record.id, "rate_limited", `Wait ${check.retryAfter}s`);
            results.push({ ...record, status: "rate_limited" });
        } else {
            storage.tokens.updateStatus(record.id, "invalid", check.error);
            results.push({ ...record, status: "invalid", error: check.error });
        }
    }

    return results;
}

// Add a single token
async function addToken(rawToken) {
    const check = await validateTokenREST(rawToken);
    if (!check.valid) {
        return { success: false, error: check.error };
    }

    const saved = storage.tokens.add(rawToken.trim(), check.user);
    return { success: true, token: saved };
}

// Bulk add tokens from string (lines or comma-separated)
async function bulkAddTokens(rawInput) {
    // Split by newlines, commas, or semicolons
    const candidates = rawInput
        .split(/[\r\n,;]+/)
        .map(t => t.trim())
        .filter(t => t.length > 20); // Discord tokens are at least 50+ chars

    const added = [];
    const failed = [];

    for (const token of candidates) {
        const result = await addToken(token);
        if (result.success) {
            added.push(result.token);
        } else {
            failed.push({ token: token.substring(0, 15) + "...", error: result.error });
        }
    }

    return { added, failed, totalProcessed: candidates.length };
}

// Remove invalid tokens
async function cleanupInvalidTokens() {
    const all = await checkAllTokensHealth();
    const invalidIds = all.filter(t => t.status === "invalid").map(t => t.id);
    const removedCount = storage.tokens.removeInvalid(invalidIds);
    return { removedCount, remainingCount: all.length - removedCount };
}

// Spawn an active Client worker pool for broadcasting
async function createWorkerPool(selectedTokenRecords = null) {
    const all = storage.tokens.getAll();
    const targetTokens = selectedTokenRecords && selectedTokenRecords.length > 0
        ? selectedTokenRecords
        : all.filter(t => t.status !== "invalid");

    const pool = [];
    for (const record of targetTokens) {
        const workerClient = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
        });

        try {
            await workerClient.login(record.token);
            pool.push({
                client: workerClient,
                record,
                id: record.id,
                name: record.username,
                isRateLimited: false,
                rateLimitReleaseAt: 0
            });
        } catch (err) {
            console.error(`Failed to login worker token for ${record.username}:`, err.message);
            storage.tokens.updateStatus(record.id, "invalid", err.message);
            try { workerClient.destroy(); } catch (_) {}
        }
    }

    return pool;
}

// Cleanly destroy worker pool
async function destroyWorkerPool(pool) {
    if (!Array.isArray(pool)) return;
    for (const worker of pool) {
        try {
            await worker.client.destroy();
        } catch (_) {}
    }
}

module.exports = {
    validateTokenREST,
    checkAllTokensHealth,
    addToken,
    bulkAddTokens,
    cleanupInvalidTokens,
    createWorkerPool,
    destroyWorkerPool
};
