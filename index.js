require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType
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

// Kick Kanal Bilgilerini Çekme
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

  if (isLive && currentStreamId && currentStreamId !== botState.lastStreamId) {
    console.log(`[Kick] Yayın algılandı! Yayın ID: ${currentStreamId} - "${data.livestream.session_title}"`);
    botState.lastStreamId = currentStreamId;
    saveState(botState);

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
    console.log(`[Kick] Yayın sona erdi. (Eski ID: ${botState.lastStreamId})`);
    botState.lastStreamId = null;
    saveState(botState);
  }
}

// "O mu Bu mu" İkilem Veri Havuzu
const OMUBUMU_HAVUZU = [
  { a: "Outlast'ı gece tek başına oynamak", b: "Arkadaşlarla Phasmophobia oynamak" },
  { a: "Sabaha kadar Just Chatting sohbeti", b: "Hikayeli oyun maratonu" },
  { a: "Sonsuza kadar sadece çay içmek", b: "Sonsuza kadar sadece kahve içmek" },
  { a: "Korku oyununda jumpscare yemek", b: "Oyunun en zor yerinde save alamadan ölmek" },
  { a: "Discord seslisinde sabahlamak", b: "Yayın tekrarı izleyip uyumak" },
  { a: "Rize yaylalarında kamp yapmak", b: "Ege kıyılarında tatil yapmak" },
  { a: "Mikrofonun yayında açık unutulması", b: "Oyun sesinin yayına gitmemesi" },
  { a: "Bütün yayın boyu chatteki trollemelere katlanmak", b: "Oyunda bir bölümü 50 kere tekrar oynamak" }
];

