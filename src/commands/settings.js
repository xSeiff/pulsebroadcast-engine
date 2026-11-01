const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const permissionService = require("../services/permissionService");
const storage = require("../database/storage");
const embeds = require("../ui/embeds");
const components = require("../ui/components");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("settings")
        .setDescription("Manage bot access control, authorized roles, and default settings"),
    async execute(interaction) {
        if (!permissionService.canManagePermissions(interaction)) {
            return interaction.reply({
                content: "❌ **Access Denied**: Only the Bot Owner can modify bot settings and access control.",
                flags: MessageFlags.Ephemeral
            });
        }

        const currentSettings = storage.settings.get();
        const embed = embeds.settingsEmbed(currentSettings, interaction.guild);
        const rows = components.settingsComponents();

        return interaction.reply({
            embeds: [embed],
            components: rows,
            flags: MessageFlags.Ephemeral
        });
    }
};
