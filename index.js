require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType, StringSelectMenuBuilder } = require('discord.js');

const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('YAPPINGPERSON is running!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Express server running on port ${port}`);
});


const { Manager } = require('erela.js');

const nodes = [{
  host: 'lava-v3.ajieblogs.eu.org',
  port: 80,
  password: 'https://dsc.gg/ajidevserver',
  secure: false,
}];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const manager = new Manager({
  nodes,
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
  defaultSearchPlatform: 'youtube',
  autoPlay: true,
  clientName: `${client.user?.username || 'Music Bot'}`,
  plugins: []
});

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Memutar lagu dari nama/URL')
    .addStringOption(option => 
      option.setName('query')
        .setDescription('Nama lagu atau URL')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Menghentikan pemutaran lagu saat ini'),
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Melanjutkan pemutaran lagu'),
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Melewati lagu saat ini'),
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Menunjukkan antrian lagu'),
  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Menunjukkan lagu yang diputar'),
  new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Mengacak antrian lagu'),
  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Pengulangan lagu')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Mode pengulangan')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Menghapus lagu dari antrian')
    .addIntegerOption(option =>
      option.setName('position')
        .setDescription('Posisi di antrian')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('move')
    .setDescription('Pindahkan lagu ke posisi lain')
    .addIntegerOption(option =>
      option.setName('from')
        .setDescription('Dari posisi')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('to')
        .setDescription('Ke posisi')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Bersihkan antrian'),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop musik dan disconnect'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Atur volume')
    .addIntegerOption(option =>
      option.setName('level')
        .setDescription('Level volume (0-100)')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('247')
    .setDescription('Beralih ke mode 24/7'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Tampilkan semua commands'),
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Link invite BOT'),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Tunjukkan ping BOT'),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Tunjukkan statistik BOT'),
  new SlashCommandBuilder()
    .setName('support')
    .setDescription('Join support server'),

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  manager.init(client.user.id);

  client.user.setActivity('/help | BOT Musik', { type: ActivityType.Listening });

  try {
    console.log('Refreshing slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error(error);
  }
});

client.on('raw', (data) => manager.updateVoiceState(data));

function createMusicEmbed(track) {
  return new EmbedBuilder()
    .setTitle('🎵 Sedang memutar')
    .setDescription(`[${track.title}](${track.uri})`)
    .addFields(
      { name: '👤 Artis', value: track.author, inline: true },
      { name: '⏱️ Durasi', value: formatDuration(track.duration), inline: true }
    )
    .setThumbnail(track.thumbnail)
    .setColor('#FF0000');
}

function formatDuration(duration) {
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, '0')}`;
}

function createControlButtons() {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('pause')
          .setLabel('Pause/Resume')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('skip')
          .setLabel('Skip')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('stop')
          .setLabel('Stop')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('loop')
          .setLabel('Loop')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('queue')
          .setLabel('Queue')
          .setStyle(ButtonStyle.Secondary)
      )
  ];
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;

  if (interaction.isButton()) {
    if (!interaction.member.voice.channel) {
      return interaction.reply({ content: 'Anda perlu bergabung dengan saluran suara untuk menggunakan tombol!', ephemeral: true });
    }
    const player = manager.players.get(interaction.guild.id);
    if (!player) return;

    const currentTrack = player.queue.current;
    if (!currentTrack) return;

    if (currentTrack.requester.id !== interaction.user.id) {
      return interaction.reply({ content: 'Hanya orang yang meminta lagu ini yang dapat menggunakan tombol ini!', ephemeral: true });
    }

    switch (interaction.customId) {
      case 'pause':
        player.pause(!player.paused);
        await interaction.reply({ content: player.paused ? 'Paused' : 'Resumed', ephemeral: true });
        break;
      case 'skip':
        const skipMessage = player.get('currentMessage');
        if (skipMessage && skipMessage.editable) {
          const disabledButtons = skipMessage.components[0].components.map(button => {
            return ButtonBuilder.from(button).setDisabled(true);
          });
          skipMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
        }
        if (player.queue.length === 0) {
          const queueEndEmbed = new EmbedBuilder()
            .setDescription('Queue has ended!')
            .setColor('#FF0000')
            .setTimestamp();
          await interaction.channel.send({ embeds: [queueEndEmbed] });
          player.set('manualStop', true);
        }
        player.stop();
        await interaction.reply({ content: 'Skipped', ephemeral: true });
        break;
      case 'stop':
        const stopMessage = player.get('currentMessage');
        if (stopMessage && stopMessage.editable) {
          const disabledButtons = stopMessage.components[0].components.map(button => {
            return ButtonBuilder.from(button).setDisabled(true);
          });
          stopMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
        }
        player.set('manualStop', true);
        const stopEmbed = new EmbedBuilder()
          .setDescription('Queue has ended!')
          .setColor('#FF0000')
          .setTimestamp();
        await interaction.channel.send({ embeds: [stopEmbed] });
        player.destroy();
        await interaction.reply({ content: 'Stopped', ephemeral: true });
        break;
      case 'loop':
        player.setQueueRepeat(!player.queueRepeat);
        await interaction.reply({ content: `Loop: ${player.queueRepeat ? 'Diaktifkan' : 'Dinonaktifkan'}`, ephemeral: true });
        break;
      case 'queue':
        const queue = player.queue;
        const currentTrack = player.queue.current;
        let description = queue.length > 0 ? queue.map((track, i) => 
          `${i + 1}. [${track.title}](${track.uri})`).join('\n') : 'Tidak ada lagi diantrian';

        if (currentTrack) description = `**Sekarang memutar:**\n[${currentTrack.title}](${currentTrack.uri})\n\n**Queue:**\n${description}`;

        const embed = new EmbedBuilder()
          .setTitle('Queue')
          .setDescription(description)
          .setColor('#FF0000')
          .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
    }
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'filter') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return;

    const filter = interaction.values[0];
    player.node.send({
      op: 'filters',
      guildId: interaction.guild.id,
      [filter]: true
    });

    const embed = new EmbedBuilder()
      .setDescription(`🎵 Mengaktifkan filter: ${filters[filter]}`)
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  const { commandName, options } = interaction;

  if (commandName === 'play') {
    if (!interaction.member.voice.channel) {
      return interaction.reply({ content: 'Masuklah ke voice channel terlebih dahulu!', ephemeral: true });
    }

    const player = manager.create({
      guild: interaction.guild.id,
      voiceChannel: interaction.member.voice.channel.id,
      textChannel: interaction.channel.id,
      selfDeafen: true
    });

    if (!player.twentyFourSeven) player.twentyFourSeven = false;

    player.connect();

    const query = options.getString('query');
    const res = await manager.search(query, interaction.user);

    switch (res.loadType) {
      case 'TRACK_LOADED':
      case 'SEARCH_RESULT':
        if (!res.tracks || res.tracks.length === 0) {
          await interaction.reply({ content: 'Tidak ada hasil yang ditemukan! Silakan coba istilah pencarian yang lain.', ephemeral: true });
          return;
        }
        const track = res.tracks[0];
        player.queue.add(track);
        const embed = new EmbedBuilder()
          .setDescription(`Ditambahkan [${track.title}](${track.uri}) ke antrian`)
          .setColor('#FF0000')
          .setFooter({ 
            text: `Requested by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        if (!player.playing && !player.paused) player.play();
        break;
      case 'NO_MATCHES':
        await interaction.reply({ content: 'Tidak ada hasil yang ditemukan! Silakan coba istilah pencarian yang lain.', ephemeral: true });
        break;
      case 'LOAD_FAILED':
        await interaction.reply({ content: 'Gagal memuat trek! Silakan coba lagi atau gunakan URL lain.', ephemeral: true });
        break;
    }
  }

  if (commandName === 'pause') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });

    player.pause(true);
    const embed = new EmbedBuilder()
      .setDescription('⏸️ Menghentikan pemutaran')
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'resume') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memutar apa pun!', ephemeral: true });

    player.pause(false);
    const embed = new EmbedBuilder()
      .setDescription('▶️ Melanjutkan pemutaran')
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'skip') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });

    player.stop();
    const embed = new EmbedBuilder()
      .setDescription('⏭️ Melewati lagu')
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'queue') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });

    const queue = player.queue;
    const currentTrack = player.queue.current;
    let description = queue.length > 0 ? queue.map((track, i) => 
      `${i + 1}. [${track.title}](${track.uri})`).join('\n') : 'Tidak ada lagu diantrian';

    if (currentTrack) description = `**Sedang dimainkan:**\n[${currentTrack.title}](${currentTrack.uri})\n\n**Antrian:**\n${description}`;

    const embed = new EmbedBuilder()
      .setTitle('🎵 Antrian')
      .setDescription(`\n**Antrian:**\n${description}`)
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'nowplaying') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });

    const track = player.queue.current;
    if (!track) return interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });

    const embed = createMusicEmbed(track);
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'shuffle') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });

    player.queue.shuffle();
    const embed = new EmbedBuilder()
      .setDescription('🔀 Mengacak antrian')
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'loop') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });

    const mode = options.getString('mode');
    switch (mode) {
      case 'off':
        player.setQueueRepeat(false);
        player.setTrackRepeat(false);
        break;
      case 'track':
        player.setQueueRepeat(false);
        player.setTrackRepeat(true);
        break;
      case 'queue':
        player.setQueueRepeat(true);
        player.setTrackRepeat(false);
        break;
    }

    const embed = new EmbedBuilder()
      .setDescription(`🔄 Mode loop diatur ke: ${mode}`)
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'remove') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });

    const pos = options.getInteger('position') - 1;
    if (pos < 0 || pos >= player.queue.length) {
      return interaction.reply({ content: 'Posisi invalid', ephemeral: true });
    }

    const removed = player.queue.remove(pos);
    const embed = new EmbedBuilder()
      .setDescription(`❌ Menghapus [${removed.title}](${removed.uri})`)
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'move') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });

    const from = options.getInteger('from') - 1;
    const to = options.getInteger('to') - 1;

    if (from < 0 || from >= player.queue.length || to < 0 || to >= player.queue.length) {
      return interaction.reply({ content: 'Posisi invalid', ephemeral: true });
    }

    const track = player.queue[from];
    player.queue.remove(from);
    player.queue.add(track, to);

    const embed = new EmbedBuilder()
      .setDescription(`📦 Berpindah [${track.title}](${track.uri}) ke posisi ${to + 1}`)
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'clearqueue') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });

    player.queue.clear();
    const embed = new EmbedBuilder()
      .setDescription('🗑️ Bersihkan antrian')
      .setColor('#FF0000')
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'stop') {
    const player = manager.players.get(interaction.guild.id);
    if (player) {
      player.set('manualStop', true);
      const stopMessage = player.get('currentMessage');
      if (stopMessage && stopMessage.editable) {
        const disabledButtons = stopMessage.components[0].components.map(button => {
          return ButtonBuilder.from(button).setDisabled(true);
        });
        stopMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
      }
      const stopEmbed = new EmbedBuilder()
        .setDescription('Antrian telah berakhir!')
        .setColor('#FF0000')
        .setTimestamp();
      await interaction.channel.send({ embeds: [stopEmbed] });
      player.destroy();
      await interaction.reply({ content: '⏹️ Stopped musik dan disconnect', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Tidak memainkan apapun', ephemeral: true });
    }
  }

  if (commandName === 'volume') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak memaknkan apapun', ephemeral: true });

    const volume = options.getInteger('level');
    if (volume < 0 || volume > 100) {
      return interaction.reply({ content: 'Volume harus diantara 0 dan 100!', ephemeral: true });
    }

    player.setVolume(volume);
    await interaction.reply(`🔊 Volume diatur ke ${volume}%`);
  }

  if (commandName === '247') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Tidak ada musik yang dimainkan', ephemeral: true });

    player.twentyFourSeven = !player.twentyFourSeven;
    const embed = new EmbedBuilder()
      .setDescription(`🎵 Mode 24/7 sekarang ${player.twentyFourSeven ? 'diaktifkan' : 'dinonaktifkan'}`)
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle(`🎵 ${client.user.username} Commands`)
      .setDescription('BOT musik terbaik dengan pemutaran berkualitas tinggi')
      .addFields(
        { name: '🎵 Kontrol Musik', value: 
          '`/play` - Memutar musik berdasar nama/URL\n' +
          '`/pause` - ⏸️ Jeda pemutaran saat ini\n' +
          '`/resume` - ▶️ Melanjutkan pemutaran\n' +
          '`/stop` - ⏹️ Stop dan disconnect\n' +
          '`/skip` - ⏭️ Lompat ke lagu selanjutnya\n' +
          '`/volume` - 🔊 Mengatur volume (0-100)'
        },
        { name: '📑 Manajemen Antrian', value: 
          '`/queue` - 📜 Melihat antrian\n' +
          '`/nowplaying` - 🎵 Tampilkan trek saat ini\n' +
          '`/shuffle` - 🔀 Acak antrian\n' +
          '`/loop` - 🔁 Mengatur mode pengacakan\n' +
          '`/remove` - ❌ Menghapus lagu\n' +
          '`/move` - ↕️ Pindahkan posisi trek'
        },
        { name: '⚙️ Utility', value: 
          '`/247` - 🔄 Beralih ke mode 24/7\n' +
          '`/ping` - 📡 Periksa latensi\n' +
          '`/stats` - 📊 Lihat statistik\n' +
          '`/invite` - 📨 Invite BOT ke server\n' +
          '`/support` - 💬 Join support server'
        }
      )
      .setColor('#FF0000')
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ 
        text: `Made By EdriiV7 • Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    return await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'invite') {
    const embed = new EmbedBuilder()
      .setTitle('📨 Invite Me')
      .setDescription(`[Klik disini untuk mengundang BOT](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands)`)
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'ping') {
    const ping = Math.round(client.ws.ping);
    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setDescription(`WebSocket Ping: ${ping}ms`)
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }



  if (commandName === 'stats') {
    const uptime = Math.round(client.uptime / 1000);
    const seconds = uptime % 60;
    const minutes = Math.floor((uptime % 3600) / 60);
    const hours = Math.floor((uptime % 86400) / 3600);
    const days = Math.floor(uptime / 86400);

    const embed = new EmbedBuilder()
      .setTitle('📊 Bot Statistics')
      .addFields(
        { name: '⌚ Uptime', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: '🎵 Active Players', value: `${manager.players.size}`, inline: true },
        { name: '🌐 Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: '👥 Users', value: `${client.users.cache.size}`, inline: true },
        { name: '📡 Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true }
      )
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'support') {
    const embed = new EmbedBuilder()
      .setTitle('💬 Support Server')
      .setDescription(`[Klik disini untuk bergabung](${process.env.SUPPORT_SERVER})`)
      .setColor('#FF0000')
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
});

manager.on('nodeConnect', (node) => {
  console.log(`Node ${node.options.identifier} connected`);
});

manager.on('nodeError', (node, error) => {
  console.error(`Node ${node.options.identifier} error:`, error.message);
});

manager.on('trackStart', (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) {
    const embed = createMusicEmbed(track);
    const buttons = createControlButtons();
    channel.send({ embeds: [embed], components: buttons }).then(msg => {
      player.set('currentMessage', msg);
    });
  }
});

manager.on('queueEnd', (player) => {
  if (player.get('manualStop')) return;

  const channel = client.channels.cache.get(player.textChannel);
  if (channel) {
    const embed = new EmbedBuilder()
      .setDescription('Antrian telah berakhir!')
      .setColor('#FF0000')
      .setTimestamp();
    channel.send({ embeds: [embed] });

    const message = player.get('currentMessage');
    if (message && message.editable) {
      const disabledButtons = message.components[0].components.map(button => {
        return ButtonBuilder.from(button).setDisabled(true);
      });
      message.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
