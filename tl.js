import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { ComprehendClient, DetectDominantLanguageCommand } from "@aws-sdk/client-comprehend";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createRequire } from "module";
import { MessageEmbed, MessageAttachment } from 'discord.js';
import axios from 'axios';
import * as fs from 'fs';
import gm from 'gm';

const require = createRequire(import.meta.url);
const languages = require('./languages.json');
const roleConfig = require('./role_config.json');
const appConfig = require('./config.json');


const CHANNEL_CONFIG_FILENAME = './channel_config.json';
const AVATAR_DB_FILENAME = './avatars.json';
var cfg = require(CHANNEL_CONFIG_FILENAME);
var avatars = require(AVATAR_DB_FILENAME);

const LANG_THRESHOLD = 0.7;
const tlClient = new TranslateClient({ region: "eu-central-1" });
const chClient = new ComprehendClient({ region: "eu-central-1" });
const s3Client = new S3Client({ region: "eu-central-1" });


export async function saveConfig() {
    await fs.promises.writeFile(CHANNEL_CONFIG_FILENAME, JSON.stringify(cfg));
}

export function readConfig() {
    cfg = require(CHANNEL_CONFIG_FILENAME);
}

export async function saveAvatars() {
    await fs.promises.writeFile(AVATAR_DB_FILENAME, JSON.stringify(avatars));
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
        case "translate to german":
            target = "de";
            break;
        case "translate to spanish":
            target = "es";
            break;
        case "translate to italian":
            target = "it";
            break;
        case "translate to japanese":
            target = "ja";
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
    cfg.mirrorTl = (translate.toLowerCase() === "true");
    cfg.mirrorMode = interaction.options.getString("mode");
    await saveConfig();
    
    await interaction.reply({
        content: `Mirroring is set to [${cfg.mirror}], translate [${translate}], mode [${cfg.mirrorMode}].`
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

    cfg.roleTl = (enable === 'true');
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
        Text: prepareSpecial(text),
        TargetLanguageCode: target,
        SourceLanguageCode: "auto"
    };
    var com = new TranslateTextCommand(params);
    var translatedText = await tlClient.send(com);
    return unwrapSpecial(translatedText.TranslatedText);
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

export async function enforceLanguage(message, userAvatar) {
    if (!cfg.enabled) return false;

    var cc = getChannelConfig(message.channel);
    if (!cc.enforceLanguage) {
        return false;
    }
    
    var textLang = await detectLanguage(message.content);
    if (textLang && textLang.Score > LANG_THRESHOLD && textLang.LanguageCode !== cc.language) {
        var text = ""
        if (message.content && message.content.length > 0) {
            text = await translate(message.content, cc.language);
        }
        var langName = languages.find(l => l.code === textLang.LanguageCode).name;
        await sendText(message.channel, text, message.member, userAvatar, { text: `Translated from ${langName}` });
    }
    return cc.language;
}

export async function roleTranslate(message, userAvatar, enforcedLanguage) {
    if (!cfg.enabled) return;

    if (!cfg.roleTl) return;

    var textLang = await detectLanguage(message.content);
    if (!textLang || textLang.Score <= LANG_THRESHOLD) {
        return;
    }

    var translateTo = roleConfig.roles.filter(r => message.member.roles.cache.some(role => role.id === r.id));
    if (!translateTo?.length) {
        return;
    }
    
    for (var rt of translateTo) {
        if (textLang.LanguageCode !== rt.language && rt.language !== enforcedLanguage) {
            var text = ""
            if (message.content && message.content.length > 0) {
                text = await translate(message.content, rt.language);
            }
            var langName = languages.find(l => l.code === textLang.LanguageCode).name;
            await sendText(message.channel, text, message.member, userAvatar, { text: `Translated from ${langName}` });
        }
    }
}

export async function mirrorMessage(message, client, userAvatar) {
    if (!cfg.enabled || !cfg.mirror) return;

    var cc = getChannelConfig(message.channel);
    if (!cc.groupName) {
        return;
    }

    var textLang = cfg.mirrorTl ? (message.content? await detectLanguage(message.content):null) : null;
    var channels = cfg.channels.filter(c => c.groupName === cc.groupName && c.id !== cc.id);

    var origin = `Mirrored from channel ${message.channel.name}.`;

    for (var ch of channels) {
        var text = message.content;
        if (!message.content) {
            text = "[embed only]";
        }
        var attachments = message.attachments;
        if (cfg.mirrorTl && message.content) {
            if (textLang.Score > LANG_THRESHOLD && ch.language !== textLang.LanguageCode) {                
                if (message.content && message.content.length > 0) {
                    text = await translate(message.content, ch.language);
                }
                var langName = languages.find(l => l.code === textLang.LanguageCode).name;
                origin = `Translated from ${langName}`;
            }
        }

        var channel = await client.channels.fetch(ch.id);
        console.log(JSON.stringify(attachments));
        await sendText(channel, text, message.member, userAvatar, { text: origin }, attachments);
    }
}

export async function sendText(channel, text, user, userAvatar, meta, attachments=null) {
    if (cfg.mirrorMode === "embed") {
        sendTextEmbed(channel, text, user, meta);
    } else {
        sendTextWebhook(channel, text, attachments, user, userAvatar);
    }
}

export async function sendTextEmbed(channel, text, user, meta) {
    if (text.length > 2000) {
        text = text.substr(0, 1999);
    }
    var embed = makeEmbed(text, user, meta);
    await channel.send({ embeds: [embed] });
}

export async function sendTextWebhook(channel, text, attachments, user, userAvatar) {
    var wh = await getHook(channel, user);
    if (text.length > 2000) {
        text = text.substr(0, 1999);
    }
    if (cfg.editAvatar) {

        await wh.send({
            content: text,
            username: user.displayName,
            avatarURL: userAvatar.editedUrl,
            files: attachments?.map(a=>a.attachment)
        });
    }
    else {
        await wh.send({ content: text, username: user.displayName, avatarURL: user.displayAvatarURL() });
    }
}

export function prepareSpecial(text) {
    var mentionsR = /(<\s*@\s*.*?\s*>)/g;
    var emojisR = /<\s*:\s*[_~\-a-zA-Z0-9]*\s*:\s*.*?\s*>/g;
    text = text.replace(mentionsR, '<span translate="no">$&</span>');
    text = text.replace(emojisR, '<span translate="no">$&</span>');
    return text;
}

export function unwrapSpecial(text) {
    var specialR = /\<span translate="no"\>(.*?)\<\/span\>/g;
    text = text.replace(specialR, '$1');
    return text;
}


export function makeEmbed(text, user, meta) {
    var embed = new MessageEmbed()
        .setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() })
        .setDescription(text)
        //.addField('Message', text)
        //.setThumbnail(user.displayAvatarURL())
        .setFooter(meta);
    return embed;
}

