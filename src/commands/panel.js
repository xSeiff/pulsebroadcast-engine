const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const permissionService = require("../services/permissionService");
const storage = require("../database/storage");
const embeds = require("../ui/embeds");
const components = require("../ui/components");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("panel")
        .setDescription("Open the interactive Broadcast Control Panel"),
    async execute(interaction) {
        if (!permissionService.isAuthorized(interaction)) {
            return interaction.reply({
                content: "❌ **Access Denied**: You do not have permission to access the broadcast panel.",
                flags: MessageFlags.Ephemeral
            });
        }

        const stats = storage.broadcasts.getStats();
        const embed = embeds.panelEmbed(stats);
        const rows = components.panelComponents();

        return interaction.reply({
            embeds: [embed],
            components: rows,
            flags: MessageFlags.Ephemeral
        });
    }
};
