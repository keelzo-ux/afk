const {
    Client,
    GatewayIntentBits
} = require('discord.js');

const {
    joinVoiceChannel
} = require('@discordjs/voice');

const TOKEN = 'MTUwOTA5MzI4ODk5NTU5MDIyNQ.GfEUjm.1AbDjGUgUJ3ik_l2Pv9kqbG6-UC02Fu8mnvBvE';
const GUILD_ID = '1390940449929302046';
const CHANNEL_ID = '1390940734923997215';

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
        selfDeaf: false,
        selfMute: true
    });

    console.log('Bot berhasil masuk voice channel');
});

client.login(TOKEN);
