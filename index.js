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
const LOG_CHANNEL_ID = "1496196313132306472";

const commands = [
  { name: 'setup-ticket', description: 'إنشاء لوحة التيكت (للإدارة فقط)' },
  { name: 'ping', description: 'اختبار السرعة' }
];

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ نظام التأكيد عند الإغلاق جاهز!`);
  } catch (error) { console.error(error); }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup-ticket') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: 'للمدراء فقط.', ephemeral: true });
      const embed = new EmbedBuilder().setTitle('الدعم الفني ☄️').setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__يرجى مراجعة قوانين التيكت <#1490688479527440534>__').setColor('#5865F2');
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Secondary));
      await interaction.reply({ content: 'تم الإرسال.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  if (!interaction.isButton()) return;

  const getButtons = (claimed = false, locked = false) => {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(claimed ? '🔙' : '✅'),
      new ButtonBuilder().setCustomId(locked ? 'unlock_ticket' : 'lock_ticket').setLabel(locked ? 'فتح القفل' : 'قفل').setStyle(locked ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(locked ? '🔓' : '🔒'),
      new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
    );
    return [row];
  };

  if (interaction.customId === 'open_ticket') {
    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ...STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
      ],
    });
    await channel.send({ content: `أهلاً ${interaction.user}، انتظر الدعم. <@&1491507205902696580> <@&1491506068579155968>`, components: getButtons(false, false) });
    await interaction.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
  }

  // أزرار التحكم
  if (['claim_ticket', 'unclaim_ticket', 'lock_ticket', 'unlock_ticket', 'confirm_close_request', 'final_delete_ticket'].includes(interaction.customId)) {
    if (!STAFF_ROLES.some(r => interaction.member.roles.cache.has(r))) return interaction.reply({ content: 'للإدارة فقط.', ephemeral: true });

    if (interaction.customId === 'claim_ticket') {
      await interaction.channel.setTopic(interaction.user.id);
      await interaction.update({ components: getButtons(true, false) });
      await interaction.followUp(`✅ تم استلام التيكت بواسطة: ${interaction.user}`);
    }

    if (interaction.customId === 'confirm_close_request') {
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('final_delete_ticket').setLabel('تأكيد الإغلاق').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
      );
      await interaction.reply({ content: '⚠️ **هل أنت متأكد من رغبتك في إغلاق التذكرة؟**', components: [confirmRow] });
    }

    if (interaction.customId === 'final_delete_ticket') {
      await interaction.reply('🗑️ جاري حذف التذكرة...');
      setTimeout(() => interaction.channel.delete(), 2000);
    }

    // (بقية أكواد القفل والاستلام تبقى كما هي...)
    if (interaction.customId === 'unclaim_ticket') {
      await interaction.channel.setTopic(null);
      await interaction.update({ components: getButtons(false, false) });
      await interaction.followUp(`🔙 تم إلغاء الاستلام.`);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX_TICKET)) return;
  const args = message.content.slice(PREFIX_TICKET.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  if (!message.channel.name.startsWith('ticket-')) return;
  if (!STAFF_ROLES.some(r => message.member.roles.cache.has(r))) return;

  if (command === 'close') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('final_delete_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );
    message.reply({ content: '⚠️ **هل تود إغلاق التذكرة؟**', components: [row] });
  }

  if (command === 'rename') {
    const newName = args.join('-');
    if (!newName) return message.reply('اكتب الاسم!');
    await message.channel.setName(`ticket-${newName}`).catch(() => {});
    message.reply(`✅ تم تغيير الاسم لـ: ticket-${newName}`);
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
