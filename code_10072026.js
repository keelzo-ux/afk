require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const P = require("pino");

// === KONFIGURASI AWAL ===
const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_NUMBER = process.env.OWNER_NUMBER; // Contoh: "6281234567890"

let isMuted = process.env.IS_MUTED === "true";
let isDeafened = process.env.IS_DEAFENED === "true";
let autoReconnect = process.env.AUTO_RECONNECT === "true";
let startTime = null;
let dcClient = null;
let waSock = null;

// ==============================================
// BAGIAN BOT DISCORD
// ==============================================
function startDiscordBot() {
  dcClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates
    ]
  });

  dcClient.once("ready", () => {
    console.log(`✅ Discord Bot Masuk sebagai: ${dcClient.user.tag}`);
    kirimKePemilik(`✅ Bot Discord sudah siap!\nNama: ${dcClient.user.tag}\nWaktu mulai: ${new Date().toLocaleString("id-ID")}`);
  });

  dcClient.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.content === "!panel") tampilkanPanel(message);
  });

  dcClient.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) tombolPanel(interaction);
    if (interaction.isChannelSelectMenu() && interaction.customId === "select_vc") pilihSaluranSuara(interaction);
  });

  dcClient.login(TOKEN);
}

async function tampilkanPanel(message) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: "🐨 Koala | AFK Bot", iconURL: dcClient.user.displayAvatarURL() })
    .setTitle("🐨 Koala — Panel Kontrol")
    .setDescription("Gunakan tombol atau kontrol lewat WhatsApp!")
    .addFields(
      { name: "🔊 Suara", value: "`Gabung` — Masuk ruang suara\n`Keluar` — Keluar ruang suara\n`Status` — Lihat status" },
      { name: "🔄 Pengaturan", value: "`Bungkam` — Nyalakan/matikan bisu\n`Tuli` — Nyalakan/matikan matikan suara\n`SambungUlang` — Sambung ulang otomatis" },
      { name: "⚙️ Kondisi Sekarang", value:
        `🎙️ Bisu: ${isMuted ? "Aktif" : "Mati"}\n` +
        `🔇 Tuli: ${isDeafened ? "Aktif" : "Mati"}\n` +
        `🔁 Sambung Otomatis: ${autoReconnect ? "Aktif" : "Mati"}` }
    )
    .setColor(0x2B2D31)
    .setFooter({ text: "Koala • Gunakan dengan bijak" })
    .setTimestamp();

  const baris1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("mute").setLabel("Bisu").setEmoji("🎙️").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("deaf").setLabel("Tuli").setEmoji("🔇").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("autoreconnect").setLabel("Sambung Otomatis").setEmoji("🔁").setStyle(ButtonStyle.Success)
  );
  const baris2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("join").setLabel("Masuk Ruang").setEmoji("🔊").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("leave").setLabel("Keluar").setEmoji("🚪").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("reconnect").setLabel("Sambung Ulang").setEmoji("🔄").setStyle(ButtonStyle.Primary)
  );
  const baris3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("status").setLabel("Waktu Aktif").setEmoji("📊").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ping").setLabel("Kecepatan").setEmoji("🏓").setStyle(ButtonStyle.Secondary)
  );

  await message.channel.send({ embeds: [embed], components: [baris1, baris2, baris3] });
}

