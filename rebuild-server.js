require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('clientReady', async () => {
  console.log(`[Rebuilder] ${client.user.tag} bağlandı.`);
  const guild = client.guilds.cache.get('1560078794155491398') || client.guilds.cache.first();

  if (!guild) {
    console.error('[Hata] Sunucu bulunamadı!');
    process.exit(1);
  }

  console.log(`[Rebuilder] '${guild.name}' sunucusu temizleniyor ve baştan yapılandırılıyor...`);

  // 1. TÜM KANALLARI SİL
  console.log('1. Mevcut tüm kanallar siliniyor...');
  const channels = await guild.channels.fetch();
  for (const [id, ch] of channels) {
    if (ch) {
      try {
        await ch.delete('Tüm sunucu temizliği ve sıfırdan kurulum');
        console.log(`   - Kanal silindi: ${ch.name}`);
      } catch (e) {
        console.warn(`   ! Kanal silinemedi (${ch.name}):`, e.message);
      }
    }
  }

  // 2. MEVCUT ÖZEL ROLLERİ SİL (@everyone ve bot rolü hariç)
  console.log('2. Mevcut özel roller siliniyor...');
  const roles = await guild.roles.fetch();
  for (const [id, r] of roles) {
    if (!r.managed && r.id !== guild.id) {
      try {
        await r.delete('Sunucu sıfırlama');
        console.log(`   - Rol silindi: ${r.name}`);
      } catch (e) {
        console.warn(`   ! Rol silinemedi (${r.name}):`, e.message);
      }
    }
  }

  // 3. YENİ ROLLERİ OLUŞTUR (SEÇENEK 2)
  console.log('3. Yeni roller hiyerarşik olarak oluşturuluyor...');
  
  // 👑 Ev Sahibi
  const roleEvSahibi = await guild.roles.create({
    name: '👑 Ev Sahibi',
    color: '#FF4757',
    hoist: true,
    mentionable: true,
    permissions: [PermissionsBitField.Flags.Administrator]
  });

  // 🛡️ Nöbetçi
  const roleNobetci = await guild.roles.create({
    name: '🛡️ Nöbetçi',
    color: '#FFA502',
    hoist: true,
    mentionable: true,
    permissions: [
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.KickMembers,
      PermissionsBitField.Flags.BanMembers,
      PermissionsBitField.Flags.ModerateMembers,
      PermissionsBitField.Flags.ViewAuditLog,
      PermissionsBitField.Flags.ManageNicknames,
      PermissionsBitField.Flags.MoveMembers,
      PermissionsBitField.Flags.MuteMembers,
      PermissionsBitField.Flags.DeafenMembers,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.EmbedLinks
    ]
  });

  // ⭐ Kemik Tayfa
  const roleKemikTayfa = await guild.roles.create({
    name: '⭐ Kemik Tayfa',
    color: '#2ED573',
    hoist: true,
    permissions: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.UseExternalEmojis,
      PermissionsBitField.Flags.UseExternalStickers,
      PermissionsBitField.Flags.Connect,
      PermissionsBitField.Flags.Speak
    ]
  });

  // ☕ Destekçi
  const roleDestekci = await guild.roles.create({
    name: '☕ Destekçi',
    color: '#1E90FF',
    hoist: true,
    permissions: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.UseExternalEmojis,
      PermissionsBitField.Flags.UseExternalStickers,
      PermissionsBitField.Flags.Connect,
      PermissionsBitField.Flags.Speak
    ]
  });

  // 🌅 Müdavim
  const roleMudavim = await guild.roles.create({
    name: '🌅 Müdavim',
    color: '#9B59B6',
    hoist: true,
    permissions: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.Connect,
      PermissionsBitField.Flags.Speak
    ]
  });

  // 👥 Ahali
  const roleAhali = await guild.roles.create({
    name: '👥 Ahali',
    color: '#A4B0BE',
    hoist: false,
    permissions: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.Connect,
      PermissionsBitField.Flags.Speak
    ]
  });

  // 🔔 Yayın Bildirimi
  const roleYayinBildirimi = await guild.roles.create({
    name: '🔔 Yayın Bildirimi',
    color: '#5352ED',
    hoist: false,
    mentionable: true
  });

  console.log('   ✓ Tüm roller başarıyla oluşturuldu.');

  // 4. KATEGORİLER VE KANALLARIN İZİNLERLE OLUŞTURULMASI
  console.log('4. Kategoriler ve kanallar izinleriyle oluşturuluyor...');

  // KATEGORİ 1: 📌 BİLGİLENDİRME
  // İzin: @everyone sadece okuyabilir, mesaj yazamaz. Nöbetçi ve Ev Sahibi yazabilir.
  const catBilgi = await guild.channels.create({
    name: '📌 BİLGİLENDİRME',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.id, // @everyone
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        deny: [
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.SendMessagesInThreads,
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.CreatePrivateThreads,
          PermissionsBitField.Flags.AddReactions
        ]
      },
      {
        id: roleNobetci.id,
        allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions]
      },
      {
        id: roleEvSahibi.id,
        allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions]
      }
    ]
  });

  const chWelcome = await guild.channels.create({ name: '🌅・hoş-geldiniz', type: ChannelType.GuildText, parent: catBilgi.id });
  const chRules = await guild.channels.create({ name: '📜・kurallar', type: ChannelType.GuildText, parent: catBilgi.id });
  const chAnnounce = await guild.channels.create({ name: '📢・duyurular', type: ChannelType.GuildText, parent: catBilgi.id });
  const chKick = await guild.channels.create({
    name: '🔴・kick-yayın',
    type: ChannelType.GuildText,
    parent: catBilgi.id,
    topic: 'Gökçe (sunrise53) Kick Canlı Yayın Bildirimleri'
  });
  const chRole = await guild.channels.create({ name: '🎭・rol-al', type: ChannelType.GuildText, parent: catBilgi.id });

  // KATEGORİ 2: 💬 SOHBET MEYDANI
  // İzin: @everyone okuyabilir, mesaj gönderebilir, dosya yükleyebilir
  const catSohbet = await guild.channels.create({
    name: '💬 SOHBET MEYDANI',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AddReactions
        ]
      }
    ]
  });

  await guild.channels.create({ name: '💬・sohbet', type: ChannelType.GuildText, parent: catSohbet.id, topic: 'sunrise53 genel sohbet alanı' });
  await guild.channels.create({ name: '📸・medya-galeri', type: ChannelType.GuildText, parent: catSohbet.id, topic: 'Fotoğraf, setup, evcil hayvan ve anlık paylaşımlar' });
  await guild.channels.create({ name: '🎬・yayın-klipleri', type: ChannelType.GuildText, parent: catSohbet.id, topic: 'Kick yayınından komik ve eğlenceli klipler' });
  await guild.channels.create({ name: '💡・öneri-ve-istek', type: ChannelType.GuildText, parent: catSohbet.id, topic: 'Yayın ve sunucu için fikir ve tavsiyeler' });

  // KATEGORİ 3: 🎮 OYUN & ETKİNLİK
  const catOyun = await guild.channels.create({
    name: '🎮 OYUN & ETKİNLİK',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      }
    ]
  });

  await guild.channels.create({ name: '👻・korku-ve-oyun', type: ChannelType.GuildText, parent: catOyun.id, topic: 'Outlast ve korku/hikaye oyunları sohbeti' });
  await guild.channels.create({ name: '🎮・oyun-lobisi', type: ChannelType.GuildText, parent: catOyun.id, topic: 'Birlikte oynamak için takım arkadaşı arama alanı' });

  // Anketler kanalı: Sadece yetkililer anket açabilir, üyeler oy kullanabilir/tepki verebilir
  await guild.channels.create({
    name: '📊・anketler',
    type: ChannelType.GuildText,
    parent: catOyun.id,
    topic: 'Yayın öncesi oylamalar ve anketler',
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AddReactions],
        deny: [PermissionsBitField.Flags.SendMessages]
      },
      {
        id: roleNobetci.id,
        allow: [PermissionsBitField.Flags.SendMessages]
      },
      {
        id: roleEvSahibi.id,
        allow: [PermissionsBitField.Flags.SendMessages]
      }
    ]
  });

  // KATEGORİ 4: ⭐ DESTEKÇİ ÖZEL (VIP / ABONE ALANI)
  // İzin: @everyone GÖREMEZ! Yalnızca Destekçi, Kemik Tayfa, Nöbetçi, Ev Sahibi görebilir
  const catOzel = await guild.channels.create({
    name: '⭐ DESTEKÇİ ÖZEL',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.id, // @everyone gizli
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: roleDestekci.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
        ]
      },
      {
        id: roleKemikTayfa.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
        ]
      },
      {
        id: roleNobetci.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: roleEvSahibi.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ]
  });

  await guild.channels.create({ name: '☕・özel-sohbet', type: ChannelType.GuildText, parent: catOzel.id, topic: 'Kick aboneleri ve destekçilerine özel lounge alanı' });

  // KATEGORİ 5: 🔊 SES KANALLARI
  const catSes = await guild.channels.create({
    name: '🔊 SES KANALLARI',
    type: ChannelType.GuildCategory
  });

  await guild.channels.create({ name: '☕ Kahve & Sohbet', type: ChannelType.GuildVoice, parent: catSes.id });
  await guild.channels.create({ name: '🎮 Oyun Odası (Duo)', type: ChannelType.GuildVoice, parent: catSes.id, userLimit: 2 });
  await guild.channels.create({ name: '🎮 Oyun Odası (Squad)', type: ChannelType.GuildVoice, parent: catSes.id, userLimit: 5 });
  await guild.channels.create({ name: '🍿 Sinema & İzleme', type: ChannelType.GuildVoice, parent: catSes.id });

  // Yayına Konuk: Üyeler varsayılan olarak susturulmuş bağlanır, yayıncı söz hakkı verir
  await guild.channels.create({
    name: '🎙️ Yayına Konuk',
    type: ChannelType.GuildVoice,
    parent: catSes.id,
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.Speak]
      },
      {
        id: roleNobetci.id,
        allow: [PermissionsBitField.Flags.Speak, PermissionsBitField.Flags.MuteMembers]
      },
      {
        id: roleEvSahibi.id,
        allow: [PermissionsBitField.Flags.Speak, PermissionsBitField.Flags.MuteMembers]
      }
    ]
  });

  // AFK Odası: Susturulmuş
  await guild.channels.create({
    name: '💤 AFK Odası',
    type: ChannelType.GuildVoice,
    parent: catSes.id,
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.Speak]
      }
    ]
  });

  console.log('   ✓ Tüm kanallar ve izinler başarıyla oluşturuldu.');

  // 5. EMBED VE BUTONLARIN GÖNDERİLMESİ
  console.log('5. Karşılama, Kurallar ve Buton paneli gönderiliyor...');

  // Hoş Geldiniz Mesajı
  const welcomeEmbed = new EmbedBuilder()
    .setColor('#FF7E5F')
    .setTitle('🌅 Sunrise 53 Ailesine Hoş Geldiniz!')
    .setDescription(
      `Selamlar! **Gökçe (sunrise53)** resmi Kick topluluk sunucusuna hoş geldiniz.\n\n` +
      `Burada hem canlı yayınları takip edebilir, hem de samimi ve keyifli bir ortamda sohbet edebilirsiniz.\n\n` +
      `📌 **Hızlı Başlangıç:**\n` +
      `• <#${chRules.id}> kanalından sunucu kurallarını okuyun.\n` +
      `• <#${chRole.id}> kanalından yayın bildirimlerini açın.\n` +
      `• <#${chKick.id}> kanalından canlı yayın bildirimlerini takip edin.\n\n` +
      `İyi eğlenceler dileriz! ✨`
    )
    .setImage('https://files.kick.com/images/channel/28131219/banner_image/cfd98d67-f3f6-485a-b604-4f3ff7999f47')
    .setFooter({ text: 'sunrise53 Community • Kick.com/sunrise53' });

  await chWelcome.send({ embeds: [welcomeEmbed] });

  // Kurallar Mesajı
  const rulesEmbed = new EmbedBuilder()
    .setColor('#FFA502')
    .setTitle('📜 Sunucu Kuralları')
    .setDescription(
      `**1. Saygı ve Hoşgörü:** Herkese karşı saygılı, kibar ve hoşgörülü olun.\n\n` +
      `**2. Reklam ve Spam:** Sunucu içi veya üyelere DM yoluyla izinsiz reklam, link veya spam paylaşımı yasaktır.\n\n` +
      `**3. Toksik Davranış & Nefret Söylemi:** Din, dil, ırk, siyaset tartışmaları, hakaret ve taciz edici tavırlar derhal cezalandırılır.\n\n` +
      `**4. Kanal Düzeni:** Lütfen içerikleri ilgili kanallarda paylaşın (örn: klipler <#${guild.channels.cache.find(c => c.name === '🎬・yayın-klipleri')?.id}> kanalına).\n\n` +
      `**5. Yetkili Talimatları:** Nöbetçi ve Ev Sahibi ekibinin uyarılarına lütfen özen gösterin.`
    )
    .setFooter({ text: 'sunrise53 Yönetim Ekibi' });

  await chRules.send({ embeds: [rulesEmbed] });

  // Rol Alma Paneli (Butonlu)
  const roleEmbed = new EmbedBuilder()
    .setColor('#53FC18')
    .setTitle('🔔 Kick Canlı Yayın Bildirimleri')
    .setDescription(
      `Gökçe Kick'te yayına girdiğinde anında bildirim almak ister misin?\n\n` +
      `Aşağıdaki yeşil **"Bildirimleri Aç / Kapat"** butonuna tıklayarak <@&${roleYayinBildirimi.id}> rolünü alabilir veya dilediğin an kapatabilirsin!`
    )
    .setFooter({ text: 'sunrise53 Community' });

  const roleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_stream_role')
      .setLabel('Bildirimleri Aç / Kapat 🔔')
      .setStyle(ButtonStyle.Success)
  );

  await chRole.send({ embeds: [roleEmbed], components: [roleRow] });

  console.log('====================================================');
  console.log('🎉 Sunucu baştan sona tertemiz kuruldu ve yapılandırıldı!');
  console.log('====================================================');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
