const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// إعدادات النظام (الأي دي الخاص بالرومات والرتب)
const STAFF_ROLES = [
  "1491507205902696580", 
  "1491506068579155968", 
  "1491519894066561034", 
  "1489834831431864361", 
  "1489833620708393057"
];
const LOG_CHANNEL_ID = "1496196313132306472";

client.once('ready', () => {
  console.log(`✅ نظام التيكت المطور جاهز!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content === 'setup-ticket') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const embed = new EmbedBuilder()
      .setTitle('الدعم الفني ☄️')
      .setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__يرجى مراجعة قوانين التيكت <#1490688479527440534>__')
      .setColor('#5865F2')
      .setFooter({ text: 'نظام حماية وإدارة التيكتات' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_ticket')
        .setLabel('فتح تذكرة')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Secondary),
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // --- فتح التيكت ---
  if (interaction.customId === 'open_ticket') {
    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ...STAFF_ROLES.map(roleId => ({
          id: roleId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }))
      ],
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle('لوحة التحكم في التذكرة')
      .setDescription(`أهلاً بك ${interaction.user}، يرجى طرح مشكلتك وانتظار الدعم.\n\n**الأزرار أدناه للإدارة فقط:**`)
      .setColor('#2f3136');

    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId('lock_ticket').setLabel('قفل').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
      new ButtonBuilder().setCustomId('delete_ticket').setLabel('مسح').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    await channel.send({ content: `<@&${STAFF_ROLES[0]}>`, embeds: [ticketEmbed], components: [controlRow] });
    await interaction.reply({ content: `تم فتح تذكرتك بنجاح: ${channel}`, ephemeral: true });

    // لوق الفتح
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`📥 **تيكت جديد:** بواسطة ${interaction.user.tag} (${interaction.user.id})\nالقناة: ${channel}`);
    }
  }

  // --- استلام التيكت ---
  if (interaction.customId === 'claim_ticket') {
    if (!STAFF_ROLES.some(role => interaction.member.roles.cache.has(role))) return interaction.reply({ content: 'هذا الزر للإدارة فقط!', ephemeral: true });
    await interaction.reply({ content: `تم استلام التذكرة بواسطة: ${interaction.user}` });
  }

  // --- قفل التيكت ---
  if (interaction.customId === 'lock_ticket') {
    if (!STAFF_ROLES.some(role => interaction.member.roles.cache.has(role))) return interaction.reply({ content: 'هذا الزر للإدارة فقط!', ephemeral: true });
    
    // منع صاحب التيكت من الكتابة
    const topic = interaction.channel.name.split('-')[1];
    const member = interaction.guild.members.cache.find(m => m.user.username === topic);
    if (member) {
      await interaction.channel.permissionOverwrites.edit(member.id, { SendMessages: false });
    }
    
    await interaction.reply('🔒 **تم قفل التذكرة، لا يمكن للعضو الكتابة الآن.**');
  }

  // --- مسح التيكت ---
  if (interaction.customId === 'delete_ticket') {
    if (!STAFF_ROLES.some(role => interaction.member.roles.cache.has(role))) return interaction.reply({ content: 'هذا الزر للإدارة فقط!', ephemeral: true });
    
    await interaction.reply('🗑️ سيتم مسح التيكت وتسجيل اللوق...');
    
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`🗑️ **تيكت محذوف:** ${interaction.channel.name}\nحذفه: ${interaction.user.tag}`);
    }

    setTimeout(() => interaction.channel.delete(), 3000);
  }
});

client.login(process.env.TOKEN);
