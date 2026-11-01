const config = require("../config");
const storage = require("../database/storage");

/**
 * Access Control Service
 * Strict Bot Owner (ID: 938056009459576882) authorization model.
 * Server Owner and Discord Admins do NOT have default access.
 * Made by xseif
 */

function isBotOwner(userId) {
    return Boolean(userId && String(userId) === String(config.bot.ownerId));
}

function isAuthorized(interactionOrMessage) {
    const member = interactionOrMessage.member;
    const user = interactionOrMessage.user || interactionOrMessage.author;

    if (!user) return false;

    // 1. Bot Owner always has master root access
    if (isBotOwner(user.id)) return true;

    // 2. Check Whitelists configured by the bot owner
    const currentSettings = storage.settings.get();

    // Whitelisted User ID
    if (Array.isArray(currentSettings.adminUserIds) && currentSettings.adminUserIds.includes(user.id)) {
        return true;
    }

    // Whitelisted Role ID
    if (member && member.roles && member.roles.cache) {
        const hasWhitelistedRole = Array.isArray(currentSettings.adminRoles) && currentSettings.adminRoles.some(roleId => member.roles.cache.has(roleId));
        if (hasWhitelistedRole) return true;
    }

    return false;
}

function canManagePermissions(interaction) {
    const user = interaction.user || interaction.author;
    if (!user) return false;
    // ONLY the Bot Owner can manage permissions and settings
    return isBotOwner(user.id);
}

function setAuthorizedRoles(roleIds) {
    storage.settings.update({ adminRoles: roleIds });
    return roleIds;
}

function setAuthorizedUsers(userIds) {
    storage.settings.update({ adminUserIds: userIds });
    return userIds;
}

function getAccessLists() {
    const current = storage.settings.get();
    return {
        roles: current.adminRoles || [],
        users: current.adminUserIds || []
    };
}

module.exports = {
    isBotOwner,
    isAuthorized,
    canManagePermissions,
    setAuthorizedRoles,
    setAuthorizedUsers,
    getAccessLists
};
