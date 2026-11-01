const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    UserSelectMenuBuilder
} = require("discord.js");
const config = require("../config");

/**
 * Modern Discord.js v14 Component Builders
 * Made by xseif
 */

// ----------------- PANEL COMPONENTS -----------------
function panelComponents() {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("btn_panel_broadcast")
            .setLabel("📢 New Broadcast")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("btn_panel_tokens")
            .setLabel("🔑 Token Hub")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("btn_panel_settings")
            .setLabel("⚙️ Access & Settings")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("btn_panel_stats")
            .setLabel("📊 Lifetime Stats")
            .setStyle(ButtonStyle.Secondary)
    );

    return [row];
}

// ----------------- WIZARD COMPONENTS -----------------
function wizardComponents(state) {
    const rows = [];

    // 1. Target Mode Select
    const modeSelect = new StringSelectMenuBuilder()
        .setCustomId("select_wizard_mode")
        .setPlaceholder("Choose Target Audience Mode")
        .addOptions([
            {
                label: "All Members",
                description: "Broadcast to all members in the server",
                value: config.targetModes.ALL,
                emoji: "🌐",
                default: state.targetMode === config.targetModes.ALL
            },
            {
                label: "Whitelisted Roles Only",
                description: "Only send to members who hold selected roles",
                value: config.targetModes.WHITELIST_ROLES,
                emoji: "✅",
                default: state.targetMode === config.targetModes.WHITELIST_ROLES
            },
            {
                label: "Everyone Except Selected Roles",
                description: "Exclude members who hold selected roles",
                value: config.targetModes.BLACKLIST_ROLES,
                emoji: "🚫",
                default: state.targetMode === config.targetModes.BLACKLIST_ROLES
            },
            {
                label: "Members With No Roles Only",
                description: "Target newcomers / members with 0 roles",
                value: config.targetModes.NO_ROLES,
                emoji: "👤",
                default: state.targetMode === config.targetModes.NO_ROLES
            }
        ]);
    rows.push(new ActionRowBuilder().addComponents(modeSelect));

    // 2. Role Select Menu (only if mode uses roles)
    if (state.targetMode === config.targetModes.WHITELIST_ROLES || state.targetMode === config.targetModes.BLACKLIST_ROLES) {
        const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId("select_wizard_roles")
            .setPlaceholder("Pick Roles to Include / Exclude")
            .setMinValues(0)
            .setMaxValues(15);
        rows.push(new ActionRowBuilder().addComponents(roleSelect));
    }

    // 3. Speed Select Menu
    const speedSelect = new StringSelectMenuBuilder()
        .setCustomId("select_wizard_speed")
        .setPlaceholder("Choose Sending Speed")
        .addOptions([
            {
                label: "Safe / Anti-Ban (1500ms)",
                description: "1.5s delay per bot - Recommended for safety",
                value: "safe",
                emoji: "🛡️",
                default: state.speedMode === "safe"
            },
            {
                label: "Balanced (750ms)",
                description: "750ms delay per bot",
                value: "balanced",
                emoji: "⚖️",
                default: state.speedMode === "balanced"
            },
            {
                label: "Fast (350ms)",
                description: "350ms delay per bot - Best with multi-bots",
                value: "fast",
                emoji: "⚡",
                default: state.speedMode === "fast"
            },
            {
                label: "Custom Milliseconds Delay...",
                description: "Specify exact custom millisecond interval",
                value: "custom",
                emoji: "⚙️",
                default: state.speedMode === "custom"
            }
        ]);
    rows.push(new ActionRowBuilder().addComponents(speedSelect));

    // 4. Toggle buttons
    const botToggleLabel = state.excludeBots ? "🤖 Exclude Bots: ON" : "🤖 Exclude Bots: OFF";
    const multiBotToggleLabel = state.useAllBots ? "⚡ All Bots Sharding: ON" : "⚡ All Bots Sharding: OFF";

    const togglesRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("btn_wizard_set_message")
            .setLabel("📝 Set Message")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("btn_wizard_toggle_bots")
            .setLabel(botToggleLabel)
            .setStyle(state.excludeBots ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("btn_wizard_toggle_multibot")
            .setLabel(multiBotToggleLabel)
            .setStyle(state.useAllBots ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
    rows.push(togglesRow);

    // 5. Execution action row
    const canStart = Boolean(state.message && state.message.trim().length > 0);
    const actionsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("btn_wizard_test")
            .setLabel("🧪 Test DM")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canStart),
        new ButtonBuilder()
            .setCustomId("btn_wizard_start")
            .setLabel("🚀 Start Broadcast")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!canStart),
        new ButtonBuilder()
            .setCustomId("btn_wizard_cancel")
            .setLabel("❌ Cancel")
            .setStyle(ButtonStyle.Danger)
    );
    rows.push(actionsRow);

    return rows;
}

