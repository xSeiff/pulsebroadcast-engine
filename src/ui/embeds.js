const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const errorTracker = require("../handlers/errorTracker");

/**
 * Reusable Embed Factory for Discord Broadcast Bot v3
 * Made by xseif
 */

function createBaseEmbed(title = "", description = "") {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(config.bot.color)
        .setFooter({ text: config.bot.footer })
        .setTimestamp();
}

function panelEmbed(stats = null) {
    const embed = createBaseEmbed(
        "🎛️ Broadcast Control Panel v3",
        "Welcome to the multi-token broadcast control center. Manage bot tokens, configure target audiences, tune delivery speeds, and monitor real-time broadcasts."
    );

    embed.addFields(
        { name: "⚡ High-Speed Engine", value: "Supports parallel multi-token sharding and automatic anti-ban backoff.", inline: false },
        { name: "🎯 Smart Filtering", value: "Target all members, specific roles, exclude roles, or target members with **no roles**.", inline: true },
        { name: "🔑 Token Hub", value: "Health monitor with 🟢 Ready, 🟡 Cooldown, and 🔴 Flagged detection.", inline: true }
    );

    if (stats) {
        embed.addFields({
            name: "📊 Lifetime Statistics",
            value: `• Total Broadcasts: \`${stats.totalBroadcasts}\`\n• Delivered: \`${stats.totalSuccessful}\`\n• Success Rate: \`${stats.successRate}%\``,
            inline: false
        });
    }

    return embed;
}

function wizardEmbed(configState, targetStats) {
    const embed = createBaseEmbed(
        "📢 Broadcast Configuration Wizard",
        "Configure your broadcast parameters below. When ready, click **Start Broadcast**."
    );

    const modeLabels = {
        [config.targetModes.ALL]: "🌐 All Members",
        [config.targetModes.WHITELIST_ROLES]: "✅ Whitelisted Roles Only",
        [config.targetModes.BLACKLIST_ROLES]: "🚫 Everyone Except Selected Roles",
        [config.targetModes.NO_ROLES]: "👤 Members With No Roles Only"
    };

    const targetModeText = modeLabels[configState.targetMode] || "All Members";
    const rolesText = configState.roleIds && configState.roleIds.length > 0
        ? configState.roleIds.map(id => `<@&${id}>`).join(", ")
        : "*None*";

    const botsText = configState.excludeBots ? "🚫 Excluded" : "🤖 Included";
    const multiBotText = configState.useAllBots ? "⚡ Distributed Across All Active Bots" : "🎯 Single Primary Bot";
    const speedText = configState.speedLabel ? `${configState.speedLabel} (\`${configState.delayMs}ms\` delay)` : `Safe (\`1500ms\`)`;
    const messagePreview = configState.message
        ? (configState.message.length > 200 ? configState.message.substring(0, 200) + "..." : configState.message)
        : "*No message entered yet. Click 'Set Message' below.*";

    const imageText = configState.imageUrl
        ? `[View Attached Image](${configState.imageUrl})`
        : "*None*";

    embed.addFields(
        { name: "📝 Message Content", value: messagePreview, inline: false },
        { name: "🖼️ Attached Image", value: imageText, inline: true },
        { name: "🎯 Target Mode", value: targetModeText, inline: true },
        { name: "🏷️ Selected Roles", value: rolesText, inline: true },
        { name: "🤖 Bot Inclusion", value: botsText, inline: true },
        { name: "⚡ Dispatch Mode", value: multiBotText, inline: true },
        { name: "⏱️ Delivery Speed", value: speedText, inline: true },
        {
            name: "👥 Target Audience Match",
            value: `**${targetStats.matchedCount.toLocaleString()}** members will receive this broadcast (from ${targetStats.totalGuildMembers.toLocaleString()} total members).`,
            inline: false
        }
    );

    if (configState.imageUrl) {
        embed.setThumbnail(configState.imageUrl);
    }

    return embed;
}

