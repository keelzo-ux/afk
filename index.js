require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType
} = require("discord.js");

const app = express();
app.use(express.static("public"));

app.get("/api/status", (req, res) => {
  res.json({
    bot: client.user?.tag || "Starting...",
    ping: client.ws.ping || 0,
    uptime: startTime
      ? Math.floor((Date.now() - startTime) / 1000)
      : 0,
    ram: Math.round(process.memoryUsage().rss / 1024 / 1024),
    guilds: client.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      members: g.memberCount
    }))
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Dashboard Running");
});
const TOKEN = process.env.TOKEN;
const IS_MUTED = process.env.IS_MUTED === "true";
const IS_DEAFENED = process.env.IS_DEAFENED === "true";
const AUTO_RECONNECT = process.env.AUTO_RECONNECT === "true";

console.log(TOKEN);
console.log(IS_MUTED);
console.log(IS_DEAFENED);
console.log(AUTO_RECONNECT);

const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const PREFIX = "!";
let isMuted = true;
let isDeafened = true;
let autoReconnect = true;
let startTime = null;

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === PREFIX + "panel") {

    const embed = new EmbedBuilder()
      .setAuthor({
        name: "🐨 Koala | AFK Bot",
        iconURL: client.user.displayAvatarURL()
      })
      
      .setTitle("🐨 Koala — Commands")
      .setDescription("Interact via buttons or use system Slash Commands!")
      .addFields(
        {
          name: "🔊 Voice",
          value: "`Join` — Join VC\n`Leave` — Leave VC\n`Status` — VC Status"
        },
        {
          name: "🔀 Toggles",
          value: "`Mute` — Toggle Mute\n`Deaf` — Toggle Deaf\n`AutoReconnect` — Toggle Auto Rejoin"
        },
        {
          name: "⚙️ Current States",
          value:
            `🎙️ Mute: ${isMuted ? "On" : "Off"}\n` +
            `🔇 Deaf: ${isDeafened ? "On" : "Off"}\n` +
            `🔁 AutoReconnect: ${autoReconnect ? "On" : "Off"}`
        }
      )
      .setColor(0x2B2D31)
      .setFooter({ text: "Koala • Use Responsibly" })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("mute").setLabel("Mute").setEmoji("🎙️").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("deaf").setLabel("Deaf").setEmoji("🔇").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("autoreconnect").setLabel("Auto-Reconnect").setEmoji("🔁").setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("join").setLabel("Join").setEmoji("🔊").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("leave").setLabel("Leave").setEmoji("🚪").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("reconnect").setLabel("Reconnect").setEmoji("🔄").setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("status").setLabel("Status").setEmoji("📊").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ping").setLabel("Ping").setEmoji("🏓").setStyle(ButtonStyle.Secondary)
    );

    await message.channel.send({
      embeds: [embed],
      components: [row1, row2, row3]
    });
  }
});

client.on("interactionCreate", async interaction => {

  if (interaction.isButton()) {

    if (interaction.customId === "join") {
      const menu = new ChannelSelectMenuBuilder()
        .setCustomId("select_vc")
        .setPlaceholder("Pilih Voice Channel")
        .addChannelTypes(ChannelType.GuildVoice);

      return interaction.reply({
        content: "🔊 Pilih Voice Channel",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    if (interaction.customId === "leave") {
      const conn = getVoiceConnection(interaction.guild.id);
      if (conn) conn.destroy();

      return interaction.reply({
        content: "🚪 Keluar dari Voice Channel",
        ephemeral: true
      });
    }

    if (interaction.customId === "mute") {
      isMuted = !isMuted;
      return interaction.reply({ content: `Mute: ${isMuted}`, ephemeral: true });
    }

    if (interaction.customId === "deaf") {
      isDeafened = !isDeafened;
      return interaction.reply({ content: `Deaf: ${isDeafened}`, ephemeral: true });
    }

    if (interaction.customId === "autoreconnect") {
      autoReconnect = !autoReconnect;
      return interaction.reply({ content: `AutoReconnect: ${autoReconnect}`, ephemeral: true });
    }

    if (interaction.customId === "status") {
      const uptime = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
      return interaction.reply({ content: `📊 Uptime: ${uptime}s`, ephemeral: true });
    }

    if (interaction.customId === "ping") {
      return interaction.reply({ content: `🏓 ${client.ws.ping}ms`, ephemeral: true });
    }

    if (interaction.customId === "reconnect") {
      return interaction.reply({ content: "🔄 Reconnect clicked", ephemeral: true });
    }
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === "select_vc") {

    const channel = interaction.channels.first();

    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfMute: isMuted,
      selfDeaf: isDeafened
    });

    startTime = Date.now();

    await interaction.update({
      content: `✅ Berhasil join ${channel.name}`,
      components: []
    });
  }
});

client.login(process.env.TOKEN);
                                