async function tombolPanel(interaction) {
  if (interaction.customId === "join") {
    const menu = new ChannelSelectMenuBuilder().setCustomId("select_vc").setPlaceholder("Pilih Saluran Suara").addChannelTypes(ChannelType.GuildVoice);
    return interaction.reply({ content: "🔊 Silakan pilih saluran suara", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  }
  if (interaction.customId === "leave") {
    const conn = getVoiceConnection(interaction.guild.id);
    if (conn) conn.destroy();
    return interaction.reply({ content: "🚪 Telah keluar dari saluran suara", ephemeral: true });
  }
  if (interaction.customId === "mute") { isMuted = !isMuted; return interaction.reply({ content: `🎙️ Bisu diubah jadi: ${isMuted ? "Aktif" : "Mati"}`, ephemeral: true }); }
  if (interaction.customId === "deaf") { isDeafened = !isDeafened; return interaction.reply({ content: `🔇 Tuli diubah jadi: ${isDeafened ? "Aktif" : "Mati"}`, ephemeral: true }); }
  if (interaction.customId === "autoreconnect") { autoReconnect = !autoReconnect; return interaction.reply({ content: `🔁 Sambung ulang otomatis: ${autoReconnect ? "Aktif" : "Mati"}`, ephemeral: true }); }
  if (interaction.customId === "status") {
    const lama = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    return interaction.reply({ content: `📊 Bot sudah aktif selama: ${lama} detik`, ephemeral: true });
  }
  if (interaction.customId === "ping") return interaction.reply({ content: `🏓 Kecepatan respon: ${dcClient.ws.ping}ms`, ephemeral: true });
  if (interaction.customId === "reconnect") return interaction.reply({ content: "🔄 Sedang menyambung ulang...", ephemeral: true });
}

async function pilihSaluranSuara(interaction) {
  const saluran = interaction.channels.first();
  joinVoiceChannel({
    channelId: saluran.id,
    guildId: saluran.guild.id,
    adapterCreator: saluran.guild.voiceAdapterCreator,
    selfMute: isMuted,
    selfDeaf: isDeafened
  });
  startTime = Date.now();
  await interaction.update({ content: `✅ Berhasil masuk ke: ${saluran.name}`, components: [] });
}

// ==============================================
// BAGIAN BOT WHATSAPP
// ==============================================
async function mulaiBotWA() {
  const { state, saveCreds } = await useMultiFileAuthState("sesi_wa");
  waSock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" })
  });

  waSock.ev.on("creds.update", saveCreds);

  waSock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (connection === "close") {
      const alasan = lastDisconnect?.error?.output?.statusCode;
      if (alasan !== DisconnectReason.loggedOut) mulaiBotWA();
      else console.log("❌ Keluar dari akun WhatsApp, jalankan ulang");
    }
    if (connection === "open") console.log("✅ Bot WhatsApp sudah terhubung");
  });

  waSock.ev.on("messages.upsert", async m => {
    const pesan = m.messages[0];
    if (!pesan.message || pesan.key.fromMe) return;
    const nomorPengirim = pesan.key.remoteJid.replace("@s.whatsapp.net", "");
    const teks = pesan.message.conversation || pesan.message.extendedTextMessage?.text || "";

    // Hanya pemilik yang boleh berkomando
    if (nomorPengirim !== OWNER_NUMBER) return;

    await perintahDariWA(nomorPengirim, teks.trim().toLowerCase());
  });
}

async function perintahDariWA(nomor, teks) {
  if (!dcClient) return kirimKePemilik("⏳ Bot Discord belum siap, coba lagi nanti");

  if (teks === "!infobot") {
    const info = `
📋 **INFORMASI BOT DISCORD**
Nama Bot: ${dcClient.user.tag}
ID Bot: ${dcClient.user.id}
Waktu Mulai: ${startTime ? new Date(startTime).toLocaleString("id-ID") : "Belum tercatat"}
Lama Aktif: ${startTime ? Math.floor((Date.now() - startTime)/1000) + " detik" : "-"}
Kecepatan Respon: ${dcClient.ws.ping}ms

⚙️ PENGATURAN SAAT INI:
🎙️ Bisu: ${isMuted ? "Aktif" : "Mati"}
🔇 Tuli: ${isDeafened ? "Aktif" : "Mati"}
🔁 Sambung Otomatis: ${autoReconnect ? "Aktif" : "Mati"}
    `.trim();
    kirimKePemilik(info);
  }
  else if (teks === "!daftarkomando") {
    kirimKePemilik(`
📝 **DAFTAR PERINTAH LEBIH WA**
!infobot — Lihat semua info bot Discord
!bisunyala — Nyalakan bisu otomatis
!bisumatikan — Matikan bisu otomatis
!tulinya — Nyalakan matikan suara
!tulimatikan — Matikan fitur tuli
!bantuan — Tampilkan pesan ini
    `.trim());
  }
  else if (teks === "!bisunyala") { isMuted = true; kirimKePemilik("✅ Fitur Bisu sudah diaktifkan"); }
  else if (teks === "!bisumatikan") { isMuted = false; kirimKePemilik("✅ Fitur Bisu sudah dimatikan"); }
  else if (teks === "!tulinya") { isDeafened = true; kirimKePemilik("✅ Fitur Tuli sudah diaktifkan"); }
  else if (teks === "!tulimatikan") { isDeafened = false; kirimKePemilik("✅ Fitur Tuli sudah dimatikan"); }
  else kirimKePemilik("❌ Perintah tidak dikenali. Ketik !daftarkomando untuk melihat daftar perintah");
}

function kirimKePemilik(pesan) {
  if (!waSock) return;
  waSock.sendMessage(`${OWNER_NUMBER}@s.whatsapp.net`, { text: pesan });
}

// ==============================================
// MULAI KEDUA BOT
// ==============================================
console.log("⏳ Sedang menyiapkan sistem...");
startDiscordBot();
mulaiBotWA();
