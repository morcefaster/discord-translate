import { Client, Intents } from 'discord.js';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require('./config.json');

import * as tl from './tl.js';

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_WEBHOOKS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_MEMBERS
    ]
});

// This is a function which will be called when the bot is ready.
client.on("ready", async () => {
    console.log("Bot started!");
});

client.on('interactionCreate',
    async interaction => {
        try {

            if (interaction.isMessageContextMenu()) {
                if (interaction.commandName.toLowerCase() === "detect language"){
                    await tl.detectLanguageCommand(interaction);
                    return;
                } else if (interaction.commandName.toLowerCase().startsWith("translate to")) {
                    await tl.translateToCommand(interaction);
                    return;
                } else {
                    await interaction.reply({ content: "Unknown command", ephemeral: true });
                    return;
                }
            } else if (!interaction.isCommand()) {
                return;
            }

            const { commandName } = interaction;

            switch (commandName) {
                case "translate":
                    await tl.translateMessage(interaction);
                    break;
                case "set_group":
                    await tl.setGroup(interaction);
                    break;
                case "remove_group":
                    await tl.removeGroup(interaction);
                    break;
                case "set_language":
                    await tl.setLanguage(interaction);
                    break;
                case "mirror":
                    await tl.configMirror(interaction);
                    break;
                case "tl_disable":
                    await tl.disable(interaction);
                    break;
                case "tl_enable":
                    await tl.enable(interaction);
                    break;
                case "force_channel_language":
                    await tl.forceLanguageConfig(interaction);
                    break;
                case "role_translation":
                    await tl.roleTranslationConfig(interaction);
                    break;

                default:
                    await interaction.reply({ content: "Unknown command.", ephemeral: true });
                    break;
            };
        } catch (ex) {
            log_error(interaction, ex);
        }
    });

async function log_error(interaction, error) {
    try {
        console.log(error);
        await interaction.reply({ content: "An error occurred.", ephemeral: true });
    } catch (ex) {
        console.log(ex);
    }
}

client.on("messageCreate", async (message) => {
    if (!message.author.bot && !message.webhookId) {
        try {
            await tl.enforceLanguage(message);
            await tl.mirrorMessage(message, client);
            await tl.roleTranslate(message);
        } catch (ex) {
            console.log(ex);
        }
    }
});

client.login(config.token);

client.on("ready", async () => {
    client.user.setPresence({ game: { name: "everyone", type: "Listening" }, status: "online" });
});

// client.on('debug', console.log);

