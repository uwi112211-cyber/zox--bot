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
const LOG_CHANNEL_ID = "1496196313132306472";

// تسجيل أوامر السلاش
const commands = [{ name: 'setup-ticket', description: 'إنشاء لوحة التيكت' }, { name: 'ping', description: 'سرعة البوت' }];

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ البوت جاهز!`);
  } catch (error) { console.error(error); }
});

// دالة الأزرار
const getButtons = (claimed = false, locked = false) => {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(claimed ? '🔙' : '✅'),
    new ButtonBuilder().setCustomId(locked ? 'unlock_ticket' : 'lock_ticket').setLabel(locked ? 'فتح القفل' : 'قفل').setStyle(locked ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(locked ? '🔓' : '🔒'),
    new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  );
  return [row];
};

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup-ticket') {
      const embed = new EmbedBuilder().setTitle('الدعم الفني ☄️').setDescription('__يرجى مراجع القوانين <#1490688479527440534>__').setColor('#5865F2');
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Secondary));
      await interaction.reply({ content: 'تم الإرسال.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  if (!interaction.isButton()) return;
  if (!STAFF_ROLES.some(r => interaction.member?.roles.cache.has(r)) && interaction.customId !== 'open_ticket') return interaction.reply({ content: 'للإدارة فقط.', ephemeral: true });

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
    await channel.send({ content: `أهلاً ${interaction.user}، انتظر الدعم.`, components: getButtons(false, false) });
    return interaction.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
  }

  // معالجة باقي الأزرار (استلام، قفل، حذف) بنفس المنطق السريع لتجنب Interaction Failed
  if (interaction.customId === 'claim_ticket') {
    await interaction.channel.setTopic(interaction.user.id);
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: true });
    await interaction.update({ components: getButtons(true, false) });
  } 
  
  if (interaction.customId === 'confirm_close_request') {
    const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('تأكيد الإغلاق النهائي').setStyle(ButtonStyle.Danger));
    await interaction.reply({ content: '⚠️ هل أنت متأكد؟', components: [confirmRow] });
  }

  if (interaction.customId === 'final_delete') {
    await interaction.reply('🗑️ جاري الحذف...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
  }
});

// --- أوامر البريفكس المصلحة ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX_TICKET)) return;
  const args = message.content.slice(PREFIX_TICKET.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (!message.channel.name.startsWith('ticket-')) return;
  if (!STAFF_ROLES.some(r => message.member.roles.cache.has(r))) return;

  // إصلاح الـ Rename الجذري
  if (command === 'rename') {
    const word = args[0]; // يأخذ أول كلمة كتبت فقط
    if (!word) return message.reply('❌ اكتب الاسم الجديد (كلمة واحدة أو حرف)!');
    
    // يمسح كل شيء ويخليها ticket-حرفك
    await message.channel.setName(`ticket-${word}`).catch(() => {});
    message.reply(`✅ تم تغيير الاسم بالكامل إلى: **ticket-${word}**`);
  }

  if (command === 'come') {
    const member = message.mentions.members.first();
    if (member) {
      member.send(`🔔 استدعاء في: ${message.channel}`).catch(() => {});
      message.reply(`✅ تم النداء على ${member}`);
    }
  }

  if (command === 'close') {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('إغلاق').setStyle(ButtonStyle.Danger));
    message.reply({ content: '⚠️ إغلاق؟', components: [row] });
  }
});

client.login(process.env.TOKEN);
