require("dotenv").config();
const { Client, ActivityType } = require("discord.js");
const config = require("./config");
const storage = require("./database/storage");
const commandHandler = require("./handlers/commandHandler");
const interactionHandler = require("./handlers/interactionHandler");
const permissionService = require("./services/permissionService");
const embeds = require("./ui/embeds");
const components = require("./ui/components");

// Initialize atomic database storage
storage.initialize();

// Load application slash commands
commandHandler.loadCommands();

// Create Discord Client
const client = new Client({
    intents: config.intents
});

// Gateway Ready Event
client.once("ready", async () => {
    console.log(`========================================`);
    console.log(`🚀 ${client.user.tag} is online!`);
    console.log(`👤 Author: xseif`);
    console.log(`⚡ Version: 3.0.0`);
    console.log(`========================================`);

    client.user.setPresence({
        status: "online",
        activities: [
            {
                name: "Broadcasts • Made by xseif",
                type: ActivityType.Watching
            }
        ]
    });

    // Deploy slash commands
    await commandHandler.registerCommands(client);
});

// Gateway Interaction Event (Slash commands, buttons, menus, modals)
client.on("interactionCreate", async (interaction) => {
    try {
        await interactionHandler.handleInteraction(interaction);
    } catch (err) {
        console.error("Unhandled error in interaction handler:", err);
    }
});

// Legacy prefix command support (!panel)
client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    if (message.content.trim() === "!panel") {
        if (!permissionService.isAuthorized(message)) {
            return message.reply("❌ **Access Denied**: You do not have permission to use the broadcast panel.");
        }

        const stats = storage.broadcasts.getStats();
        const embed = embeds.panelEmbed(stats);
        const rows = components.panelComponents();

        await message.channel.send({
            embeds: [embed],
            components: rows
        });
    }
});

// Process-level unhandled exception safety
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception thrown:", err);
});

client.on("error", (err) => {
    console.error("Discord client encountered an error:", err);
});

client.on("warn", (info) => {
    console.warn("Discord client warning:", info);
});

// Login
if (!config.bot.token) {
    console.error("❌ CRITICAL: No DISCORD_TOKEN specified in .env! Please configure your token.");
} else {
    client.login(config.bot.token).catch((err) => {
        console.error("❌ Failed to login with DISCORD_TOKEN:", err.message);
    });
}

module.exports = client;
