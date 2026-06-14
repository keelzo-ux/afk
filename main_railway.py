import os
import time
import asyncio
import discord
from discord.ext import commands
from dotenv import load_dotenv, set_key
from datetime import datetime

# ── colors ────────────────────────────────────────────────
DIM    = "\033[2m"
RESET  = "\033[0m"
BOLD   = "\033[1m"
GRAY   = "\033[38;5;245m"
WHITE  = "\033[38;5;255m"
GREEN  = "\033[38;5;114m"
YELLOW = "\033[38;5;221m"
RED    = "\033[38;5;203m"
CYAN   = "\033[38;5;153m"

# ── env ───────────────────────────────────────────────────
ENV_PATH = ".env"
load_dotenv(ENV_PATH)

TOKEN = os.getenv("TOKEN", "")

def load_bool(key):
    return os.getenv(key, "false").lower() == "true"

def save_bool(key, value):
    set_key(ENV_PATH, key, "true" if value else "false")

# ── bot ───────────────────────────────────────────────────
intents = discord.Intents.default()
intents.message_content = True

koala = commands.Bot(command_prefix="!", intents=intents, chunk_guilds_at_startup=False)

koala.start_time        = None
koala.intentional_leave = False
koala.is_muted          = load_bool("IS_MUTED")
koala.is_deafened       = load_bool("IS_DEAFENED")
koala.auto_reconnect    = load_bool("AUTO_RECONNECT")

# ── logger ────────────────────────────────────────────────
def log(level, msg):
    ts = datetime.now().strftime("%H:%M:%S")
    levels = {
        "ok":   (GREEN,  "✔  ok "),
        "warn": (YELLOW, "⚠  !!"),
        "err":  (RED,    "✖  err"),
        "info": (CYAN,   "›  · "),
    }
    color, tag = levels.get(level, (GRAY, "   "))
    print(f"{DIM}{GRAY}{ts}{RESET}  {color}{BOLD}{tag}{RESET}  {WHITE}{msg}{RESET}")

# ── embed helpers ─────────────────────────────────────────
C_OK      = 0x9EB8A4
C_ERR     = 0xC4736A
C_NEUTRAL = 0x2B2D31
C_INFO    = 0x7B9EBE

def em(desc, color):
    return discord.Embed(description=desc, color=color)

def toggle_color(state):
    return C_OK if state else C_NEUTRAL

def on_off(state):
    return "on" if state else "off"

# ── events ────────────────────────────────────────────────
@koala.event
async def on_ready():
    print(f"""
{CYAN}{BOLD}  🐨  koala{RESET}  {GRAY}/{RESET}  {WHITE}online{RESET}
{GRAY}  {'─' * 36}
  🔗  user    {RESET}{WHITE}{koala.user}{RESET}
{GRAY}  ⌨️   prefix  {RESET}{WHITE}!{RESET}
{GRAY}  {'─' * 36}{RESET}
""")

@koala.event
async def on_voice_state_update(member, before, after):
    if member.id != koala.user.id:
        return
    if before.channel and not after.channel and koala.start_time:
        if koala.intentional_leave:
            koala.intentional_leave = False
            return
        if not koala.auto_reconnect:
            return
        log("warn", f"disconnected from {before.channel.name}  →  retrying in 3s")
        await asyncio.sleep(3)
        await koala.wait_until_ready()
        try:
            await before.channel.connect()
            await before.channel.guild.change_voice_state(
                channel=before.channel,
                self_mute=koala.is_muted,
                self_deaf=koala.is_deafened
            )
            koala.start_time = time.time()
            log("ok", f"reconnected  →  {before.channel.name}")
        except Exception as e:
            log("err", f"reconnect failed  —  {e}")

@koala.event
async def on_message(message):
    if message.content == "hi":
        log("info", f"{message.author} said hi")
    await koala.process_commands(message)

# ── commands ──────────────────────────────────────────────
@koala.command()
async def join(ctx, channel_id: int):
    channel = koala.get_channel(channel_id)
    if not channel:
        log("err", "channel not found")
        await ctx.send(embed=em("❌  channel not found", C_ERR))
        return
    if ctx.voice_client:
        await ctx.voice_client.disconnect()
    await channel.connect()
    await ctx.guild.change_voice_state(channel=channel, self_mute=True, self_deaf=True)
    koala.intentional_leave = False
    koala.start_time = time.time()
    log("ok", f"joined  →  {channel.name}")
    e = discord.Embed(title="🔊  joined voice", color=C_OK)
    e.add_field(name="📡  channel", value=f"`{channel.name}`")
    e.set_footer(text="koala")
    e.timestamp = discord.utils.utcnow()
    await ctx.send(embed=e)

@koala.command()
async def leave(ctx):
    if ctx.voice_client:
        ch = ctx.voice_client.channel.name
        koala.intentional_leave = True
        await ctx.voice_client.disconnect()
        koala.start_time = None
        log("ok", f"left  →  {ch}")
        e = discord.Embed(title="🚪  left voice", color=C_NEUTRAL)
        e.add_field(name="📡  channel", value=f"`{ch}`")
        e.set_footer(text="koala")
        e.timestamp = discord.utils.utcnow()
        await ctx.send(embed=e)
    else:
        await ctx.send(embed=em("❌  not in a voice channel", C_ERR))

