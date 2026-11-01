const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const permissionService = require("../services/permissionService");
const storage = require("../database/storage");
const embeds = require("../ui/embeds");
const components = require("../ui/components");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tokens")
        .setDescription("Open the Token Management Hub to view, add, or test bot tokens"),
    async execute(interaction) {
        if (!permissionService.isAuthorized(interaction)) {
            return interaction.reply({
                content: "❌ **Access Denied**: You do not have permission to manage bot tokens.",
                flags: MessageFlags.Ephemeral
            });
        }

        const tokenList = storage.tokens.getAll();
        const embed = embeds.tokenHubEmbed(tokenList);
        const rows = components.tokenHubComponents(tokenList);

        return interaction.reply({
            embeds: [embed],
            components: rows,
            flags: MessageFlags.Ephemeral
        });
    }
};
