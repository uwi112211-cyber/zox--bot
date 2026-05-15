const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// إعدادات النظام
const STAFF_ROLES = ["1491507205902696580", "1491506068579155968", "1491519894066561034", "1489834831431864361", "1489833620708393057"];
const LOG_CHANNEL_ID = "1496196313132306472";

client.once('ready', () => {
  console.log(`✅ البوت عاد للعمل بنظافة! باسم: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // أمر تشغيل لوحة التيكت
  if (message.content === 'setup-ticket') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const embed = new EmbedBuilder()
      .setTitle('الدعم الفني ☄️')
      .setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__يرجى مراجعة قوانين التيكت <#1490688479527440534>__')
      .setColor('#5865F2');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Secondary),
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }

  // --- أضف أي أوامر إدارة هنا (ping, warn, clear...) ---
  if (message.content === 'ping') message.reply('pong! 🏓');
});

// تفاعلات التيكت (فتح، استلام، قفل، مسح)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

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

    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId('lock_ticket').setLabel('قفل').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
      new ButtonBuilder().setCustomId('delete_ticket').setLabel('مسح').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    await channel.send({ content: `أهلاً ${interaction.user}، انتظر الدعم. <@&${STAFF_ROLES[0]}>`, components: [controlRow] });
    await interaction.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
    
    const log = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (log) log.send(`📥 تيكت جديد من ${interaction.user.tag}`);
  }

  // أزرار التحكم (claim, lock, delete)
  if (['claim_ticket', 'lock_ticket', 'delete_ticket'].includes(interaction.customId)) {
    if (!STAFF_ROLES.some(r => interaction.member.roles.cache.has(r))) return interaction.reply({ content: 'للإدارة فقط!', ephemeral: true });

    if (interaction.customId === 'claim_ticket') await interaction.reply(`✅ استلمها: ${interaction.user}`);
    if (interaction.customId === 'lock_ticket') {
        await interaction.channel.permissionOverwrites.edit(interaction.channel.name.split('-')[1], { SendMessages: false }).catch(() => {});
        await interaction.reply('🔒 تم قفل التيكت.');
    }
    if (interaction.customId === 'delete_ticket') {
        await interaction.reply('🗑️ حذف...');
        setTimeout(() => interaction.channel.delete(), 2000);
    }
  }
});

client.login(process.env.TOKEN);
