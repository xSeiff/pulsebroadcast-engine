const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

/**
 * Modern Discord.js v14 Modal Dialogs
 * Made by xseif
 */

function broadcastMessageModal(initialText = "", initialImageUrl = "") {
    const modal = new ModalBuilder()
        .setCustomId("modal_broadcast_message")
        .setTitle("Broadcast Message & Image");

    const textInput = new TextInputBuilder()
        .setCustomId("input_broadcast_text")
        .setLabel("Enter the message to broadcast:")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Type your message here... Supports Markdown, emojis, and links.")
        .setValue(initialText || "")
        .setRequired(true)
        .setMaxLength(2000);

    const imageInput = new TextInputBuilder()
        .setCustomId("input_broadcast_image")
        .setLabel("Image URL (Optional):")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("https://example.com/banner.png (Direct image link)")
        .setValue(initialImageUrl || "")
        .setRequired(false)
        .setMaxLength(500);

    modal.addComponents(
        new ActionRowBuilder().addComponents(textInput),
        new ActionRowBuilder().addComponents(imageInput)
    );
    return modal;
}

function addTokenModal() {
    const modal = new ModalBuilder()
        .setCustomId("modal_token_add")
        .setTitle("Add Discord Bot Token");

    const tokenInput = new TextInputBuilder()
        .setCustomId("input_token_value")
        .setLabel("Bot Token:")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Paste the bot token from Discord Developer Portal...")
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(tokenInput));
    return modal;
}

function bulkTokenModal() {
    const modal = new ModalBuilder()
        .setCustomId("modal_token_bulk")
        .setTitle("Bulk Import Bot Tokens");

    const bulkInput = new TextInputBuilder()
        .setCustomId("input_bulk_tokens")
        .setLabel("Paste tokens (one per line):")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("token_1\ntoken_2\ntoken_3...")
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(bulkInput));
    return modal;
}

function customSpeedModal(currentValue = "1000") {
    const modal = new ModalBuilder()
        .setCustomId("modal_custom_speed")
        .setTitle("Custom Delivery Delay");

    const delayInput = new TextInputBuilder()
        .setCustomId("input_speed_delay")
        .setLabel("Delay between messages per bot (in milliseconds):")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Example: 800 (minimum 100)")
        .setValue(String(currentValue))
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(delayInput));
    return modal;
}

module.exports = {
    broadcastMessageModal,
    addTokenModal,
    bulkTokenModal,
    customSpeedModal
};
