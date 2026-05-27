const {
    Client,
    GatewayIntentBits
} = require('discord.js');

const {
    joinVoiceChannel
} = require('@discordjs/voice');

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.once('clientReady', async () => {
    console.log(`Login sebagai ${client.user.tag}`);

    const guild = client.guilds.cache.get(GUILD_ID);

    if (!guild) {
        console.log('Server tidak ditemukan');
        return;
    }

    const channel = guild.channels.cache.get(CHANNEL_ID);

    if (!channel) {
        console.log('Voice channel tidak ditemukan');
        return;
    }

    joinVoiceChannel({
        channelId: CHANNEL_ID,
        guildId: GUILD_ID,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true
    });

    console.log('Bot berhasil masuk voice channel');
});

client.login(TOKEN);
