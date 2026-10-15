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
  ChannelType,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const MASTER_OWNER_ID = '852790966250504193';

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

// Master Panel State (Hafızada kullanıcı seçimlerini tutar)
const masterPanelState = new Map();

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

// Master Panel Görünüm Oluşturucu
function buildMasterPanel(userId, guild) {
  const userState = masterPanelState.get(userId) || { targetUserId: null, selectedRoleId: null, statusNote: null };

  const targetUserText = userState.targetUserId ? `<@${userState.targetUserId}> (\`${userState.targetUserId}\`)` : '*Henüz seçilmedi*';
  const selectedRoleText = userState.selectedRoleId ? `<@&${userState.selectedRoleId}>` : '*Henüz seçilmedi*';

  const embed = new EmbedBuilder()
    .setColor('#FF4757')
    .setAuthor({ name: '👑 Master Yönetim Masası (Sadece Kurucuya Özel)', iconURL: client.user.displayAvatarURL() })
    .setTitle('⚡ Sunucu & Rol Yönetim Merkezi')
    .setDescription(
      `Hoş geldin Sahip! Bu panel üzerinden sunucudaki tüm üyelere dilediğin rolü verebilir, alabilir veya acil durum işlemlerini yürütebilirsin.\n\n` +
      `*(Tüm işlemler gizlidir, sadece sen görebilirsin.)*`
    )
    .addFields(
      { name: '🎯 İşlem Yapılacak Üye', value: targetUserText, inline: true },
      { name: '🏷️ İşlem Yapılacak Rol', value: selectedRoleText, inline: true },
      { name: '📊 Sunucu Durumu', value: `👥 **${guild.memberCount}** Üye | 🏓 **${client.ws.ping}ms** Ping`, inline: false }
    );

  if (userState.statusNote) {
    embed.addFields({ name: '📢 Son İşlem Durumu', value: userState.statusNote, inline: false });
  }

  embed.setFooter({ text: 'sunrise53 Master Security System • ID: ' + userId });

  // 1. Satır: Kullanıcı Seçimi
  const rowUser = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId('panel_user_select')
      .setPlaceholder('👤 İşlem yapılacak üyeyi seçin...')
  );

  // 2. Satır: Rol Seçimi
  const rowRole = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('panel_role_select')
      .setPlaceholder('🏷️ Verilecek veya alınacak rolü seçin...')
  );

  // 3. Satır: Rol Aksiyon Butonları
  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('panel_btn_give_role')
      .setLabel('Rolü Ver ➕')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('panel_btn_take_role')
      .setLabel('Rolü Al ➖')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('panel_btn_self_owner')
      .setLabel('Bana Ev Sahibi Ver 👑')
      .setStyle(ButtonStyle.Primary)
  );

  // 4. Satır: Acil Durum & Kontrol
  const rowTools = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('panel_btn_lock_toggle')
      .setLabel('Kanalı Kilitle/Aç 🔒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel_btn_kick_test')
      .setLabel('Yayın Bildirimi Tetikle ⚡')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel_btn_refresh')
      .setLabel('Yenile 🔄')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, components: [rowUser, rowRole, rowButtons, rowTools] };
}

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
    .setDescription('Tüm kullanılabilir bot komutlarını kategorileriyle listeler.'),

  // 11. 👑 ÖZEL KURUCU YÖNETİM PANELİ (Sadece ID: 852790966250504193)
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('👑 Özel Kurucu & Yönetim Masası (Sadece Sistem Sahibine Özel).'),

  // 12. 👑 HIZLI ROL VER (Sadece ID: 852790966250504193)
  new SlashCommandBuilder()
    .setName('rol-ver')
    .setDescription('👑 Seçilen üyeye anında rol verir (Sadece Sistem Sahibine Özel).')
    .addUserOption(opt =>
      opt.setName('kullanıcı')
        .setDescription('Rol verilecek üye')
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName('rol')
        .setDescription('Verilecek rol')
        .setRequired(true)
    ),

  // 13. 👑 HIZLI ROL AL (Sadece ID: 852790966250504193)
  new SlashCommandBuilder()
    .setName('rol-al')
    .setDescription('👑 Seçilen üyeden rolü alır (Sadece Sistem Sahibine Özel).')
    .addUserOption(opt =>
      opt.setName('kullanıcı')
        .setDescription('Rolü alınacak üye')
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName('rol')
        .setDescription('Alınacak rol')
        .setRequired(true)
    ),

  // 14. 👑 ÖZEL DUYURU (Sadece ID: 852790966250504193)
  new SlashCommandBuilder()
    .setName('özel-duyuru')
    .setDescription('👑 Bot ağzından resmi şık duyuru kartı atar (Sadece Sistem Sahibine Özel).')
    .addStringOption(opt =>
      opt.setName('başlık')
        .setDescription('Duyurunun başlığı')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('mesaj')
        .setDescription('Duyurunun detaylı mesajı')
        .setRequired(true)
    )
    .addChannelOption(opt =>
      opt.setName('kanal')
        .setDescription('Duyurunun gönderileceği kanal (Varsayılan: #duyurular)')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('herkese_ping')
        .setDescription('@everyone etiketlensin mi? (Varsayılan: Evet)')
        .setRequired(false)
    )
];

