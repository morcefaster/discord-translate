import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { ComprehendClient, DetectDominantLanguageCommand } from "@aws-sdk/client-comprehend";
import { createRequire } from "module";
import { MessageEmbed } from 'discord.js';
import * as fs from 'fs';

const require = createRequire(import.meta.url);
const languages = require('./languages.json');
const roleConfig = require('./role_config.json');


const CHANNEL_CONFIG_FILENAME = './channel_config.json';
const LANG_THRESHOLD = 0.7;
var cfg = require(CHANNEL_CONFIG_FILENAME);

const tlClient = new TranslateClient({ region: "us-east-1" });
const chClient = new ComprehendClient({ region: "us-east-1" });


export async function saveConfig() {
    
    await fs.promises.writeFile(CHANNEL_CONFIG_FILENAME, JSON.stringify(cfg));
}

export function readConfig() {
    cfg = require(CHANNEL_CONFIG_FILENAME);
}

export async function validatePrivileges(interaction) {
    if (interaction.member.permissions.has("ADMINISTRATOR") ||
        interaction.member.roles.cache.some(r => r.id === roleConfig.bot_controller_role)) {
        return true;
    }

    await interaction.reply({ content: "You do not have permissions to perform this action.", ephemeral: true });
    return false;
}

export async function detectLanguageCommand(interaction) {
    var text = interaction.targetMessage.content;
    if (!text) {
        await interaction.reply({ content: "No text detected.", ephemeral: true });
        return;
    }
    var lang = await detectLanguage(text);
    var langName = languages.find(l => l.code === lang.LanguageCode).name;
    var response = new MessageEmbed()
        .setDescription(
            `The detected language is ${langName} [${lang.LanguageCode}], confidence: ${
            (lang.Score * 100).toFixed(2)}%`);
    await interaction.reply({ embeds: [response] });
}

export async function translateToCommand(interaction) {
    var text = interaction.targetMessage.content;
    if (!text) {
        await interaction.reply({ content: "No text detected.", ephemeral: true });
        return;
    }
    var target;
    switch(interaction.commandName.toLowerCase()) {
        case "translate to english":
            target = "en";
            break;
        case "translate to korean":
            target = "ko";
            break;
        case "translate to traditional chinese":
            target = "zh-TW";
            break;
        default:
            await interaction.reply({ content: "Unknown target language.", ephemeral: true });
            return;
    }

    var translatedText = await translate(text, target);
    await interaction.reply({ content: translatedText });
}

export async function setGroup(interaction) {
    if (!validatePrivileges(interaction)) {
        return;
    }
    var groupName = interaction.options.getString("groupname");
    var cc = getChannelConfig(interaction.channel);
    
    cc.groupName = groupName;

    await saveConfig();

    await interaction.reply({
        content: `Group name for channel ${interaction.channel.name} set to ${groupName}. Language: ${cc.language || 'not set'}.`
    });
}

export async function removeGroup(interaction) {
    if (!validatePrivileges(interaction)) {
        return;
    }

    var cc = getChannelConfig(interaction.channel);
    cc.groupName = null;

    await saveConfig();

    await interaction.reply({
        content: `Group name for channel ${interaction.channel.name} removed.`
    });
}

export async function configMirror(interaction) {
    if (!validatePrivileges(interaction)) {
        return;
    }

    var enabled = interaction.options.getString("enabled");
    var translate = interaction.options.getString("translate");
    cfg.mirror = (enabled.toLowerCase() === "true");
    cfg.mirror_tl = (translate.toLowerCase() === "true");
    cfg.mirror_mode = interaction.options.getString("mode");
    await saveConfig();
    
    await interaction.reply({
        content: `Mirroring is set to [${cfg.mirror}], translate [${translate}], mode [${cfg.mirror_mode}].`
    });
}

export async function enable(interaction) {
    if (!validatePrivileges(interaction)) {
        return;
    }

    cfg.enabled = true;
    await saveConfig();

    await interaction.reply({ content: "Translator enabled." });
}

export async function disable(interaction) {
    if (!validatePrivileges(interaction)) {
        return;
    }

    cfg.enabled = false;
    await saveConfig();

    await interaction.reply({ content: "Translator disabled." });
}

export async function setLanguage(interaction) {
    if (!validatePrivileges(interaction)) {
        return;
    }

    var lang = interaction.options.getString("language").toLowerCase();
    var lc = languages.find(l => l.code.toLowerCase() === lang || l.name.toLowerCase() === lang);
    if (!lc) {
        await interaction.reply({ content: `Cannot find language ${lang}.`, ephemeral: true });
        return;
    }

    var cc = getChannelConfig(interaction.channel);
    cc.language = lc.code;

    await saveConfig();

    await interaction.reply({
        content: `Language for channel ${interaction.channel.name} set to ${lc.name} [${lc.code}]`
    });
}

export function getChannelConfig(channel) {
    var cc = cfg.channels.find(c => c.id === channel.id);
    if (!cc) {
        cc = {
            id: channel.id,
            name: channel.name
        }

        cfg.channels.push(cc);
    }

    return cc;
}


export async function detectLanguage(text) {
    const cm = new DetectDominantLanguageCommand({ Text: text });
    var ln = await chClient.send(cm);
    if (ln.Languages.length === 0) {
        return null;
    }

    return ln.Languages[0];
}

export async function translateMessage(interaction) {
    if (!cfg.enabled) {
        await interaction.reply({ content: "The translator is currently disabled.", ephemeral: true });
        return;
    }

    var text = interaction.options.getString("text");
    var target = interaction.options.getString("target");
    var lc = languages.find(l => l.code.toLowerCase() === target || l.name.toLowerCase() === target);
    if (!lc) {
        await interaction.reply({ content: `Cannot find language ${target}.`, ephemeral: true });
        return;
    }

    var tl = await translate(text, lc.code);
    await interaction.reply({ content: tl });
}

