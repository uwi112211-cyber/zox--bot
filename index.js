const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// --- الإعدادات ---
const PREFIX_TICKET = "+";
const STAFF_ROLES = ["1491507205902696580", "1491506068579155968", "1491519894066561034", "1489834831431864361", "1489833620708393057"];
const MENTION_ROLES = ["1491507205902696580", "1491506068579155968"]; // الرتبتين اللي تبيهم بالمنشن
const LOG_CHANNEL_ID = "1496196313132306472";

client.once('ready', () => { console.log(`✅ البوت جاهز ونظام اللوق مفعل!`); });

// دالة الأزرار
const getButtons = (claimed = false, locked = false) => {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(claimed ? '🔙' : '✅'),
    new ButtonBuilder().setCustomId(locked ? 'unlock_ticket' : 'lock_ticket').setLabel(locked ? 'فتح القفل' : 'قفل').setStyle(ButtonStyle.Secondary).setEmoji(locked ? '🔒' : '🔒'),
    new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  );
  return [row];
};

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup-ticket') {
      const embed = new EmbedBuilder().setTitle('الدعم الفني ☄️').setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__يرجى مراجعة قوانين التيكت <#1490688479527440534>__').setColor('#5865F2');
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Secondary));
      await interaction.reply({ content: 'تم الإرسال.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === 'open_ticket') {
    const channel = await interaction.guild.channels.create({
      name: `تذكرة-${interaction.user.username}`, // تغيير الاسم حسب طلبك
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ...STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }))
      ],
    });

    // منشن الرتبتين
    const mentions = MENTION_ROLES.map(id => `<@&${id}>`).join(' ');
    await channel.send({ 
      content: `أهلاً ${interaction.user}، انتظر الدعم. ${mentions}`, 
      components: getButtons(false, false) 
    });

    // نظام اللوق (Logs) مثل الصورة
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setAuthor({ name: 'Zox Community', iconURL: interaction.guild.iconURL() })
        .setTitle('فتح تيكت')
        .addFields(
          { name: 'المستخدم', value: `${interaction.user} (${interaction.user.id})`, inline: false },
          { name: 'القناة', value: `<#${channel.id}>`, inline: false }
        )
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] });
    }

    return interaction.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
  }

  // --- أزرار الإدارة واللوق للمستلم ---
  if (!STAFF_ROLES.some(r => interaction.member.roles.cache.has(r))) return interaction.reply({ content: 'للإدارة فقط.', ephemeral: true });

  if (interaction.customId === 'claim_ticket') {
    await interaction.channel.setTopic(interaction.user.id);
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: true });
    await interaction.update({ components: getButtons(true, false) });
    
    // إرسال لوق الاستلام
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const claimEmbed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('استلام تيكت')
        .addFields(
          { name: 'المستلم', value: `${interaction.user.tag}`, inline: true },
          { name: 'التيكت', value: `${interaction.channel.name}`, inline: true }
        )
        .setTimestamp();
      logChannel.send({ embeds: [claimEmbed] });
    }
  }

  if (interaction.customId === 'confirm_close_request') {
    const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('تأكيد الإغلاق').setStyle(ButtonStyle.Danger));
    await interaction.reply({ content: '⚠️ هل أنت متأكد؟', components: [confirmRow] });
  }

  if (interaction.customId === 'final_delete') {
    await interaction.reply('🗑️ جاري الحذف...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
  }
});

// --- أوامر البريفكس ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX_TICKET)) return;
  const args = message.content.slice(PREFIX_TICKET.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (!message.channel.name.includes('تذكرة-') && !message.channel.name.includes('ticket-')) return;
  if (!STAFF_ROLES.some(r => message.member.roles.cache.has(r))) return;

  if (command === 'rename') {
    const word = args[0];
    if (!word) return message.reply('❌ اكتب الاسم الجديد!');
    await message.channel.setName(`تذكرة-${word}`).catch(() => {});
    message.reply(`✅ تم تغيير الاسم لـ: **تذكرة-${word}**`);
  }

  if (command === 'close') {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('إغلاق').setStyle(ButtonStyle.Danger));
    message.reply({ content: '⚠️ هل تريد الإغلاق؟', components: [row] });
  }
});

client.login(process.env.TOKEN);
