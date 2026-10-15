require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const STATE_FILE = path.join(__dirname, 'state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('State okunamadı:', err);
  }
  return { lastStreamId: null };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('State yazılamadı:', err);
  }
}

let botState = loadState();

// Kick Kanal Bilgilerini Çekme Fonksiyonu
async function fetchKickChannel() {
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${config.kickChannel}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!res.ok) {
      console.warn(`[Kick API] İstek başarısız: HTTP ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('[Kick API] Veri çekme hatası:', err.message);
    return null;
  }
}

// Canlı Yayın Bildirimi Oluşturucu
function createLiveEmbed(data) {
  const stream = data.livestream;
  const user = data.user || {};
  const category = stream.categories && stream.categories[0] ? stream.categories[0].name : 'Just Chatting';
  const profilePic = user.profile_pic || 'https://kick.com/favicon.ico';
  const thumbUrl = stream.thumbnail && stream.thumbnail.url ? stream.thumbnail.url : null;
  const startTime = stream.start_time ? Math.floor(new Date(stream.start_time).getTime() / 1000) : Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setColor('#53FC18') // Kick Yeşili
    .setAuthor({
      name: `Gökçe (sunrise53) Canlı Yayında!`,
      iconURL: profilePic,
      url: `https://kick.com/${config.kickChannel}`
    })
    .setTitle(stream.session_title || 'Yeni Canlı Yayın!')
    .setURL(`https://kick.com/${config.kickChannel}`)
    .setDescription(`🎙️ **Gökçe** şu anda Kick'te yayında! Gelip sohbete veya oyuna katılmayı unutmayın.`)
    .addFields(
      { name: '🎮 Kategori / Oyun', value: `\`${category}\``, inline: true },
      { name: '👥 İzleyici', value: `\`${stream.viewer_count || 0}\``, inline: true },
      { name: '⏰ Başlangıç', value: `<t:${startTime}:R>`, inline: true }
    )
    .setFooter({ text: 'sunrise53 Topluluk Bildirimi • Kick.com', iconURL: profilePic })
    .setTimestamp();

  if (thumbUrl) {
    embed.setImage(thumbUrl);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Kick'te Yayına Katıl 🚀")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://kick.com/${config.kickChannel}`)
  );

  return { embed, row };
}

// Periyodik Kick Kontrol Döngüsü
async function checkKickStream() {
  const data = await fetchKickChannel();
  if (!data) return;

  const isLive = Boolean(data.livestream && data.livestream.is_live);
  const currentStreamId = isLive ? data.livestream.id : null;

  // Yeni bir yayın başladıysa
  if (isLive && currentStreamId && currentStreamId !== botState.lastStreamId) {
    console.log(`[Kick] Yayın algılandı! Yayın ID: ${currentStreamId} - "${data.livestream.session_title}"`);
    botState.lastStreamId = currentStreamId;
    saveState(botState);

    // Bildirimin atılacağı kanalları bul
    for (const guild of client.guilds.cache.values()) {
      let channel = null;

      if (process.env.NOTIFICATION_CHANNEL_ID) {
        channel = guild.channels.cache.get(process.env.NOTIFICATION_CHANNEL_ID);
      }

      if (!channel) {
        channel = guild.channels.cache.find(c => c.name.includes('kick-yayın'));
      }

      if (!channel) {
        console.warn(`[Discord] ${guild.name} sunucusunda kick-yayın kanalı bulunamadı.`);
        continue;
      }

      // Bildirim rolünü bul
      const roles = await guild.roles.fetch().catch(() => guild.roles.cache);
      const role = roles.find(r => r.name.includes('Yayın Bildirimi'));
      const mentionText = role ? `<@&${role.id}>` : '@everyone';

      const { embed, row } = createLiveEmbed(data);

      try {
        await channel.send({
          content: `📢 ${mentionText} **Gökçe yayında!** Koşun gelin! 🏃‍♀️💨`,
          embeds: [embed],
          components: [row]
        });
        console.log(`[Discord] ${guild.name} -> #${channel.name} yayını bildirildi.`);
      } catch (err) {
        console.error(`[Discord] Bildirim gönderilirken hata:`, err.message);
      }
    }
  } else if (!isLive && botState.lastStreamId !== null) {
    // Yayın sona erdi
    console.log(`[Kick] Yayın sona erdi. (Eski ID: ${botState.lastStreamId})`);
    botState.lastStreamId = null;
    saveState(botState);
  }
}

// Bot Hazır Olduğunda
client.once('clientReady', () => {
  console.log(`===============================================`);
  console.log(`🚀 ${client.user.tag} başarıyla aktif!`);
  console.log(`📺 Kick Takibi: https://kick.com/${config.kickChannel}`);
  console.log(`⏱️ Kontrol Döngüsü: ${config.checkIntervalSeconds} saniyede bir`);
  console.log(`🧹 Komutsuz sessiz mod; butonlar ve yayın bildirimleri hazır.`);
  console.log(`===============================================`);
  client.user.setPresence({
    status: 'dnd',
    activities: [{ name: 'sunrise53 Kick Yayınını', type: 3 }]
  });

  // İlk kontrol ve periyodik zamanlayıcı
  checkKickStream();
  setInterval(checkKickStream, config.checkIntervalSeconds * 1000);
});

// Buton Tıklamaları (Yayın Bildirimi Rolü Aç/Kapat)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'toggle_stream_role') {
    try {
      const guild = interaction.guild;
      const roles = await guild.roles.fetch().catch(() => guild.roles.cache);
      const role = roles.find(r => r.name.includes('Yayın Bildirimi'));

      if (!role) {
        return interaction.reply({
          content: `❌ 'Yayın Bildirimi' rolü sunucuda bulunamadı!`,
          ephemeral: true
        });
      }

      const member = interaction.member;
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        await interaction.reply({
          content: `🔕 **Yayın Bildirimi** rolün kaldırıldı. Artık yayın pinglemesinden bildirim almayacaksın.`,
          ephemeral: true
        });
      } else {
        await member.roles.add(role);
        await interaction.reply({
          content: `🔔 **Yayın Bildirimi** rolün verildi! Gökçe her yayın açtığında anında haberdar edileceksin. 🌅`,
          ephemeral: true
        });
      }
    } catch (err) {
      console.error('Buton etkileşim hatası:', err);
      if (!interaction.replied) {
        await interaction.reply({
          content: `❌ Rol verilirken bir hata oluştu: ${err.message}`,
          ephemeral: true
        });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