export async function roleTranslationConfig(interaction) {
    if (!validatePrivileges(interaction)) {
        return;
    }

    var enable = interaction.options.getString("enabled");

    cfg.role_tl = (enable === 'true');
    await saveConfig();

    await interaction.reply({
        content: `Configuration saved, role translation is ${enable === "true" ? "enabled" : "disabled"}.`
    });
}

export async function forceLanguageConfig(interaction) {
    if (!validatePrivileges(interaction)) {
        return;
    }

    var cc = getChannelConfig(interaction.channel);

    var enable = interaction.options.getString("enabled");

    if (enable === 'true') {
        if (!cc.language) {
            interaction.reply(
                { content: `Cannot enforce translation if channel has no language set.`, ephemeral: true });
        }
        cc.enforceLanguage = true;
    } else {
        cc.enforceLanguage = false;
    }

    await saveConfig();

    await interaction.reply({
        content: `Configuration saved, enforced translation is ${enable === "true" ? "enabled" : "disabled"}.`
    });
}

export async function translate(text, target) {
    var params = {
        Text: text,
        TargetLanguageCode: target,
        SourceLanguageCode: "auto"
    };
    var com = new TranslateTextCommand(params);
    var translatedText = await tlClient.send(com);
    return translatedText.TranslatedText;
}


export async function getHook(channel, user) {
    var cc = getChannelConfig(channel);
    var wh;
    if (cc.webhookId) {
        var whh = await channel.fetchWebhooks();
        wh = whh.find(w => w.id === cc.webhookId);
        if (!wh) {
            cc.webhookId = null;
        }
    }

    if (!cc.webhookId) {
        wh = await channel.createWebhook("Translation webhook");
        cc.webhookId = wh.id;
        await saveConfig();
    }

    return wh;
}

export async function enforceLanguage(message) {
    if (!cfg.enabled) return;
    var cc = getChannelConfig(message.channel);
    if (!cc.enforceLanguage) {
        return;
    }
    var textLang = await detectLanguage(message.content);
    if (textLang && textLang.Score > LANG_THRESHOLD && textLang.LanguageCode !== cc.language) {
        var text = await translate(message.content, cc.language);
        text = restoreMentions(text);
        var langName = languages.find(l => l.code === textLang.LanguageCode).name;
        await sendText(message.channel, text, message.author, { text: `Translated from ${langName}` });
    }
}

export async function roleTranslate(message) {
    if (!cfg.enabled) return;

    if (!cfg.role_tl) return;

    var textLang = await detectLanguage(message.content);
    if (!textLang || textLang.Score <= LANG_THRESHOLD) {
        return;
    }

    var translateTo = roleConfig.roles.filter(r => message.member.roles.cache.some(role => role.id === r.id));
    if (!translateTo?.length) {
        return;
    }
    
    for (var rt of translateTo) {
        if (textLang.LanguageCode !== rt.language) {
            var text = await translate(message.content, rt.language);
            text = restoreMentions(text);
            var langName = languages.find(l => l.code === textLang.LanguageCode).name;
            await sendText(message.channel, text, message.author, { text: `Translated from ${langName}` });
        }
    }
}

export async function mirrorMessage(message, client) {
    if (!cfg.enabled || !cfg.mirror) return;

    var cc = getChannelConfig(message.channel);
    if (!cc.groupName) {
        return;
    }

    var textLang = cfg.mirror_tl ? await detectLanguage(message.content) : null;
    var channels = cfg.channels.filter(c => c.groupName === cc.groupName && c.id !== cc.id);

    var origin = `Mirrored from channel ${message.channel.name}.`;
    for (var ch of channels) {
        var text = message.content;
        if (cfg.mirror_tl) {
            if (textLang.Score > LANG_THRESHOLD && ch.language !== textLang.LanguageCode) {
                text = await translate(message.content, ch.language);
                text = restoreMentions(text);
                var langName = languages.find(l => l.code === textLang.LanguageCode).name;
                origin = `Translated from ${langName}`;
            }
        }

        var channel = await client.channels.fetch(ch.id);
        await sendText(channel, text, message.author, { text: origin });
    }
}

export async function sendText(channel, text, user, meta) {
    if (cfg.mirror_mode === "embed") {
        sendTextEmbed(channel, text, user, meta);
    } else {
        sendTextWebhook(channel, text, user);
    }
}

export async function sendTextEmbed(channel, text, user, meta) {
    var embed = makeEmbed(text, user, meta);
    await channel.send({ embeds: [embed] });
}

export async function sendTextWebhook(channel, text, user) {
    var wh = await getHook(channel, user);
    await wh.send({ content: text, username: user.username, avatar_url: user.displayAvatarURL() });
}

export function restoreMentions(text) {
    var uidRegexp = /<\s*@\s*(.*?)\s*>/;
    var mentionRegexp = /(<\s*@\s*.*?\s*>)/g;
    var mentions = text.matchAll(mentionRegexp);

    for (const match of mentions) {
        var m = match[0];
        var uid = m.match(uidRegexp)[1];
        text = text.replace(m, `<@${uid}>`);
    }

    return text;
}

export function makeEmbed(text, user, meta) {
    var embed = new MessageEmbed()
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .setDescription(text)
        //.addField('Message', text)
        //.setThumbnail(user.displayAvatarURL())
        .setFooter(meta);
    return embed;
}