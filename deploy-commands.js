import { SlashCommandBuilder, ContextMenuCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes, ApplicationCommandType } from 'discord-api-types/v9';

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require('./config.json');

const commands = [
    new ContextMenuCommandBuilder().setName('Detect language').setType(ApplicationCommandType.Message),
    new ContextMenuCommandBuilder().setName('Translate to English').setType(ApplicationCommandType.Message),
    new ContextMenuCommandBuilder().setName('Translate to Japanese').setType(ApplicationCommandType.Message),
  //  new ContextMenuCommandBuilder().setName('Translate to German').setType(ApplicationCommandType.Message),
  //  new ContextMenuCommandBuilder().setName('Translate to Spanish').setType(ApplicationCommandType.Message),
  //  new ContextMenuCommandBuilder().setName('Translate to Italian').setType(ApplicationCommandType.Message),
    new SlashCommandBuilder().setName('translate').setDescription("Translate text using AWS Translate.")
		.addStringOption(option=>option.setName("text").setDescription("Text to translate").setRequired(true))
		.addStringOption(option => option.setName("target").setDescription("Target language or language code").setRequired(true)),
	new SlashCommandBuilder().setName('set_group').setDescription("Add this channel to a group for mirroring.")
		.addStringOption(option => option.setName("groupname").setDescription("Group name").setRequired(true)),
	new SlashCommandBuilder().setName('remove_group').setDescription("Remove this channel from a mirror group."),
	new SlashCommandBuilder().setName('set_language').setDescription("Set a language for this channel.")
		.addStringOption(option => option.setName("language").setDescription("Language name or code").setRequired(true)),
    new SlashCommandBuilder().setName('force_channel_language').setDescription("Force channel messages to be translated.")
    .addStringOption(option => option.setName("enabled").setDescription("Enable translation").setRequired(true)
        .addChoices(
            { name: 'Enable', value: 'true' },
            { name: 'Disable', value: 'false' }
	)),
    new SlashCommandBuilder().setName('role_translation').setDescription("Enable or disable role translation.")
    .addStringOption(option => option.setName("enabled").setDescription("Enable translation").setRequired(true)
        .addChoices(
            { name: 'Enable', value: 'true' },
            { name: 'Disable', value: 'false' }
        )),
    new SlashCommandBuilder().setName('mirror').setDescription("Configure mirroring.")
		.addStringOption(option => option.setName("enabled").setDescription("Enable mirroring").setRequired(true)
        .addChoices(
            { name: 'Enable', value: 'true' },
            { name: 'Disable', value: 'false' }
        ))
		.addStringOption(option => option.setName("translate").setDescription("Mirror translation").setRequired(true)
        .addChoices(
            { name: 'Translate mirrored messages', value: 'true' },
            { name: "Don't translate", value: 'false' }
        ))
        .addStringOption(option => option.setName("mode").setDescription("Mirror display mode").setRequired(true)
            .addChoices(
                { name: 'Webhook', value: 'webhook' },
                { name: "Embed", value: 'embed' }
            )),

	new SlashCommandBuilder().setName('tl_enable').setDescription("Turn on the translator"),
    new SlashCommandBuilder().setName('tl_disable').setDescription("Turn off the translator.")
    ]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(config.token);

rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);