@koala.command()
async def status(ctx):
    vc = ctx.voice_client
    if vc and koala.start_time:
        secs = int(time.time() - koala.start_time)
        h, r = divmod(secs, 3600)
        m, s = divmod(r, 60)
        e = discord.Embed(title="📊  status", color=C_INFO)
        e.add_field(name="📡  channel",        value=f"`{vc.channel.name}`",                    inline=True)
        e.add_field(name="⏱️  uptime",          value=f"`{h:02d}:{m:02d}:{s:02d}`",              inline=True)
        e.add_field(name="\u200b",             value="\u200b",                                  inline=False)
        e.add_field(name="🎙️  muted",           value=f"`{on_off(koala.is_muted)}`",             inline=True)
        e.add_field(name="🔇  deafened",        value=f"`{on_off(koala.is_deafened)}`",          inline=True)
        e.add_field(name="🔁  auto reconnect",  value=f"`{on_off(koala.auto_reconnect)}`",       inline=True)
        e.set_footer(text="koala")
        e.timestamp = discord.utils.utcnow()
        await ctx.send(embed=e)
    else:
        await ctx.send(embed=em("❌  not in a voice channel", C_ERR))

@koala.command()
async def ping(ctx):
    ms = round(koala.latency * 1000)
    e = discord.Embed(title="🏓  pong", color=C_NEUTRAL)
    e.add_field(name="📶  latency", value=f"`{ms} ms`")
    e.set_footer(text="koala")
    e.timestamp = discord.utils.utcnow()
    await ctx.send(embed=e)

@koala.command()
async def mute(ctx):
    if ctx.voice_client:
        vc = ctx.voice_client
        koala.is_muted = not koala.is_muted
        save_bool("IS_MUTED", koala.is_muted)
        await ctx.guild.change_voice_state(channel=vc.channel, self_mute=koala.is_muted, self_deaf=koala.is_deafened)
        e = discord.Embed(title="🎙️  self mute", color=toggle_color(not koala.is_muted))
        e.add_field(name="state", value=f"`{on_off(koala.is_muted)}`")
        e.set_footer(text="koala")
        e.timestamp = discord.utils.utcnow()
        await ctx.send(embed=e)
    else:
        await ctx.send(embed=em("❌  not in a voice channel", C_ERR))

@koala.command()
async def deaf(ctx):
    if ctx.voice_client:
        vc = ctx.voice_client
        koala.is_deafened = not koala.is_deafened
        save_bool("IS_DEAFENED", koala.is_deafened)
        await ctx.guild.change_voice_state(channel=vc.channel, self_mute=koala.is_muted, self_deaf=koala.is_deafened)
        e = discord.Embed(title="🔇  self deaf", color=toggle_color(not koala.is_deafened))
        e.add_field(name="state", value=f"`{on_off(koala.is_deafened)}`")
        e.set_footer(text="koala")
        e.timestamp = discord.utils.utcnow()
        await ctx.send(embed=e)
    else:
        await ctx.send(embed=em("❌  not in a voice channel", C_ERR))

@koala.command()
async def reconnect(ctx):
    vc = ctx.voice_client
    if vc:
        channel = vc.channel
        await vc.disconnect()
        await asyncio.sleep(1)
        await channel.connect()
        await ctx.guild.change_voice_state(channel=channel, self_mute=True, self_deaf=True)
        koala.start_time = time.time()
        log("ok", f"reconnected  →  {channel.name}")
        e = discord.Embed(title="🔄  reconnected", color=C_OK)
        e.add_field(name="📡  channel", value=f"`{channel.name}`")
        e.set_footer(text="koala")
        e.timestamp = discord.utils.utcnow()
        await ctx.send(embed=e)
    else:
        await ctx.send(embed=em("❌  not in a voice channel", C_ERR))

@koala.command()
async def autoreconnect(ctx):
    koala.auto_reconnect = not koala.auto_reconnect
    save_bool("AUTO_RECONNECT", koala.auto_reconnect)
    e = discord.Embed(title="🔁  auto reconnect", color=toggle_color(koala.auto_reconnect))
    e.add_field(name="state", value=f"`{on_off(koala.auto_reconnect)}`")
    e.set_footer(text="koala")
    e.timestamp = discord.utils.utcnow()
    await ctx.send(embed=e)

@koala.command()
async def listc(ctx):
    e = discord.Embed(
        title="🐨  koala  —  commands",
        description="all commands use the `!` prefix",
        color=C_NEUTRAL
    )
    e.add_field(name="🔊  voice", value=(
        "`!join <id>`  —  join a voice channel\n"
        "`!leave`  —  disconnect from vc\n"
        "`!reconnect`  —  rejoin current vc\n"
        "`!autoreconnect`  —  toggle auto rejoin\n"
        "`!mute`  —  toggle self mute\n"
        "`!deaf`  —  toggle self deaf\n"
        "`!status`  —  uptime + vc info"
    ), inline=False)
    e.add_field(name="🛠️  utility", value=(
        "`!ping`  —  latency\n"
        "`!listc`  —  this menu"
    ), inline=False)
    e.set_footer(text="koala  •  use responsibly")
    e.timestamp = discord.utils.utcnow()
    await ctx.send(embed=e)

# ── run ───────────────────────────────────────────────────
try:
    koala.run(TOKEN)
except Exception as e:
    log("err", f"failed to start  —  {e}")
