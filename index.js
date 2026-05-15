const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// الإعدادات
const PREFIX_TICKET = "+";
const STAFF_ROLES = ["1491507205902696580", "1491506068579155968", "1491519894066561034", "1489834831431864361", "1489833620708393057"];
const LOG_CHANNEL_ID = "1496196313132306472";

// تعريف أوامر السلاش
const commands = [
  {
    name: 'setup-ticket',
    description: 'إنشاء لوحة التيكت (للإدارة فقط)',
  },
  {
    name: 'ping',
    description: 'يختبر سرعة استجابة البوت',
  }
];

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    // تسجيل أوامر السلاش في ديسكورد
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ البوت جاهز! تم تفعيل أوامر السلاش ومسح الكلمات العادية.`);
  } catch (error) { console.error(error); }
});

// التعامل مع أوامر السلاش (Interaction)
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ping') await interaction.reply(`🏓 بونق! السرعة: ${client.ws.ping}ms`);

    if (interaction.commandName === 'setup-ticket') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'عذراً، هذا الأمر للمدراء فقط.', ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setTitle('الدعم الفني ☄️')
        .setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__يرجى مراجعة قوانين التيكت <#1490688479527440534>__')
        .setColor('#5865F2');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({ content: 'تم إرسال اللوحة بنجاح.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  if (!interaction.isButton()) return;

  // --- نظام أزرار التيكت ---
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
      new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('إلغاء استلام').setStyle(ButtonStyle.Secondary).setEmoji('🔙'),
      new ButtonBuilder().setCustomId('lock_ticket').setLabel('قفل').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
      new ButtonBuilder().setCustomId('delete_ticket').setLabel('مسح').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    await channel.send({ 
      content: `أهلاً ${interaction.user}، يرجى الانتظار. <@&1491507205902696580> <@&1491506068579155968>`, 
      components: [controlRow] 
    });
    await interaction.reply({ content: `تم فتح تذكرتك بنجاح: ${channel}`, ephemeral: true });
  }

  // --- التحكم بالأزرار (للمشرفين) ---
  if (['claim_ticket', 'unclaim_ticket', 'lock_ticket', 'delete_ticket'].includes(interaction.customId)) {
    if (!STAFF_ROLES.some(r => interaction.member.roles.cache.has(r))) return interaction.reply({ content: 'هذا الزر مخصص للإدارة.', ephemeral: true });

    if (interaction.customId === 'claim_ticket') {
      await interaction.channel.setTopic(interaction.user.id);
      await interaction.reply(`✅ تم استلام التيكت بواسطة: ${interaction.user}`);
    }
    if (interaction.customId === 'unclaim_ticket') {
      await interaction.channel.setTopic(null);
      await interaction.reply(`🔙 تم إلغاء الاستلام.`);
    }
    if (interaction.customId === 'lock_ticket') {
      const ownerName = interaction.channel.name.replace('ticket-', '');
      const owner = interaction.guild.members.cache.find(m => m.user.username === ownerName);
      const claimerId = interaction.channel.topic;
      await interaction.channel.permissionOverwrites.set([
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: owner?.id || interaction.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: claimerId || interaction.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ...STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }))
      ]);
      await interaction.reply('🔒 تم القفل. الكلام متاح فقط لصاحب التيكت والمستلم.');
    }
    if (interaction.customId === 'delete_ticket') {
      await interaction.reply('🗑️ جاري الحذف...');
      setTimeout(() => interaction.channel.delete(), 2000);
    }
  }
});

// التعامل مع أوامر البريفكس + (داخل التيكت فقط)
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX_TICKET)) return;

  const args = message.content.slice(PREFIX_TICKET.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // التأكد أن الأمر يتم استخدامه داخل تيكت
  if (!message.channel.name.startsWith('ticket-')) return;

  // التأكد من رتبة الإدارة
  if (!STAFF_ROLES.some(r => message.member.roles.cache.has(r))) return;

  if (command === 'close') {
    await message.channel.delete();
  }

  if (command === 'add') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('يرجى منشن العضو لإضافته.');
    await message.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true });
    message.reply(`✅ تم إضافة ${member} للتيكت.`);
  }

  if (command === 'rename') {
    const newName = args.join('-');
    if (!newName) return message.reply('يرجى كتابة الاسم الجديد.');
    await message.channel.setName(newName);
    message.reply(`✅ تم تغيير الاسم إلى: ${newName}`);
  }
});

client.login(process.env.TOKEN);
