const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// --- الإعدادات العامة ---
const PREFIX_TICKET = "+";
const LOG_CHANNEL_ID = "1496196313132306472";

// رتب الدعم الفني العادي
const STAFF_ROLES = ["1491507205902696580", "1491506068579155968", "1491519894066561034", "1489834831431864361", "1489833620708393057"];
const MENTION_ROLES = ["1491507205902696580", "1491506068579155968"];

// إعدادات طلب الخدمة (الجديدة)
const SERVICE_STAFF_ROLE = "1491821702076960838"; // الرتبة اللي تشوف تيكت الخدمة
const RULES_CHANNEL = "1496441074338496522"; // روم القوانين

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} جاهز بنظام التذاكر المزدوج!`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commands = [
        new SlashCommandBuilder().setName('setup-ticket').setDescription('إعداد الدعم الفني'),
        new SlashCommandBuilder().setName('setup-service').setDescription('إعداد طلب الخدمات')
    ].map(c => c.toJSON());
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

// دالة الأزرار الموحدة
const getButtons = (claimed = false, locked = false) => {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(claimed ? '🔙' : '✅'),
    new ButtonBuilder().setCustomId(locked ? 'unlock_ticket' : 'lock_ticket').setLabel(locked ? 'فتح القفل' : 'قفل').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('✖️')
  )];
};

client.on('interactionCreate', async (interaction) => {
  // --- إعداد اللوحات (Slash Commands) ---
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup-ticket') {
      const embed = new EmbedBuilder().setTitle('الدعم الفني ☄️').setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__يرجى مراجعة قوانين التيكت <#1490688479527440534>__').setColor('#5865F2');
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Secondary));
      await interaction.reply({ content: '✅ تم إرسال لوحة الدعم.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === 'setup-service') {
      const embed = new EmbedBuilder().setTitle('طلب خدمة 💵').setDescription(`**الرجاء قبل طلب خدمة مراجعة قوانين الخدمات من <#${RULES_CHANNEL}>**\n\n**الرجاء عدم الاستهبال بالطلب**\n\n**فتحك للتذكرة = موافقتك على القوانين**`).setColor('Gold');
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_service').setLabel('طلب خدمة 💵').setStyle(ButtonStyle.Success));
      await interaction.reply({ content: '✅ تم إرسال لوحة الخدمات.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  if (!interaction.isButton()) return;

  // --- فتح التذاكر (دعم أو خدمة) ---
  if (interaction.customId === 'open_ticket' || interaction.customId === 'open_service') {
    const isService = interaction.customId === 'open_service';
    const channel = await interaction.guild.channels.create({
      name: `${isService ? 'طلب' : 'تذكرة'}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        // إذا كانت خدمة، الرتبة المحددة فقط تشوف، إذا دعم الرتب العادية تشوف
        { id: isService ? SERVICE_STAFF_ROLE : STAFF_ROLES[0], allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ],
    });

    const mentions = isService ? `<@&${SERVICE_STAFF_ROLE}>` : MENTION_ROLES.map(id => `<@&${id}>`).join(' ');
    await channel.send({ content: `أهلاً ${interaction.user}، انتظر الرد. ${mentions}`, components: getButtons(false, false) });
    
    // إرسال اللوق
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const logEmbed = new EmbedBuilder().setColor(isService ? 'Gold' : 'Blue').setTitle(`فتح تيكت ${isService ? 'خدمة' : 'دعم'}`).addFields({ name: 'المستخدم', value: `${interaction.user.tag}` }, { name: 'القناة', value: `<#${channel.id}>` }).setTimestamp();
      logChannel.send({ embeds: [logEmbed] });
    }
    return interaction.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
  }

  // --- أزرار الإدارة (Claim / Close) ---
  if (interaction.customId === 'claim_ticket') {
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: true });
    await interaction.update({ components: getButtons(true, false) });
    interaction.channel.send(`✅ تم استلام التذكرة من قبل: ${interaction.user}`);
  }

  if (interaction.customId === 'confirm_close_request') {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('تأكيد الحذف').setStyle(ButtonStyle.Danger));
    await interaction.reply({ content: '⚠️ هل أنت متأكد من إغلاق التذكرة؟', components: [row] });
  }

  if (interaction.customId === 'final_delete') {
    await interaction.reply('🗑️ جاري حذف التذكرة...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
  }
});

// --- أوامر البريفكس ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX_TICKET)) return;
  const args = message.content.slice(PREFIX_TICKET.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'rename' && message.channel.name.includes('تذكرة-')) {
    const newName = args[0];
    if (!newName) return message.reply('❌ اكتب الاسم الجديد');
    await message.channel.setName(`تذكرة-${newName}`);
    message.reply(`✅ تم تغيير الاسم إلى: تذكرة-${newName}`);
  }
});

client.login(process.env.TOKEN);
