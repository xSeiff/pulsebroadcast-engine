const { MessageFlags } = require("discord.js");
const permissionService = require("../services/permissionService");
const filterService = require("../services/filterService");
const tokenService = require("../services/tokenService");
const { BroadcastJob, getActiveBroadcast } = require("../services/broadcastEngine");
const storage = require("../database/storage");
const config = require("../config");
const embeds = require("../ui/embeds");
const components = require("../ui/components");
const modals = require("../ui/modals");
const broadcastCmd = require("../commands/broadcast");

/**
 * Interaction Event Router for Buttons, Select Menus, and Modals
 * Features:
 * - Instant interaction ACKs to prevent "didn't respond in time" timeouts
 * - Comprehensive real-time console logging for every button, menu, and modal event
 * - Graceful error trapping and reporting
 * Made by xseif
 */

// Keep track of active broadcast message references
const activeBroadcastMessages = new Map();

async function handleInteraction(interaction) {
    try {
        if (interaction.isChatInputCommand()) {
            console.log(`[SLASH COMMAND] /${interaction.commandName} invoked by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guild?.name || "DM"}`);
            const { handleCommand } = require("./commandHandler");
            return await handleCommand(interaction);
        }

        // Permission check for all panel / broadcast operations
        if (!permissionService.isAuthorized(interaction)) {
            console.warn(`[AUTH DENIED] Unauthorized interaction attempt by ${interaction.user.tag} (${interaction.user.id}) on ${interaction.customId}`);
            return await interaction.reply({
                content: "❌ **Access Denied**: You do not have permission to interact with this broadcast panel.",
                flags: MessageFlags.Ephemeral
            });
        }

        if (interaction.isButton()) {
            console.log(`[BUTTON] "${interaction.customId}" clicked by ${interaction.user.tag} (${interaction.user.id})`);
            return await handleButton(interaction);
        }

        if (interaction.isAnySelectMenu()) {
            console.log(`[SELECT MENU] "${interaction.customId}" changed by ${interaction.user.tag} -> Values: [${interaction.values.join(", ")}]`);
            return await handleSelectMenu(interaction);
        }

        if (interaction.isModalSubmit()) {
            console.log(`[MODAL SUBMIT] "${interaction.customId}" submitted by ${interaction.user.tag}`);
            return await handleModal(interaction);
        }
    } catch (err) {
        console.error(`[INTERACTION ERROR] Exception during interaction ${interaction.customId || interaction.commandName}:`, err);
        const errPayload = {
            content: "❌ An internal error occurred while processing this interaction. Check the bot console for details.",
            flags: MessageFlags.Ephemeral
        };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errPayload);
            } else {
                await interaction.reply(errPayload);
            }
        } catch (_) {}
    }
}