function liveProgressEmbed(state, customNote = null) {
    const isFinished = state.status === "completed" || state.status === "cancelled";
    const statusTitles = {
        running: "🚀 Broadcasting in Progress...",
        paused: "⏸️ Broadcast Paused",
        cancelled: "⏹️ Broadcast Cancelled",
        completed: "✅ Broadcast Completed Successfully"
    };

    const statusColors = {
        running: config.bot.colors.primary,
        paused: config.bot.colors.warning,
        cancelled: config.bot.colors.danger,
        completed: config.bot.colors.success
    };

    const embed = new EmbedBuilder()
        .setTitle(statusTitles[state.status] || "Broadcast Progress")
        .setColor(statusColors[state.status] || config.bot.color)
        .setFooter({ text: config.bot.footer })
        .setTimestamp();

    if (customNote) {
        embed.setDescription(customNote);
    }

    embed.addFields(
        {
            name: "📈 Overall Progress",
            value: `${state.progressBar}\n**Processed**: \`${state.processed} / ${state.total}\` members`,
            inline: false
        },
        { name: "✅ Successfully Sent", value: `\`${state.success}\``, inline: true },
        { name: "❌ Failed / Skipped", value: `\`${state.failure}\``, inline: true },
        { name: "🤖 Active Bots", value: `\`${state.workerCount} workers\``, inline: true },
        { name: "⏱️ Elapsed Time", value: `\`${state.metrics.elapsed}\``, inline: true },
        { name: "⏳ Estimated ETA", value: `\`${state.metrics.eta}\``, inline: true },
        { name: "⚡ Delivery Speed", value: `\`${state.metrics.speed}\``, inline: true },
        {
            name: "🔍 Failure & Error Reasons",
            value: errorTracker.formatErrorSummary(state.errorSummary),
            inline: false
        }
    );

    return embed;
}

function tokenHubEmbed(tokens) {
    const embed = createBaseEmbed(
        "🔑 Bot Token Management Hub",
        "Manage, test, and distribute bot accounts for parallel broadcasting."
    );

    if (!tokens || tokens.length === 0) {
        embed.addFields({
            name: "Tokens Registered",
            value: "No tokens currently saved. Click **Add Token** or **Bulk Import** below to add tokens.",
            inline: false
        });
        return embed;
    }

    const badgeMap = {
        ready: "🟢 Ready",
        rate_limited: "🟡 Cooldown",
        invalid: "🔴 Invalid"
    };

    const list = tokens.map((t, idx) => {
        const badge = badgeMap[t.status] || "⚪ Unknown";
        return `**${idx + 1}.** ${badge} \`${t.tag || t.username}\` (ID: \`${t.id}\`)`;
    }).join("\n");

    const healthyCount = tokens.filter(t => t.status === "ready").length;
    const cooldownCount = tokens.filter(t => t.status === "rate_limited").length;
    const invalidCount = tokens.filter(t => t.status === "invalid").length;

    embed.addFields(
        { name: `Stored Bots (${tokens.length} total)`, value: list.length > 1024 ? list.substring(0, 1020) + "..." : list, inline: false },
        {
            name: "📊 Health Summary",
            value: `🟢 Ready: \`${healthyCount}\` | 🟡 Cooldown: \`${cooldownCount}\` | 🔴 Invalid: \`${invalidCount}\``,
            inline: false
        }
    );

    return embed;
}

function settingsEmbed(settings, guild) {
    const embed = createBaseEmbed(
        "⚙️ Permissions & Broadcast Settings",
        "Control who is authorized to use the bot and configure default broadcasting options."
    );

    const rolesText = settings.adminRoles && settings.adminRoles.length > 0
        ? settings.adminRoles.map(id => `<@&${id}>`).join(", ")
        : "*No custom roles configured (Bot Owner only)*";

    const usersText = settings.adminUserIds && settings.adminUserIds.length > 0
        ? settings.adminUserIds.map(id => `<@!${id}>`).join(", ")
        : "*No individual users whitelisted*";

    embed.addFields(
        { name: "👑 Bot Owner", value: "Master root access reserved strictly for <@938056009459576882>. Server owners and Discord administrators do **not** have access unless whitelisted below.", inline: false },
        { name: "🏷️ Whitelisted Roles", value: rolesText, inline: false },
        { name: "👤 Whitelisted Users", value: usersText, inline: false },
        {
            name: "⚡ Engine Defaults",
            value: `• Default Speed: \`${settings.defaultSpeed}\` (\`${settings.defaultDelayMs}ms\`)\n• Exclude Bots by Default: \`${settings.excludeBots ? "Yes" : "No"}\`\n• Distributed Multi-Bot Default: \`${settings.useAllBots ? "Enabled" : "Disabled"}\``,
            inline: false
        }
    );

    return embed;
}

module.exports = {
    createBaseEmbed,
    panelEmbed,
    wizardEmbed,
    liveProgressEmbed,
    tokenHubEmbed,
    settingsEmbed
};
