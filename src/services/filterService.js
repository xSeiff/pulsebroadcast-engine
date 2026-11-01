const config = require("../config");

/**
 * Broadcast Target Resolution Service
 * Handles membership fetching, in-memory caching, role filtering, bot exclusions, and empty role targeting.
 * Made by xseif
 */

// In-memory cache for guild members to ensure instantaneous wizard response
// guildId -> { members: Array, timestamp: number }
const guildMembersCache = new Map();
const CACHE_TTL_MS = 120000; // 2 minutes

async function resolveTargetMembers(guild, options = {}) {
    if (!guild) return { members: [], stats: { total: 0, matched: 0, botsSkipped: 0 } };

    const {
        targetMode = config.targetModes.ALL,
        roleIds = [],
        excludeBots = true,
        forceRefresh = false
    } = options;

    let allMembers;
    const now = Date.now();
    const cached = guildMembersCache.get(guild.id);

    if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        allMembers = cached.members;
    } else {
        let membersCollection;
        try {
            console.log(`[FILTER] Fetching members from Discord Gateway for "${guild.name}" (${guild.id})...`);
            // Set limit or timeout to avoid freezing
            membersCollection = await guild.members.fetch({ time: 5000 }).catch(() => guild.members.cache);
        } catch (err) {
            console.warn(`[FILTER] Member fetch warning, using cache:`, err.message);
            membersCollection = guild.members.cache;
        }

        allMembers = Array.from(membersCollection.values());
        guildMembersCache.set(guild.id, { members: allMembers, timestamp: now });
        console.log(`[FILTER] Cached ${allMembers.length} members for "${guild.name}".`);
    }

    let botsSkipped = 0;
    const targetMembers = [];

    for (const member of allMembers) {
        // Bot filtering
        if (member.user.bot) {
            botsSkipped++;
            if (excludeBots) continue;
        }

        // Roles without the default @everyone role (safe across Collection & Map)
        let memberRoleIds = [];
        if (member.roles && member.roles.cache) {
            if (typeof member.roles.cache.filter === "function") {
                memberRoleIds = Array.from(member.roles.cache.filter((_, id) => id !== guild.id).keys());
            } else {
                memberRoleIds = Array.from(member.roles.cache.keys()).filter(id => id !== guild.id);
            }
        }

        switch (targetMode) {
            case config.targetModes.NO_ROLES:
                // Only members with NO custom roles
                if (memberRoleIds.length === 0) {
                    targetMembers.push(member);
                }
                break;

            case config.targetModes.WHITELIST_ROLES:
                // Only members having at least one of the selected roles
                if (roleIds.length > 0 && roleIds.some(rId => memberRoleIds.includes(rId))) {
                    targetMembers.push(member);
                }
                break;

            case config.targetModes.BLACKLIST_ROLES:
                // Members who DO NOT have any of the selected roles
                if (roleIds.length === 0 || !roleIds.some(rId => memberRoleIds.includes(rId))) {
                    targetMembers.push(member);
                }
                break;

            case config.targetModes.ALL:
            default:
                targetMembers.push(member);
                break;
        }
    }

    console.log(`[FILTER] Match results: ${targetMembers.length}/${allMembers.length} members (Mode: ${targetMode}, Bots skipped: ${botsSkipped})`);

    return {
        members: targetMembers,
        stats: {
            totalGuildMembers: allMembers.length,
            matchedCount: targetMembers.length,
            botsSkipped
        }
    };
}

function clearGuildCache(guildId) {
    if (guildId) guildMembersCache.delete(guildId);
    else guildMembersCache.clear();
}

module.exports = {
    resolveTargetMembers,
    clearGuildCache
};
