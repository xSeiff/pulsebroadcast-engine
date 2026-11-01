const { REST, Routes, Collection } = require("discord.js");
const config = require("../config");

// Map of command instances
const commands = new Collection();

function loadCommands() {
    const commandFiles = ["panel.js", "broadcast.js", "tokens.js", "settings.js"];
    for (const file of commandFiles) {
        try {
            const command = require(`../commands/${file}`);
            if (command && command.data && command.data.name) {
                commands.set(command.data.name, command);
            }
        } catch (err) {
            console.error(`Failed to load command ../commands/${file}:`, err);
        }
    }
}

async function registerCommands(client) {
    if (!config.bot.token) {
        console.warn("No bot token provided in environment, skipping slash command registration.");
        return;
    }

    const rest = new REST({ version: "10" }).setToken(config.bot.token);
    const commandPayloads = commands.map(cmd => cmd.data.toJSON());

    try {
        const clientId = config.bot.clientId || client.user.id;
        console.log(`Registering ${commandPayloads.length} application slash commands...`);

        if (config.bot.guildId) {
            // Guild-specific registration (instantly available)
            await rest.put(
                Routes.applicationGuildCommands(clientId, config.bot.guildId),
                { body: commandPayloads }
            );
            console.log(`✅ Successfully deployed commands to guild ${config.bot.guildId}`);
        } else {
            // Global registration
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: commandPayloads }
            );
            console.log(`✅ Successfully deployed commands globally.`);
        }
    } catch (err) {
        console.error("Failed to register application commands with Discord:", err);
    }
}

async function handleCommand(interaction) {
    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(`Error executing /${interaction.commandName}:`, err);
        const replyPayload = {
            content: "❌ An internal error occurred while executing this command.",
            ephemeral: true
        };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyPayload).catch(() => {});
        } else {
            await interaction.reply(replyPayload).catch(() => {});
        }
    }
}

module.exports = {
    commands,
    loadCommands,
    registerCommands,
    handleCommand
};
