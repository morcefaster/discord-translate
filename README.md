# discord-translate
*You have to use Korean in moderation. This is a paid service, so if we use Korean, we lose money.*

---

Discord message translator using AWS Translate and AWS Comprehend.

# Setup

1. Create a config.json file:
```
{
  "clientId": "YOUR_CLIENT_ID",
  "guildId": "YOUR_SERVER_ID",
  "token": "YOUR_SECRET_TOKEN"
}
```

2. Get your AWS IAM credentials into a shared credential file. [Guide](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-shared.html)

3. Run `node index.js`

# Permissions

Users with `ADMINISTRATOR` permission or those that have the role that's set in `role_config.json`->`bot_controller_role` can do privileged actions (set languages, groups, etc).

# Commands

* /translate [text] [target] 
  * Simple text translation to a target language.
    * **text**: Text to translate.
    * **target**: Target language code or name.
* /set_group [group_name]
  * [Privileged] Add the current channel to a *group*
    * **group_name**: Name of the group. A channel can only have one group assigned.

* /remove_group
  * [Privileged] Remove the group from the current channel.

* /set_language [language]
  * [Privileged] Set current channel's language.
    * **language**: Language code or name.
    
* /force_channel_language [enabled]
  * [Privileged] Set whether the channel messages get automatically translated to the set language. The channel language must be set.
    * **enabled**: either "Enable" or "Disable".
 
* /role_translation [enabled]
  * [Privileged] Set whether the role translation is enabled. If on, the users whose roles are in **role_config.json** will have their messages translated to the language set up in the file.
    * **enabled**: either "Enable" or "Disable".
    
* /mirror [enabled] [translate] [mode]
  * [Privileged] Set whether channel mirroring is enabled. If so, the channels with the same *group name* will have the messages mirrored to each other.
    * **enabled**: either "Enable" or "Disable".
    * **translate**: whether to translate the mirrored messages to the channels' respective languages. 
    * **mode**: The way the messages are sent. 
      * Webhook: Send them using webhook and make it appear like the original user is sending them.
      * Embed: Send them using discord embeds.
  
* /tl_disable
  * [Privileged] Turn off all automatic translations (mirror, channel, role translate)

* /tl_enable
  * [Privileged] Turn the automatic translations back on.
