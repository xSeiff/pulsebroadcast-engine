const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const permissionService = require("../services/permissionService");
const filterService = require("../services/filterService");
const storage = require("../database/storage");
const config = require("../config");
const embeds = require("../ui/embeds");
const components = require("../ui/components");

// Store active wizard setup states in memory per user
const wizardSessions = new Map();

function getWizardState(userId) {
    if (!wizardSessions.has(userId)) {
        const savedSettings = storage.settings.get();
        wizardSessions.set(userId, {
            message: "",
            imageUrl: "",
            targetMode: config.targetModes.ALL,
            roleIds: [],
            excludeBots: savedSettings.excludeBots !== false,
            useAllBots: savedSettings.useAllBots !== false,
            speedMode: savedSettings.defaultSpeed || "safe",
            delayMs: savedSettings.defaultDelayMs || 1500,
            speedLabel: config.speeds[savedSettings.defaultSpeed]?.label || "🛡️ Safe"
        });
    }
    return wizardSessions.get(userId);
}

function clearWizardState(userId) {
    wizardSessions.delete(userId);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("broadcast")
        .setDescription("Launch the interactive Broadcast Setup Wizard"),
    getWizardState,
    clearWizardState,
    async execute(interaction) {
        if (!permissionService.isAuthorized(interaction)) {
            return interaction.reply({
                content: "❌ **Access Denied**: You do not have permission to launch broadcasts.",
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const state = getWizardState(interaction.user.id);
        const { stats } = await filterService.resolveTargetMembers(interaction.guild, {
            targetMode: state.targetMode,
            roleIds: state.roleIds,
            excludeBots: state.excludeBots
        });

        const embed = embeds.wizardEmbed(state, stats);
        const rows = components.wizardComponents(state);

        return interaction.editReply({
            embeds: [embed],
            components: rows
        });
    }
};
