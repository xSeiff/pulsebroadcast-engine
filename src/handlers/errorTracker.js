/**
 * Error Taxonomy & Tracking for Discord Broadcast Operations
 * Categorizes Discord REST / Gateway errors into human-readable buckets.
 */

const ERROR_CATEGORIES = {
    DMS_CLOSED: "dmsClosed",
    BLOCKED: "blocked",
    IS_BOT: "isBot",
    RATE_LIMITED: "rateLimited",
    TOKEN_INVALID: "tokenInvalid",
    OTHER: "other"
};

const ERROR_LABELS = {
    dmsClosed: { label: "🚫 DMs Closed / Privacy", desc: "User has DMs closed for server members" },
    blocked: { label: "🛑 Blocked / No Mutual Server", desc: "Bot cannot access member DM channel" },
    isBot: { label: "🤖 Bot Account", desc: "Bots cannot receive DMs" },
    rateLimited: { label: "⚠️ Rate Limited (HTTP 429)", desc: "Exceeded Discord rate-limit quota" },
    tokenInvalid: { label: "❌ Token Expired / Banned", desc: "Token was flagged or invalidated" },
    other: { label: "❓ Other / Network Failure", desc: "Unexpected socket or REST error" }
};

function classifyError(error, targetUser = null) {
    if (targetUser && targetUser.bot) {
        return {
            category: ERROR_CATEGORIES.IS_BOT,
            reason: "Target is a bot account",
            code: 0
        };
    }

    if (!error) {
        return { category: ERROR_CATEGORIES.OTHER, reason: "Unknown error", code: 0 };
    }

    const code = error.code || error.status;
    const msg = String(error.message || "").toLowerCase();

    // 50007: Cannot send messages to this user
    if (code === 50007 || msg.includes("cannot send messages to this user")) {
        return {
            category: ERROR_CATEGORIES.DMS_CLOSED,
            reason: "User has server DMs disabled in privacy settings",
            code: 50007
        };
    }

    // 50001: Missing Access
    if (code === 50001 || msg.includes("missing access")) {
        return {
            category: ERROR_CATEGORIES.BLOCKED,
            reason: "Missing access or blocked by user",
            code: 50001
        };
    }

    // 429: Rate limited
    if (code === 429 || error.status === 429 || msg.includes("rate limit") || msg.includes("retry_after")) {
        return {
            category: ERROR_CATEGORIES.RATE_LIMITED,
            reason: "Discord rate limit hit",
            retryAfter: error.retryAfter || (error.rawError && error.rawError.retry_after) || 2000,
            code: 429
        };
    }

    // Token invalid or unauthenticated
    if (code === 40001 || code === 401 || msg.includes("token") || msg.includes("an invalid token was provided")) {
        return {
            category: ERROR_CATEGORIES.TOKEN_INVALID,
            reason: "Bot token is invalid or terminated",
            code: 401
        };
    }

    return {
        category: ERROR_CATEGORIES.OTHER,
        reason: error.message || "Failed to deliver message",
        code: code || -1
    };
}

function formatErrorSummary(summary) {
    if (!summary) return "None";
    const lines = [];
    if (summary.dmsClosed > 0) lines.push(`🚫 **DMs Closed**: \`${summary.dmsClosed}\``);
    if (summary.blocked > 0) lines.push(`🛑 **Blocked / No Access**: \`${summary.blocked}\``);
    if (summary.isBot > 0) lines.push(`🤖 **Bots Skipped**: \`${summary.isBot}\``);
    if (summary.rateLimited > 0) lines.push(`⚠️ **Rate Limits Handled**: \`${summary.rateLimited}\``);
    if (summary.tokenInvalid > 0) lines.push(`❌ **Invalid Tokens**: \`${summary.tokenInvalid}\``);
    if (summary.other > 0) lines.push(`❓ **Other Errors**: \`${summary.other}\``);
    return lines.length > 0 ? lines.join("\n") : "✅ No errors encountered";
}

module.exports = {
    ERROR_CATEGORIES,
    ERROR_LABELS,
    classifyError,
    formatErrorSummary
};