// Bot Hazır Olduğunda
client.once('clientReady', async () => {
  console.log(`===============================================`);
  console.log(`🚀 ${client.user.tag} başarıyla aktif!`);
  console.log(`👑 Kurucu ID: ${MASTER_OWNER_ID}`);
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

// Etkileşimler (Slash Komutları, Menüler ve Butonlar)
client.on('interactionCreate', async (interaction) => {
  // 1. KULLANICI SEÇİM MENÜSÜ (Master Panel)
  if (interaction.isUserSelectMenu()) {
    if (interaction.customId === 'panel_user_select') {
      if (interaction.user.id !== MASTER_OWNER_ID) {
        return interaction.reply({ content: '⛔ Bu panele sadece Sistem Sahibi erişebilir!', ephemeral: true });
      }

      const selectedUserId = interaction.values[0];
      const cur = masterPanelState.get(interaction.user.id) || {};
      cur.targetUserId = selectedUserId;
      cur.statusNote = `✅ Hedef üye <@${selectedUserId}> olarak seçildi.`;
      masterPanelState.set(interaction.user.id, cur);

      const panel = buildMasterPanel(interaction.user.id, interaction.guild);
      return interaction.update({ embeds: [panel.embed], components: panel.components });
    }
  }

  // 2. ROL SEÇİM MENÜSÜ (Master Panel)
  if (interaction.isRoleSelectMenu()) {
    if (interaction.customId === 'panel_role_select') {
      if (interaction.user.id !== MASTER_OWNER_ID) {
        return interaction.reply({ content: '⛔ Bu panele sadece Sistem Sahibi erişebilir!', ephemeral: true });
      }

      const selectedRoleId = interaction.values[0];
      const cur = masterPanelState.get(interaction.user.id) || {};
      cur.selectedRoleId = selectedRoleId;
      cur.statusNote = `✅ Hedef rol <@&${selectedRoleId}> olarak seçildi.`;
      masterPanelState.set(interaction.user.id, cur);

      const panel = buildMasterPanel(interaction.user.id, interaction.guild);
      return interaction.update({ embeds: [panel.embed], components: panel.components });
    }
  }

  // 3. BUTON ETKİLEŞİMLERİ
  if (interaction.isButton()) {
    // 3.A: Master Panel Butonları
    if (interaction.customId.startsWith('panel_btn_')) {
      if (interaction.user.id !== MASTER_OWNER_ID) {
        return interaction.reply({ content: '⛔ Bu butonu sadece Sistem Sahibi kullanabilir!', ephemeral: true });
      }

      const cur = masterPanelState.get(interaction.user.id) || {};

      // Yenile
      if (interaction.customId === 'panel_btn_refresh') {
        cur.statusNote = '🔄 Panel verileri tazelendi.';
        masterPanelState.set(interaction.user.id, cur);
        const panel = buildMasterPanel(interaction.user.id, interaction.guild);
        return interaction.update({ embeds: [panel.embed], components: panel.components });
      }

      // Kendime Ev Sahibi Ver
      if (interaction.customId === 'panel_btn_self_owner') {
        try {
          const roles = await interaction.guild.roles.fetch();
          const ownerRole = roles.find(r => r.name.includes('Ev Sahibi'));
          if (!ownerRole) {
            cur.statusNote = '❌ Sunucuda "Ev Sahibi" rolü bulunamadı!';
          } else {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            await member.roles.add(ownerRole);
            cur.statusNote = `👑 Tebrikler! Sana <@&${ownerRole.id}> rolü başarıyla verildi!`;
          }
        } catch (err) {
          cur.statusNote = `❌ Rol verilemedi: ${err.message}`;
        }
        masterPanelState.set(interaction.user.id, cur);
        const panel = buildMasterPanel(interaction.user.id, interaction.guild);
        return interaction.update({ embeds: [panel.embed], components: panel.components });
      }

      // Rol Ver
      if (interaction.customId === 'panel_btn_give_role') {
        if (!cur.targetUserId || !cur.selectedRoleId) {
          cur.statusNote = '⚠️ Lütfen önce yukarıdaki menülerden hem bir üye hem de bir rol seçin!';
        } else {
          try {
            const member = await interaction.guild.members.fetch(cur.targetUserId);
            const role = await interaction.guild.roles.fetch(cur.selectedRoleId);
            if (!member || !role) {
              cur.statusNote = '❌ Belirtilen üye veya rol bulunamadı.';
            } else {
              await member.roles.add(role);
              cur.statusNote = `✨ Başarılı: <@${member.id}> kullanıcısına <@&${role.id}> rolü verildi!`;
            }
          } catch (err) {
            cur.statusNote = `❌ Rol ekleme hatası: ${err.message}`;
          }
        }
        masterPanelState.set(interaction.user.id, cur);
        const panel = buildMasterPanel(interaction.user.id, interaction.guild);
        return interaction.update({ embeds: [panel.embed], components: panel.components });
      }

      // Rol Al
      if (interaction.customId === 'panel_btn_take_role') {
        if (!cur.targetUserId || !cur.selectedRoleId) {
          cur.statusNote = '⚠️ Lütfen önce yukarıdaki menülerden hem bir üye hem de bir rol seçin!';
        } else {
          try {
            const member = await interaction.guild.members.fetch(cur.targetUserId);
            const role = await interaction.guild.roles.fetch(cur.selectedRoleId);
            if (!member || !role) {
              cur.statusNote = '❌ Belirtilen üye veya rol bulunamadı.';
            } else {
              await member.roles.remove(role);
              cur.statusNote = `🗑️ Başarılı: <@${member.id}> kullanıcısından <@&${role.id}> rolü alındı!`;
            }
          } catch (err) {
            cur.statusNote = `❌ Rol alma hatası: ${err.message}`;
          }
        }
        masterPanelState.set(interaction.user.id, cur);
        const panel = buildMasterPanel(interaction.user.id, interaction.guild);
        return interaction.update({ embeds: [panel.embed], components: panel.components });
      }

      // Kanalı Kilitle / Aç
      if (interaction.customId === 'panel_btn_lock_toggle') {
        try {
          const ch = interaction.channel;
          const currentOverwrites = ch.permissionOverwrites.cache.get(interaction.guild.id);
          const isLocked = currentOverwrites && currentOverwrites.deny.has(PermissionsBitField.Flags.SendMessages);

          if (isLocked) {
            await ch.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });
            cur.statusNote = `🔓 <#${ch.id}> kanalının kilidi açıldı (Üyeler yazabilir).`;
          } else {
            await ch.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
            cur.statusNote = `🔒 <#${ch.id}> kanalı kilitlendi (@everyone yazamaz).`;
          }
        } catch (err) {
          cur.statusNote = `❌ Kanal kilitlenirken hata: ${err.message}`;
        }
        masterPanelState.set(interaction.user.id, cur);
        const panel = buildMasterPanel(interaction.user.id, interaction.guild);
        return interaction.update({ embeds: [panel.embed], components: panel.components });
      }

      // Yayın Bildirimini Manuel Tetikle
      if (interaction.customId === 'panel_btn_kick_test') {
        try {
          await checkKickStream();
          cur.statusNote = '⚡ Kick yayın kontrol döngüsü manuel olarak tetiklendi!';
        } catch (err) {
          cur.statusNote = `❌ Yayın kontrol hatası: ${err.message}`;
        }
        masterPanelState.set(interaction.user.id, cur);
        const panel = buildMasterPanel(interaction.user.id, interaction.guild);
        return interaction.update({ embeds: [panel.embed], components: panel.components });
      }
    }

    // 3.B: Genel Kullanıcı Butonları (Yayın Bildirimi Rolü Aç/Kapat)
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

  // 4. SLASH KOMUTLARI
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // 👑 MASTER KOMUT: /panel
  if (commandName === 'panel') {
    if (interaction.user.id !== MASTER_OWNER_ID) {
      return interaction.reply({
        content: '⛔ **Erişim Reddedildi:** Bu özel yönetim masası yalnızca Sistem Sahibine (`852790966250504193`) tahsis edilmiştir.',
        ephemeral: true
      });
    }

    const panel = buildMasterPanel(interaction.user.id, interaction.guild);
    return interaction.reply({ embeds: [panel.embed], components: panel.components, ephemeral: true });
  }

  // 👑 MASTER KOMUT: /rol-ver
  if (commandName === 'rol-ver') {
    if (interaction.user.id !== MASTER_OWNER_ID) {
      return interaction.reply({ content: '⛔ Bu komutu sadece Sistem Sahibi kullanabilir!', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('kullanıcı');
    const targetRole = interaction.options.getRole('rol');

    try {
      const member = await interaction.guild.members.fetch(targetUser.id);
      await member.roles.add(targetRole.id);
      return interaction.reply({
        content: `✅ Başarılı: <@${targetUser.id}> kullanıcısına <@&${targetRole.id}> rolü verildi!`,
        ephemeral: true
      });
    } catch (err) {
      return interaction.reply({
        content: `❌ Rol verilirken hata oluştu: ${err.message}`,
        ephemeral: true
      });
    }
  }

  // 👑 MASTER KOMUT: /rol-al
  if (commandName === 'rol-al') {
    if (interaction.user.id !== MASTER_OWNER_ID) {
      return interaction.reply({ content: '⛔ Bu komutu sadece Sistem Sahibi kullanabilir!', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('kullanıcı');
    const targetRole = interaction.options.getRole('rol');

    try {
      const member = await interaction.guild.members.fetch(targetUser.id);
      await member.roles.remove(targetRole.id);
      return interaction.reply({
        content: `🗑️ Başarılı: <@${targetUser.id}> kullanıcısından <@&${targetRole.id}> rolü alındı!`,
        ephemeral: true
      });
    } catch (err) {
      return interaction.reply({
        content: `❌ Rol alınırken hata oluştu: ${err.message}`,
        ephemeral: true
      });
    }
  }

  // 👑 MASTER KOMUT: /özel-duyuru
  if (commandName === 'özel-duyuru') {
    if (interaction.user.id !== MASTER_OWNER_ID) {
      return interaction.reply({ content: '⛔ Bu komutu sadece Sistem Sahibi kullanabilir!', ephemeral: true });
    }

    const baslik = interaction.options.getString('başlık');
    const mesaj = interaction.options.getString('mesaj');
    const targetChannel = interaction.options.getChannel('kanal') || interaction.guild.channels.cache.find(c => c.name.includes('duyurular')) || interaction.channel;
    const mentionEveryone = interaction.options.getBoolean('herkese_ping') ?? true;

    const embed = new EmbedBuilder()
      .setColor('#FF4757')
      .setAuthor({ name: '📢 Resmi Topluluk Duyurusu', iconURL: interaction.guild.iconURL() })
      .setTitle(baslik)
      .setDescription(mesaj)
      .setFooter({ text: 'sunrise53 Yönetim Masası' })
      .setTimestamp();

    try {
      await targetChannel.send({
        content: mentionEveryone ? '@everyone' : undefined,
        embeds: [embed]
      });
      return interaction.reply({ content: `✅ Duyuru başarıyla <#${targetChannel.id}> kanalına gönderildi!`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `❌ Duyuru gönderilirken hata: ${err.message}`, ephemeral: true });
    }
  }

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
    const isOwner = interaction.user.id === MASTER_OWNER_ID;

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
      );

    // Eğer komutu yazan kurucu (MASTER_OWNER_ID) ise özel kurucu bölümü eklenir
    if (isOwner) {
      embed.addFields({
        name: '👑 Kurucu Özel Masası (Sadece Sen Görebilirsin)',
        value:
          '• `/panel` ➔ Etkileşimli master kontrol masasını açar (Üye & Rol seçme, kilitleme, acil durum).\n' +
          '• `/rol-ver` ➔ İstediğin üyeye anında tek tıkla rol tanımlar.\n' +
          '• `/rol-al` ➔ İstediğin üyeden tek tıkla rol alır.\n' +
          '• `/özel-duyuru` ➔ Bot kimliğiyle dilediğin kanala resmi duyuru geçer.'
      });
    }

    embed.setFooter({ text: 'sunrise53 Topluluk Asistanı • Kick.com/sunrise53' });

    return interaction.reply({ embeds: [embed], ephemeral: isOwner });
  }
});

client.login(process.env.DISCORD_TOKEN);