// ----------------- LIVE BROADCAST CONTROLS -----------------
function liveControls(status) {
    const isPaused = status === "paused";
    const isFinished = status === "completed" || status === "cancelled";

    if (isFinished) return [];

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("btn_broadcast_pause")
            .setLabel("⏸️ Pause")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(isPaused),
        new ButtonBuilder()
            .setCustomId("btn_broadcast_resume")
            .setLabel("▶️ Resume")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!isPaused),
        new ButtonBuilder()
            .setCustomId("btn_broadcast_cancel")
            .setLabel("⏹️ Cancel Broadcast")
            .setStyle(ButtonStyle.Danger)
    );

    return [row];
}

// ----------------- TOKEN HUB COMPONENTS -----------------
function tokenHubComponents(tokenList = []) {
    const rows = [];

    const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("btn_token_add")
            .setLabel("➕ Add Token")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("btn_token_bulk")
            .setLabel("📥 Bulk Import")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("btn_token_health")
            .setLabel("🔍 Health Check")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("btn_token_clean")
            .setLabel("🧹 Clean Invalid")
            .setStyle(ButtonStyle.Danger)
    );
    rows.push(buttonsRow);

    if (tokenList.length > 0) {
        const options = tokenList.slice(0, 25).map((t, idx) => ({
            label: `${idx + 1}. ${t.tag || t.username}`.substring(0, 25),
            description: `ID: ${t.id} • Status: ${t.status || "ready"}`,
            value: t.id
        }));

        const deleteSelect = new StringSelectMenuBuilder()
            .setCustomId("select_token_delete")
            .setPlaceholder("Select a token to remove...")
            .addOptions(options);

        rows.push(new ActionRowBuilder().addComponents(deleteSelect));
    }

    return rows;
}

// ----------------- SETTINGS & ACCESS CONTROL COMPONENTS -----------------
function settingsComponents() {
    const rows = [];

    // Role select for access
    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId("select_settings_roles")
        .setPlaceholder("Select Roles Authorized to Use Bot")
        .setMinValues(0)
        .setMaxValues(10);
    rows.push(new ActionRowBuilder().addComponents(roleSelect));

    // User select for access
    const userSelect = new UserSelectMenuBuilder()
        .setCustomId("select_settings_users")
        .setPlaceholder("Select Specific Users Authorized to Use Bot")
        .setMinValues(0)
        .setMaxValues(10);
    rows.push(new ActionRowBuilder().addComponents(userSelect));

    // Reset / clear button
    const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("btn_settings_clear_perms")
            .setLabel("🗑️ Reset Whitelists to Default")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("btn_settings_back")
            .setLabel("⬅️ Back to Panel")
            .setStyle(ButtonStyle.Secondary)
    );
    rows.push(buttonsRow);

    return rows;
}

module.exports = {
    panelComponents,
    wizardComponents,
    liveControls,
    tokenHubComponents,
    settingsComponents
};