// ----------------- BUTTON DISPATCHER -----------------
async function handleButton(interaction) {
    const id = interaction.customId;

    // Panel Navigation
    if (id === "btn_panel_broadcast") {
        return broadcastCmd.execute(interaction);
    }

    if (id === "btn_panel_tokens") {
        const tokenList = storage.tokens.getAll();
        console.log(`[TOKENS] Displaying Token Hub (${tokenList.length} tokens saved).`);
        return interaction.reply({
            embeds: [embeds.tokenHubEmbed(tokenList)],
            components: components.tokenHubComponents(tokenList),
            flags: MessageFlags.Ephemeral
        });
    }

    if (id === "btn_panel_settings") {
        if (!permissionService.canManagePermissions(interaction)) {
            console.warn(`[SETTINGS] Non-owner ${interaction.user.tag} denied access to settings.`);
            return interaction.reply({
                content: "❌ Only the Bot Owner (<@938056009459576882>) can manage settings and permissions.",
                flags: MessageFlags.Ephemeral
            });
        }
        const currentSettings = storage.settings.get();
        return interaction.reply({
            embeds: [embeds.settingsEmbed(currentSettings, interaction.guild)],
            components: components.settingsComponents(),
            flags: MessageFlags.Ephemeral
        });
    }

    if (id === "btn_panel_stats") {
        const stats = storage.broadcasts.getStats();
        const embed = embeds.createBaseEmbed(
            "📊 Detailed Lifetime Analytics",
            `• **Total Broadcast Campaigns**: \`${stats.totalBroadcasts}\`\n• **Successfully Completed**: \`${stats.completedCount}\`\n• **Total Delivered Messages**: \`${stats.totalSuccessful.toLocaleString()}\`\n• **Total Delivery Failures**: \`${stats.totalFailed.toLocaleString()}\`\n• **Overall Success Rate**: \`${stats.successRate}%\``
        );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Wizard Controls
    if (id === "btn_wizard_set_message") {
        const state = broadcastCmd.getWizardState(interaction.user.id);
        return interaction.showModal(modals.broadcastMessageModal(state.message, state.imageUrl));
    }

    if (id === "btn_wizard_toggle_bots") {
        const state = broadcastCmd.getWizardState(interaction.user.id);
        state.excludeBots = !state.excludeBots;
        console.log(`[WIZARD] Exclude bots toggled to: ${state.excludeBots}`);
        return updateWizardView(interaction, state);
    }

    if (id === "btn_wizard_toggle_multibot") {
        const state = broadcastCmd.getWizardState(interaction.user.id);
        state.useAllBots = !state.useAllBots;
        console.log(`[WIZARD] Distributed multi-bot sharding toggled to: ${state.useAllBots}`);
        return updateWizardView(interaction, state);
    }

    if (id === "btn_wizard_cancel") {
        broadcastCmd.clearWizardState(interaction.user.id);
        console.log(`[WIZARD] Setup cancelled by user.`);
        return interaction.update({
            content: "⏹️ **Broadcast Setup Cancelled**.",
            embeds: [],
            components: []
        });
    }

    if (id === "btn_wizard_test") {
        const state = broadcastCmd.getWizardState(interaction.user.id);
        if (!state.message || state.message.trim().length === 0) {
            return interaction.reply({
                content: "❌ Please configure a broadcast message before testing.",
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        console.log(`[TEST DM] Sending test preview to ${interaction.user.tag} (${interaction.user.id})...`);

        try {
            const finalTestContent = `${state.message.trim()}\n\n<@${interaction.user.id}>`;
            const sendPayload = { content: finalTestContent };
            if (state.imageUrl) sendPayload.files = [state.imageUrl];

            try {
                await interaction.user.send(sendPayload);
            } catch (fileErr) {
                if (state.imageUrl) {
                    await interaction.user.send(`${finalTestContent}\n${state.imageUrl}`);
                } else {
                    throw fileErr;
                }
            }

            console.log(`[TEST DM] Successfully delivered test preview to ${interaction.user.tag}`);
            return interaction.editReply({
                content: "✅ **Test Broadcast Delivered!** Check your Direct Messages (DMs) to inspect formatting, layout, and image appearance."
            });
        } catch (err) {
            console.error(`[TEST DM ERROR] Failed to send test to ${interaction.user.tag}:`, err);
            return interaction.editReply({
                content: `❌ **Failed to send test DM**: ${err.code === 50007 ? "Your Direct Messages are closed! Please enable DMs for server members in your Discord Privacy Settings." : err.message}`
            });
        }
    }

    if (id === "btn_wizard_start") {
        return launchBroadcast(interaction);
    }

    // Live Broadcast Control Buttons
    if (id === "btn_broadcast_pause" || id === "btn_broadcast_resume" || id === "btn_broadcast_cancel") {
        const broadcastId = activeBroadcastMessages.get(interaction.message.id);
        const job = broadcastId ? getActiveBroadcast(broadcastId) : null;

        if (!job) {
            console.warn(`[BROADCAST CONTROL] No active job found for message ${interaction.message.id}`);
            return interaction.reply({
                content: "⚠️ No active broadcast found for this control message (it may have finished or stopped).",
                flags: MessageFlags.Ephemeral
            });
        }

        if (id === "btn_broadcast_pause") {
            job.pause();
            return interaction.reply({ content: "⏸️ Broadcast paused.", flags: MessageFlags.Ephemeral });
        }
        if (id === "btn_broadcast_resume") {
            job.resume();
            return interaction.reply({ content: "▶️ Broadcast resumed.", flags: MessageFlags.Ephemeral });
        }
        if (id === "btn_broadcast_cancel") {
            await job.cancel();
            return interaction.reply({ content: "⏹️ Broadcast cancelled.", flags: MessageFlags.Ephemeral });
        }
    }

    // Token Hub Buttons
    if (id === "btn_token_add") {
        return interaction.showModal(modals.addTokenModal());
    }

    if (id === "btn_token_bulk") {
        return interaction.showModal(modals.bulkTokenModal());
    }

    if (id === "btn_token_health") {
        await interaction.deferUpdate();
        console.log(`[TOKENS] Running health checks on all stored tokens...`);
        const updatedTokens = await tokenService.checkAllTokensHealth();
        console.log(`[TOKENS] Health checks completed.`);
        return interaction.editReply({
            embeds: [embeds.tokenHubEmbed(updatedTokens)],
            components: components.tokenHubComponents(updatedTokens)
        });
    }

    if (id === "btn_token_clean") {
        await interaction.deferUpdate();
        console.log(`[TOKENS] Purging invalid and dead tokens...`);
        const { removedCount } = await tokenService.cleanupInvalidTokens();
        console.log(`[TOKENS] Purged ${removedCount} invalid tokens.`);
        const freshList = storage.tokens.getAll();
        return interaction.editReply({
            content: `🧹 Cleaned **${removedCount}** invalid or expired tokens.`,
            embeds: [embeds.tokenHubEmbed(freshList)],
            components: components.tokenHubComponents(freshList)
        });
    }

    // Settings Buttons
    if (id === "btn_settings_clear_perms") {
        permissionService.setAuthorizedRoles([]);
        permissionService.setAuthorizedUsers([]);
        console.log(`[SETTINGS] Reset permissions to default (Owner only).`);
        const currentSettings = storage.settings.get();
        return interaction.update({
            content: "✅ Custom role and user permissions have been reset.",
            embeds: [embeds.settingsEmbed(currentSettings, interaction.guild)],
            components: components.settingsComponents()
        });
    }

    if (id === "btn_settings_back") {
        const stats = storage.broadcasts.getStats();
        return interaction.update({
            content: null,
            embeds: [embeds.panelEmbed(stats)],
            components: components.panelComponents()
        });
    }
}

// ----------------- SELECT MENU DISPATCHER -----------------
async function handleSelectMenu(interaction) {
    const id = interaction.customId;

    if (id === "select_wizard_mode") {
        const state = broadcastCmd.getWizardState(interaction.user.id);
        state.targetMode = interaction.values[0];
        console.log(`[WIZARD] Target mode set to: ${state.targetMode}`);
        return updateWizardView(interaction, state);
    }

    if (id === "select_wizard_roles") {
        const state = broadcastCmd.getWizardState(interaction.user.id);
        state.roleIds = interaction.values;
        console.log(`[WIZARD] Target roles selected: [${state.roleIds.join(", ")}]`);
        return updateWizardView(interaction, state);
    }

    if (id === "select_wizard_speed") {
        const state = broadcastCmd.getWizardState(interaction.user.id);
        const selected = interaction.values[0];
        state.speedMode = selected;

        if (selected === "custom") {
            return interaction.showModal(modals.customSpeedModal(state.delayMs));
        }

        const preset = config.speeds[selected];
        if (preset) {
            state.delayMs = preset.delay;
            state.speedLabel = preset.label;
        }
        console.log(`[WIZARD] Speed set to: ${state.speedLabel} (${state.delayMs}ms)`);
        return updateWizardView(interaction, state);
    }

    if (id === "select_token_delete") {
        const tokenId = interaction.values[0];
        storage.tokens.remove(tokenId);
        console.log(`[TOKENS] Deleted token with ID: ${tokenId}`);
        const freshList = storage.tokens.getAll();
        return interaction.update({
            content: `✅ Removed token \`${tokenId}\`.`,
            embeds: [embeds.tokenHubEmbed(freshList)],
            components: components.tokenHubComponents(freshList)
        });
    }

    if (id === "select_settings_roles") {
        permissionService.setAuthorizedRoles(interaction.values);
        console.log(`[SETTINGS] Authorized roles updated: [${interaction.values.join(", ")}]`);
        const currentSettings = storage.settings.get();
        return interaction.update({
            content: "✅ Authorized roles updated.",
            embeds: [embeds.settingsEmbed(currentSettings, interaction.guild)],
            components: components.settingsComponents()
        });
    }

    if (id === "select_settings_users") {
        permissionService.setAuthorizedUsers(interaction.values);
        console.log(`[SETTINGS] Authorized users updated: [${interaction.values.join(", ")}]`);
        const currentSettings = storage.settings.get();
        return interaction.update({
            content: "✅ Authorized users updated.",
            embeds: [embeds.settingsEmbed(currentSettings, interaction.guild)],
            components: components.settingsComponents()
        });
    }
}

// ----------------- MODAL SUBMIT DISPATCHER -----------------
async function handleModal(interaction) {
    const id = interaction.customId;

    if (id === "modal_broadcast_message") {
        const state = broadcastCmd.getWizardState(interaction.user.id);
        state.message = interaction.fields.getTextInputValue("input_broadcast_text");
        state.imageUrl = interaction.fields.getTextInputValue("input_broadcast_image")?.trim() || "";
        console.log(`[WIZARD] Broadcast message configured (${state.message.length} chars, image: ${state.imageUrl || "none"}).`);
        return updateWizardView(interaction, state);
    }

    if (id === "modal_custom_speed") {
        const state = broadcastCmd.getWizardState(interaction.user.id);
        const rawDelay = parseInt(interaction.fields.getTextInputValue("input_speed_delay"), 10);
        const safeDelay = isNaN(rawDelay) || rawDelay < 100 ? 500 : rawDelay;
        state.delayMs = safeDelay;
        state.speedLabel = `⚙️ Custom (${safeDelay}ms)`;
        console.log(`[WIZARD] Custom speed configured: ${safeDelay}ms`);
        return updateWizardView(interaction, state);
    }

    if (id === "modal_token_add") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const rawToken = interaction.fields.getTextInputValue("input_token_value");
        console.log(`[TOKENS] Validating single new token via Discord REST...`);
        const result = await tokenService.addToken(rawToken);

        if (!result.success) {
            console.error(`[TOKENS] Validation failed: ${result.error}`);
            return interaction.editReply({ content: `❌ **Failed to add token**: ${result.error}` });
        }

        console.log(`[TOKENS] Successfully added bot: ${result.token.tag} (${result.token.id})`);
        const freshList = storage.tokens.getAll();
        return interaction.editReply({
            content: `✅ Successfully added token for **${result.token.tag}**!`,
            embeds: [embeds.tokenHubEmbed(freshList)],
            components: components.tokenHubComponents(freshList)
        });
    }

    if (id === "modal_token_bulk") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const rawInput = interaction.fields.getTextInputValue("input_bulk_tokens");
        console.log(`[TOKENS] Processing bulk tokens input...`);
        const { added, failed, totalProcessed } = await tokenService.bulkAddTokens(rawInput);
        console.log(`[TOKENS] Bulk import finished: ${added.length} added, ${failed.length} failed.`);

        const freshList = storage.tokens.getAll();
        return interaction.editReply({
            content: `📥 **Bulk Import Summary**:\n• Processed: \`${totalProcessed}\`\n• Added: \`${added.length}\`\n• Failed: \`${failed.length}\``,
            embeds: [embeds.tokenHubEmbed(freshList)],
            components: components.tokenHubComponents(freshList)
        });
    }
}

// ----------------- HELPER: UPDATE WIZARD VIEW -----------------
async function updateWizardView(interaction, state) {
    const { stats } = await filterService.resolveTargetMembers(interaction.guild, {
        targetMode: state.targetMode,
        roleIds: state.roleIds,
        excludeBots: state.excludeBots
    });

    const embed = embeds.wizardEmbed(state, stats);
    const rows = components.wizardComponents(state);

    if (interaction.isModalSubmit()) {
        return interaction.reply({
            embeds: [embed],
            components: rows,
            flags: MessageFlags.Ephemeral
        });
    }

    return interaction.update({
        embeds: [embed],
        components: rows
    });
}

// ----------------- LAUNCH BROADCAST -----------------
async function launchBroadcast(interaction) {
    console.log(`\n[BROADCAST] Launch requested by ${interaction.user.tag} (${interaction.user.id}) in "${interaction.guild.name}"`);

    // 1. Immediately acknowledge interaction in < 50ms so Discord never displays "didn't respond in time"
    await interaction.update({
        content: "⏳ **Initializing Broadcast Engine... Resolving members and connecting workers.**",
        embeds: [],
        components: []
    });

    const state = broadcastCmd.getWizardState(interaction.user.id);
    if (!state.message || state.message.trim().length === 0) {
        console.warn(`[BROADCAST] Aborted: Empty message.`);
        return interaction.editReply({
            content: "❌ You must set a broadcast message before starting.",
            embeds: [],
            components: []
        });
    }

    const { members } = await filterService.resolveTargetMembers(interaction.guild, {
        targetMode: state.targetMode,
        roleIds: state.roleIds,
        excludeBots: state.excludeBots
    });

    if (members.length === 0) {
        console.warn(`[BROADCAST] Aborted: No target members matched filter.`);
        return interaction.editReply({
            content: "❌ No matching target members found with your current filter criteria.",
            embeds: [],
            components: []
        });
    }

    // Check available tokens
    const allTokens = storage.tokens.getAll();
    const readyTokens = allTokens.filter(t => t.status !== "invalid");
    if (readyTokens.length === 0) {
        console.error(`[BROADCAST] Aborted: No valid bot tokens found in Token Hub.`);
        return interaction.editReply({
            content: "❌ No valid bot tokens found in the Token Hub. Please add bot tokens using `/tokens` before broadcasting.",
            embeds: [],
            components: []
        });
    }

    const selectedTokens = state.useAllBots ? readyTokens : readyTokens.slice(0, 1);
    console.log(`[BROADCAST] Target count: ${members.length} | Active tokens: ${selectedTokens.length} | Sharding: ${state.useAllBots ? "Enabled" : "Disabled"}`);

    // Create the broadcast job
    const job = new BroadcastJob({
        guildId: interaction.guild.id,
        authorId: interaction.user.id,
        authorTag: interaction.user.tag,
        message: state.message,
        imageUrl: state.imageUrl,
        targets: members,
        delayMs: state.delayMs,
        speedLabel: state.speedLabel,
        selectedTokens,
        updateCallback: async (jobSnapshot, isFinal, customNote) => {
            const embed = embeds.liveProgressEmbed(jobSnapshot, customNote);
            const controls = components.liveControls(jobSnapshot.status);
            try {
                await interaction.editReply({
                    content: null,
                    embeds: [embed],
                    components: controls
                });
            } catch (err) {
                // Ignore transient webhook rate-limit errors
            }
        }
    });

    // Clear wizard state now that job has started
    broadcastCmd.clearWizardState(interaction.user.id);

    // Save message reference for control buttons
    try {
        const replyMsg = await interaction.fetchReply();
        activeBroadcastMessages.set(replyMsg.id, job.id);
    } catch (err) {
        console.warn(`[BROADCAST] Could not fetch reply message reference:`, err.message);
    }

    // Run job asynchronously in the background
    job.start().catch(err => {
        console.error("[BROADCAST ERROR] Fatal error in broadcast job start:", err);
    });
}

module.exports = {
    handleInteraction
};
