const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// --- الإعدادات (تأكد من الأيدي الصحيح) ---
const PREFIX_TICKET = "+";
const STAFF_ROLES = ["1491507205902696580", "1491506068579155968", "1491519894066561034", "1489834831431864361", "1489833620708393057"];
const LOG_CHANNEL_ID = "1496196313132306472";
const SPECIAL_STAFF = "1491507205902696580";

// تسجيل أوامر السلاش
const commands = [
  { name: 'setup-ticket', description: 'إنشاء لوحة التيكت' },
  { name: 'ping', description: 'سرعة استجابة البوت' }
];

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ البوت جاهز وشغال!`);
  } catch (error) { console.error(error); }
});

// دالة الأزرار الذكية
const getButtons = (claimed = false, locked = false) => {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(claimed ? '🔙' : '✅'),
    new ButtonBuilder().setCustomId(locked ? 'unlock_ticket' : 'lock_ticket').setLabel(locked ? 'فتح القفل' : 'قفل').setStyle(locked ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(locked ? '🔓' : '🔒'),
    new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  );
  return [row];
};

// --- التعامل مع التفاعلات (أوامر سلاش وأزرار) ---
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ping') await interaction.reply(`🏓 بونق: ${client.ws.ping}ms`);

    if (interaction.commandName === 'setup-ticket') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: 'للمدراء فقط.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle('الدعم الفني ☄️')
        .setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__يرجى مراجعة قوانين التيكت <#1490688479527440534>__')
        .setColor('#5865F2')
        .setImage('https://i.imgur.com/your-animated-line.gif'); // حط رابط صورتك هنا
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Secondary));
      await interaction.reply({ content: 'تم الإرسال.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  if (!interaction.isButton()) return;

  // فتح تيكت جديد
  if (interaction.customId === 'open_ticket') {
    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ...STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }))
      ],
    });
    await channel.send({ content: `أهلاً ${interaction.user}، انتظر الدعم. <@&1491507205902696580> <@&1491506068579155968>`, components: getButtons(false, false) });
    return interaction.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
  }

  // أوامر أزرار الإدارة
  if (!STAFF_ROLES.some(r => interaction.member.roles.cache.has(r))) return interaction.reply({ content: 'للإدارة فقط.', ephemeral: true });

  const claimed = interaction.message.components[0].components[0].customId === 'unclaim_ticket';
  const locked = interaction.message.components[0].components[1].customId === 'unlock_ticket';

  if (interaction.customId === 'claim_ticket') {
    if (claimed) return interaction.reply({ content: 'التيكت مستلم بالفعل!', ephemeral: true });
    await interaction.channel.setTopic(interaction.user.id);
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: true });
    await interaction.update({ components: getButtons(true, locked) });
    await interaction.followUp(`✅ تم استلام التيكت بواسطة: ${interaction.user}`);
  }

  if (interaction.customId === 'unclaim_ticket') {
    if (interaction.channel.topic !== interaction.user.id) return interaction.reply({ content: 'أنت لست المستلم!', ephemeral: true });
    await interaction.channel.setTopic(null);
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: false });
    await interaction.update({ components: getButtons(false, locked) });
    await interaction.followUp(`🔙 تم إلغاء الاستلام.`);
  }

  if (interaction.customId === 'lock_ticket') {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
    STAFF_ROLES.forEach(async id => {
        if (id !== interaction.channel.topic) await interaction.channel.permissionOverwrites.edit(id, { SendMessages: false });
    });
    await interaction.update({ components: getButtons(claimed, true) });
    await interaction.followUp('🔒 تم قفل التيكت. الكلام للمستلم وصاحب الطلب فقط.');
  }

  if (interaction.customId === 'unlock_ticket') {
    STAFF_ROLES.forEach(async id => {
        await interaction.channel.permissionOverwrites.edit(id, { SendMessages: true });
    });
    await interaction.update({ components: getButtons(claimed, false) });
    await interaction.followUp('🔓 تم فتح القفل، يمكن للإدارة التحدث.');
  }

  if (interaction.customId === 'confirm_close_request') {
    const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('تأكيد الإغلاق').setStyle(ButtonStyle.Danger));
    await interaction.reply({ content: '⚠️ هل أنت متأكد من إغلاق التيكت؟', components: [confirmRow] });
  }

  if (interaction.customId === 'final_delete') {
    await interaction.reply('🗑️ جاري المسح...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
  }
});

// --- أوامر البريفكس (+) ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX_TICKET)) return;
  const args = message.content.slice(PREFIX_TICKET.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (!message.channel.name.startsWith('ticket-')) return;
  if (!STAFF_ROLES.some(r => message.member.roles.cache.has(r))) return;

  if (command === 'rename') {
    const newName = args.join('-');
    if (!newName) return message.reply('❌ اكتب الاسم الجديد!');
    await message.channel.setName(`ticket-${newName}`).catch(() => {});
    message.reply(`✅ تم تغيير الاسم إلى: **ticket-${newName}**`);
  }

  if (command === 'come') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ منشن الشخص!');
    member.send(`🔔 تم استدعاؤك للتذكرة: ${message.channel}\n**الرجاء الحضور بسرعة ⚠️**`).catch(() => {});
    message.reply(`✅ تم إرسال طلب حضور لـ ${member}`);
  }

  if (command === 'add') {
    const member = message.mentions.members.first();
    if (member) {
      await message.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true });
      message.reply(`✅ تم إضافة ${member} للتيكت.`);
    }
  }

  if (command === 'close') {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger));
    message.reply({ content: '⚠️ **هل تود إغلاق التذكرة؟**', components: [row] });
  }
});

client.login(process.env.TOKEN);
