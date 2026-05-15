const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const PREFIX_TICKET = "+";
const STAFF_ROLES = ["1491507205902696580", "1491506068579155968", "1491519894066561034", "1489834831431864361", "1489833620708393057"];
const SPECIAL_STAFF = "1491507205902696580";
const LOG_CHANNEL_ID = "1496196313132306472";

client.once('ready', () => {
  console.log(`✅ البوت جاهز وتم إصلاح جميع المشاكل!`);
});

// دالة لتوليد الأزرار
const getButtons = (claimed = false, locked = false) => {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(claimed ? '🔙' : '✅'),
    new ButtonBuilder().setCustomId(locked ? 'unlock_ticket' : 'lock_ticket').setLabel(locked ? 'فتح القفل' : 'قفل').setStyle(locked ? ButtonStyle.Secondary : ButtonStyle.Secondary).setEmoji(locked ? '🔓' : '🔒'),
    new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  );
  return [row];
};

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup-ticket') {
      const embed = new EmbedBuilder().setTitle('الدعم الفني ☄️').setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__يرجى مراجعة قوانين التيكت <#1490688479527440534>__').setColor('#5865F2').setImage('https://i.imgur.com/your-animated-line.gif');
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Secondary));
      await interaction.reply({ content: 'تم الإرسال.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  if (!interaction.isButton()) return;
  if (!interaction.guild) return;

  // منع تعليق الأزرار
  if (interaction.customId === 'open_ticket') {
    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        // الإداريين يشوفون التيكت بس ما يقدرون يتكلمون (SendMessages: false)
        ...STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }))
      ],
    });
    await channel.send({ content: `أهلاً ${interaction.user}، انتظر الدعم. <@&1491507205902696580> <@&1491506068579155968>`, components: getButtons(false, false) });
    return interaction.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
  }

  // أوامر الإدارة بالأزرار
  if (!STAFF_ROLES.some(r => interaction.member.roles.cache.has(r))) return interaction.reply({ content: 'للإدارة فقط.', ephemeral: true });

  if (interaction.customId === 'claim_ticket') {
    await interaction.channel.setTopic(interaction.user.id);
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: true });
    await interaction.update({ components: getButtons(true, false) });
    await interaction.followUp(`✅ تم استلام التيكت بواسطة: ${interaction.user}`);
  }

  if (interaction.customId === 'unclaim_ticket') {
    if (interaction.channel.topic !== interaction.user.id) return interaction.reply({ content: 'لست مستلم التيكت!', ephemeral: true });
    await interaction.channel.setTopic(null);
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: false });
    await interaction.update({ components: getButtons(false, false) });
    await interaction.followUp(`🔙 تم إلغاء الاستلام.`);
  }

  if (interaction.customId === 'lock_ticket') {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
    // منع الكل من الكلام بما فيهم الرتبة الخاصة في حال القفل
    for (const id of STAFF_ROLES) {
        if (id !== interaction.channel.topic) await interaction.channel.permissionOverwrites.edit(id, { SendMessages: false });
    }
    await interaction.update({ components: getButtons(true, true) });
    await interaction.followUp('🔒 تم قفل التيكت.');
  }

  if (interaction.customId === 'confirm_close_request') {
    const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete_ticket').setLabel('تأكيد الإغلاق').setStyle(ButtonStyle.Danger));
    await interaction.reply({ content: '⚠️ هل أنت متأكد؟', components: [confirmRow] });
  }

  if (interaction.customId === 'final_delete_ticket') {
    await interaction.reply('🗑️ جاري الحذف...');
    setTimeout(() => interaction.channel.delete(), 2000);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX_TICKET)) return;
  const args = message.content.slice(PREFIX_TICKET.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  if (!message.channel.name.startsWith('ticket-')) return;
  if (!STAFF_ROLES.some(r => message.member.roles.cache.has(r))) return;

  // أمر Rename
  if (command === 'rename') {
    const newName = args.join('-');
    if (!newName) return message.reply('اكتب الاسم الجديد!');
    await message.channel.setName(`ticket-${newName}`).catch(() => message.reply("تعذر تغيير الاسم (ربما بسبب حدود ديسكورد)"));
    message.reply(`✅ تم تغيير الاسم لـ: ticket-${newName}`);
  }

  // أمر Come
  if (command === 'come') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('منشن الشخص!');
    try {
        await member.send(`🔔 تم استدعاؤك للتذكرة: ${message.channel}\nبواسطة: ${message.author.tag}\n**الرجاء الحضور بسرعة ⚠️**`);
        message.reply(`✅ تم إرسال طلب استدعاء لـ ${member}`);
    } catch (e) { message.reply('❌ تعذر إرسال رسالة خاصة للعضو.'); }
  }

  if (command === 'add') {
    const member = message.mentions.members.first();
    if (member) {
      await message.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true });
      message.reply(`✅ تم إضافة ${member}`);
    }
  }
});

client.login(process.env.TOKEN);
