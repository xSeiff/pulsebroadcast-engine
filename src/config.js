require("dotenv").config();
const { GatewayIntentBits, Colors } = require("discord.js");

module.exports = {
    bot: {
        token: process.env.DISCORD_TOKEN || "",
        clientId: process.env.CLIENT_ID || "",
        guildId: process.env.GUILD_ID || "",
        ownerId: process.env.BOT_OWNER_ID || "938056009459576882",
        name: "Broadcast Bot v3",
        author: "xseif",
        footer: "Made by xseif • Broadcast v3",
        color: 0x5865F2, // Discord Blurple
        colors: {
            primary: 0x5865F2,
            success: 0x57F287,
            warning: 0xFEE75C,
            danger: 0xED4245,
            info: 0x3498DB
        }
    },
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    speeds: {
        safe: { label: "🛡️ Safe / Anti-Ban", delay: 1500, desc: "1.5s delay per bot (Recommended for stability)" },
        balanced: { label: "⚖️ Balanced", delay: 750, desc: "750ms delay per bot" },
        fast: { label: "⚡ Fast", delay: 350, desc: "350ms delay per bot (Requires multiple bots)" }
    },
    targetModes: {
        ALL: "all",
        WHITELIST_ROLES: "whitelist_roles",
        BLACKLIST_ROLES: "blacklist_roles",
        NO_ROLES: "no_roles"
    },
    paths: {
        dataDir: require("path").join(__dirname, "..", "data")
    }
};