export async function uploadAvatar(path, key) {
    var fstream = fs.createReadStream(path);
    const uploadParams = {
        Bucket: appConfig.s3bucket,
        Key: `img/${key}`,
        Body: fstream
    };
    var res = await s3Client.send(new PutObjectCommand(uploadParams));
}

export async function download(url, path) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(path))
            .on('error', reject)
            .once('close', () => resolve(path));
    });
}

export async function createUserAvatar(user) {
    var ff = await user.fetch(true);
    var editedAvatar = await editAvatar(user.displayAvatarURL(), ff.hexAccentColor);
    return { path: editedAvatar, uploaded: false };
}

export async function getUserAvatar(user) {
    var hex = user.displayHexColor;
    var ua = avatars.find(a => a.accent === hex && a.url === user.displayAvatarURL());
    if (!ua) {
        ua = {
            accent: hex,
            url: user.displayAvatarURL(),
            uploaded: false
        };
        avatars.push(ua);
    }

    if (!ua.uploaded) {
        var editedAvatar = await editAvatar(ua.url, hex);
        var key = `${hex.substr(1)}_${editedAvatar.split('/').pop()}`;
        await uploadAvatar(editedAvatar, key);
        ua.editedUrl = `https://${appConfig.s3bucket}.s3.eu-central-1.amazonaws.com/img/${key}`;
        ua.uploaded = true;
        await saveAvatars();
    }

    return ua;
}

export async function editAvatar(url, color) {
    var path = `./temp/${url.split('/').pop()}`;
    await download(url, path);
    var img = gm(path);

    if (color !== "#000000") { // Treated as transparent by Discord
        img.stroke(color, 30).fill("None").drawCircle(64, 64, 115, 115);
    }
    return new Promise((resolve, reject) => {
        img.write(path, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(path);
            }
        });
    });
}

export function getEditAvatars() {
    return cfg.editAvatar;
}