// Slash Komut Listesi
const slashCommands = [
  // 1. YAYIN
  new SlashCommandBuilder()
    .setName('yayın')
    .setDescription('Gökçe\'nin (sunrise53) anlık Kick yayın durumunu gösterir.'),

  // 2. SOSYAL
  new SlashCommandBuilder()
    .setName('sosyal')
    .setDescription('Gökçe\'nin tüm resmi sosyal medya hesaplarını listeler.'),

  // 3. OYUN ÖNER
  new SlashCommandBuilder()
    .setName('oyun-öner')
    .setDescription('Gökçe\'ye yayınlarda oynaması için bir oyun önerisinde bulun.')
    .addStringOption(opt =>
      opt.setName('oyun_adı')
        .setDescription('Önermek istediğin oyunun adı')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('neden')
        .setDescription('Gökçe bu oyunu neden oynamalı? (İsteğe bağlı)')
        .setRequired(false)
    ),

  // 4. O MU BU MU
  new SlashCommandBuilder()
    .setName('omubumu')
    .setDescription('Gökçe\'nin "O mu Bu mu" konseptine özel eğlenceli bir ikilem sunar.'),

  // 5. ZAR
  new SlashCommandBuilder()
    .setName('zar')
    .setDescription('Zar atar (1-6 arası veya özel yüzey).')
    .addIntegerOption(opt =>
      opt.setName('yüzey')
        .setDescription('Zarın maksimum sayısı (Varsayılan: 6)')
        .setMinValue(2)
        .setMaxValue(100)
        .setRequired(false)
    ),

  // 6. YAZI TURA
  new SlashCommandBuilder()
    .setName('yazı-tura')
    .setDescription('Yazı mı tura mı? Şansını dene!'),

  // 7. TEMİZLE (Moderatör)
  new SlashCommandBuilder()
    .setName('temizle')
    .setDescription('Kanaldaki mesajları topluca siler (Yetkili komutu).')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addIntegerOption(opt =>
      opt.setName('miktar')
        .setDescription('Silinecek mesaj sayısı (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  // 8. YAVAŞ MOD (Moderatör)
  new SlashCommandBuilder()
    .setName('yavaş-mod')
    .setDescription('Kanalın yavaş mod süresini ayarlar (Yetkili komutu).')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addIntegerOption(opt =>
      opt.setName('saniye')
        .setDescription('Mesaj aralığı saniyesi (0 yazarak kapatabilirsiniz)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    ),

  // 9. YAYIN DUYURU (Moderatör)
  new SlashCommandBuilder()
    .setName('yayın-duyuru')
    .setDescription('Duyurular kanalına özel yayın öncesi teaser duyurusu atar (Yetkili komutu).')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addStringOption(opt =>
      opt.setName('mesaj')
        .setDescription('Duyurulacak özel mesaj veya yayın konusu')
        .setRequired(true)
    ),

  // 10. YARDIM
  new SlashCommandBuilder()
    .setName('yardım')
    .setDescription('Tüm kullanılabilir bot komutlarını kategorileriyle listeler.')
];

// Bot Hazır Olduğunda
client.once('clientReady', async () => {
  console.log(`===============================================`);
  console.log(`🚀 ${client.user.tag} başarıyla aktif!`);
  console.log(`📺 Kick Takibi: https://kick.com/${config.kickChannel}`);
  console.log(`⏱️ Kontrol Döngüsü: ${config.checkIntervalSeconds} saniyede bir`);
  console.log(`===============================================`);

  // Rahatsız Etmeyin (dnd) Durumu
  client.user.setPresence({
    status: 'dnd',
    activities: [{ name: 'sunrise53 Kick Yayınını', type: 3 }] // Watching
  });

  // Slash Komutlarını Kaydet (Tüm sunuculara anında tanımlanır)
  try {
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set(slashCommands);
      console.log(`[Komutlar] '${guild.name}' sunucusuna ${slashCommands.length} slash komutu yüklendi.`);
    }
  } catch (err) {
    console.error('[Komutlar] Slash komutları yüklenirken hata:', err.message);
  }

  // İlk kontrol ve periyodik zamanlayıcı
  checkKickStream();
  setInterval(checkKickStream, config.checkIntervalSeconds * 1000);
});

// Etkileşimler (Slash Komutları ve Butonlar)
client.on('interactionCreate', async (interaction) => {
  // 1. BUTON ETKİLEŞİMLERİ
  if (interaction.isButton()) {
    // Yayın Bildirimi Rolü Aç/Kapat
    if (interaction.customId === 'toggle_stream_role') {
      try {
        const guild = interaction.guild;
        const roles = await guild.roles.fetch().catch(() => guild.roles.cache);
        const role = roles.find(r => r.name.includes('Yayın Bildirimi'));

        if (!role) {
          return interaction.reply({ content: `❌ 'Yayın Bildirimi' rolü sunucuda bulunamadı!`, ephemeral: true });
        }

        const member = interaction.member;
        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          return interaction.reply({
            content: `🔕 **Yayın Bildirimi** rolün kaldırıldı. Artık yayın etiketlerinden bildirim almayacaksın.`,
            ephemeral: true
          });
        } else {
          await member.roles.add(role);
          return interaction.reply({
            content: `🔔 **Yayın Bildirimi** rolün verildi! Gökçe her yayın açtığında anında haberdar edileceksin. 🌅`,
            ephemeral: true
          });
        }
      } catch (err) {
        return interaction.reply({ content: `❌ Hata oluştu: ${err.message}`, ephemeral: true });
      }
    }

    // Oyun Önerisi Oylama Butonları
    if (interaction.customId.startsWith('vote_up_') || interaction.customId.startsWith('vote_down_')) {
      return interaction.reply({
        content: `🗳️ Oyun önerisine oyun başarıyla kaydedildi!`,
        ephemeral: true
      });
    }

    // O mu Bu mu Oylama Butonları
    if (interaction.customId.startsWith('omb_')) {
      const secim = interaction.customId.endsWith('a') ? 'A Seçeneği' : 'B Seçeneği';
      return interaction.reply({
        content: `🎯 **${secim}** için oy verdin! Bakalım chat ne diyecek?`,
        ephemeral: true
      });
    }
  }

  // 2. SLASH KOMUTLARI
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // KOMUT: /yayın
  if (commandName === 'yayın') {
    await interaction.deferReply();
    const data = await fetchKickChannel();
    if (!data) return interaction.editReply('❌ Kick verisi alınamadı, lütfen birazdan tekrar dene.');

    if (data.livestream && data.livestream.is_live) {
      const { embed, row } = createLiveEmbed(data);
      return interaction.editReply({ content: '🟢 **Gökçe şu an canlı yayında!**', embeds: [embed], components: [row] });
    } else {
      const offlineEmbed = new EmbedBuilder()
        .setColor('#FFA502')
        .setTitle('💤 Gökçe Şu Anda Yayında Değil')
        .setDescription(`Yayın açıldığında <#${interaction.guild.channels.cache.find(c => c.name.includes('kick-yayın'))?.id || 'kick-yayın'}> kanalından bildirim alacaksın!\n\n🔗 Kanalı takip etmeyi unutma: [kick.com/${config.kickChannel}](https://kick.com/${config.kickChannel})`)
        .setFooter({ text: 'sunrise53 Topluluğu' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Kick Kanalına Git 📺")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://kick.com/${config.kickChannel}`)
      );

      return interaction.editReply({ embeds: [offlineEmbed], components: [row] });
    }
  }

  // KOMUT: /sosyal
  if (commandName === 'sosyal') {
    const embed = new EmbedBuilder()
      .setColor('#FF7E5F')
      .setTitle('🌟 Gökçe (sunrise53) Resmi Sosyal Medya Hesapları')
      .setDescription('Yayınları ve güncel paylaşımları kaçırmamak için aşağıdaki resmi hesapları takip edebilirsin!')
      .addFields(
        { name: '🟢 Kick', value: '[kick.com/sunrise53](https://kick.com/sunrise53)', inline: true },
        { name: '📸 Instagram', value: '[@gokcecelikofficial](https://instagram.com/gokcecelikofficial)', inline: true },
        { name: '🐦 X (Twitter)', value: '[@gokceceelikk](https://twitter.com/gokceceelikk)', inline: true }
      )
      .setFooter({ text: 'sunrise53 Community' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Kick').setStyle(ButtonStyle.Link).setURL(`https://kick.com/${config.kickChannel}`),
      new ButtonBuilder().setLabel('Instagram').setStyle(ButtonStyle.Link).setURL('https://instagram.com/gokcecelikofficial'),
      new ButtonBuilder().setLabel('X / Twitter').setStyle(ButtonStyle.Link).setURL('https://twitter.com/gokceceelikk')
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // KOMUT: /oyun-öner
  if (commandName === 'oyun-öner') {
    const oyun = interaction.options.getString('oyun_adı');
    const neden = interaction.options.getString('neden') || 'Özel bir neden belirtilmedi.';

    const targetChannel = interaction.guild.channels.cache.find(c => c.name.includes('öneri-ve-istek')) || interaction.channel;

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setAuthor({ name: `${interaction.user.username} Bir Oyun Önerdi!`, iconURL: interaction.user.displayAvatarURL() })
      .setTitle(`🎮 Önerilen Oyun: ${oyun}`)
      .setDescription(`**Neden Oynanmalı?**\n${neden}`)
      .setFooter({ text: 'Topluluk Oyun Önerisi • Oy vermek için butonları kullanın' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`vote_up_${Date.now()}`).setLabel('Oynasın! 👍').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`vote_down_${Date.now()}`).setLabel('Gerek Yok 👎').setStyle(ButtonStyle.Secondary)
    );

    await targetChannel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: `✅ Oyun önerin başarıyla <#${targetChannel.id}> kanalına iletildi!`, ephemeral: true });
  }

  // KOMUT: /omubumu
  if (commandName === 'omubumu') {
    const rastgele = OMUBUMU_HAVUZU[Math.floor(Math.random() * OMUBUMU_HAVUZU.length)];

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🤔 O MU BU MU?')
      .setDescription(`Hangisini tercih ederdin?\n\n🅰️ **${rastgele.a}**\n\n**VS**\n\n🅱️ **${rastgele.b}**`)
      .setFooter({ text: 'sunrise53 İkilem Masası • Tercihini butonla yap!' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`omb_${Date.now()}_a`).setLabel('🅰️ Bu!').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`omb_${Date.now()}_b`).setLabel('🅱️ Şu!').setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // KOMUT: /zar
  if (commandName === 'zar') {
    const max = interaction.options.getInteger('yüzey') || 6;
    const sonuc = Math.floor(Math.random() * max) + 1;

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🎲 Zar Atıldı!')
      .setDescription(`🎲 ${interaction.user} **(1-${max})** zar attı:\n\n# 🎯 **${sonuc}**`)
      .setFooter({ text: 'sunrise53 Şans Masası' });

    return interaction.reply({ embeds: [embed] });
  }

  // KOMUT: /yazı-tura
  if (commandName === 'yazı-tura') {
    const sonuc = Math.random() < 0.5 ? 'YAZI 🪙' : 'TURA 🦅';

    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('🪙 Yazı-Tura Atıldı!')
      .setDescription(`${interaction.user} madeni parayı havaya fırlattı...\n\n# 🌟 **${sonuc}**`)
      .setFooter({ text: 'sunrise53 Şans Masası' });

    return interaction.reply({ embeds: [embed] });
  }

  // KOMUT: /temizle (Moderatör)
  if (commandName === 'temizle') {
    const miktar = interaction.options.getInteger('miktar');

    try {
      const deleted = await interaction.channel.bulkDelete(miktar, true);
      return interaction.reply({
        content: `🧹 Başarıyla **${deleted.size}** adet mesaj temizlendi!`,
        ephemeral: true
      });
    } catch (err) {
      return interaction.reply({
        content: `❌ Mesajlar silinirken hata: ${err.message} (Not: 14 günden eski mesajlar toplu silinemez)`,
        ephemeral: true
      });
    }
  }

  // KOMUT: /yavaş-mod (Moderatör)
  if (commandName === 'yavaş-mod') {
    const saniye = interaction.options.getInteger('saniye');

    try {
      await interaction.channel.setRateLimitPerUser(saniye);
      if (saniye === 0) {
        return interaction.reply({ content: `🚀 Bu kanalda yavaş mod **kapatıldı**!`, ephemeral: true });
      } else {
        return interaction.reply({ content: `⏱️ Bu kanal için yavaş mod **${saniye} saniye** olarak ayarlandı!`, ephemeral: true });
      }
    } catch (err) {
      return interaction.reply({ content: `❌ Yavaş mod ayarlanırken hata: ${err.message}`, ephemeral: true });
    }
  }

  // KOMUT: /yayın-duyuru (Moderatör)
  if (commandName === 'yayın-duyuru') {
    const mesaj = interaction.options.getString('mesaj');
    const duyuruChannel = interaction.guild.channels.cache.find(c => c.name.includes('duyurular')) || interaction.channel;

    const embed = new EmbedBuilder()
      .setColor('#FF4757')
      .setAuthor({ name: '📢 Gökçe (sunrise53) Özel Yayın Duyurusu' })
      .setTitle('✨ Yayın Hazırlığı Başladı!')
      .setDescription(`${mesaj}\n\n👉 **Kick Kanalı:** [kick.com/${config.kickChannel}](https://kick.com/${config.kickChannel})`)
      .setFooter({ text: 'sunrise53 Resmi Duyuru' })
      .setTimestamp();

    await duyuruChannel.send({ content: '@everyone', embeds: [embed] });
    return interaction.reply({ content: `✅ Duyuru başarıyla <#${duyuruChannel.id}> kanalına gönderildi!`, ephemeral: true });
  }

  // KOMUT: /yardım
  if (commandName === 'yardım') {
    const embed = new EmbedBuilder()
      .setColor('#FF7E5F')
      .setTitle('🌅 sunrise53 Bot Komut Rehberi')
      .setDescription('Sunucuda kullanabileceğiniz tüm modern **Eğik Çizgi (`/`)** komutları aşağıda listelenmiştir:')
      .addFields(
        {
          name: '📺 Yayın & Sosyal Medya',
          value:
            '• `/yayın` ➔ Gökçe\'nin anlık Kick yayın durumunu ve izleyici sayısını gösterir.\n' +
            '• `/sosyal` ➔ Kick, Instagram ve Twitter/X hesaplarını butonlarla listeler.\n' +
            '• `/oyun-öner` ➔ Gökçe\'ye yayın için oyun önerir ve oylamaya sunar.'
        },
        {
          name: '🎲 Eğlence & Konsept',
          value:
            '• `/omubumu` ➔ Gökçe\'nin "O mu Bu mu" konseptine özel ikilemler sunar.\n' +
            '• `/zar` ➔ 1-6 veya dilediğiniz sayıda zar atar.\n' +
            '• `/yazı-tura` ➔ Yazı mı tura mı şansınızı dener.'
        },
        {
          name: '🛡️ Moderasyon (Yetkililer İçin)',
          value:
            '• `/temizle [miktar]` ➔ Kanaldaki 1-100 arası mesajı süpürür.\n' +
            '• `/yavaş-mod [saniye]` ➔ Kanalın mesaj yazma aralığını ayarlar.\n' +
            '• `/yayın-duyuru [mesaj]` ➔ Duyurular kanalına anons geçer.'
        }
      )
      .setFooter({ text: 'sunrise53 Topluluk Asistanı • Kick.com/sunrise53' });

    return interaction.reply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
