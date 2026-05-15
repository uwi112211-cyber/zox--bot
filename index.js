const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

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

// إعدادات طلب الخدمة
const SERVICE_STAFF_ROLE = "1491821702076960838"; 
const RULES_CHANNEL = "1496441074338496522";

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} Online!`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commands = [
        new SlashCommandBuilder().setName('setup-ticket').setDescription('إعداد الدعم الفني'),
        new SlashCommandBuilder().setName('setup-service').setDescription('إعداد طلب الخدمات')
    ].map(c => c.toJSON());
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        console.log('Successfully registered commands');
    } catch (e) { console.error(e); }
});

const getButtons = (claimed = false) => {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(claimed ? '🔙' : '✅'),
    new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('✖️')
  )];
};

client.on('interactionCreate', async (i) => {
  if (i.isChatInputCommand()) {
    if (i.commandName === 'setup-ticket') {
      const embed = new EmbedBuilder().setTitle('الدعم الفني ☄️').setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__يرجى مراجعة قوانين التيكت <#1490688479527440534>__').setColor('#5865F2');
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Secondary));
      await i.reply({ content: '✅ تم الإرسال.', ephemeral: true });
      return i.channel.send({ embeds: [embed], components: [row] });
    }

    if (i.commandName === 'setup-service') {
      const embed = new EmbedBuilder().setTitle('طلب خدمة 💵').setDescription(`**الرجاء قبل طلب خدمة مراجعة قوانين الخدمات من <#${RULES_CHANNEL}>**\n\n**الرجاء عدم الاستهبال بالطلب**\n\n**فتحك للتذكرة = موافقتك على القوانين**`).setColor('Gold');
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_service').setLabel('طلب خدمة 💵').setStyle(ButtonStyle.Success));
      await i.reply({ content: '✅ تم الإرسال.', ephemeral: true });
      return i.channel.send({ embeds: [embed], components: [row] });
    }
  }

  if (!i.isButton()) return;

  if (i.customId === 'open_ticket' || i.customId === 'open_service') {
    const isService = i.customId === 'open_service';
    await i.deferReply({ ephemeral: true });

    const channel = await i.guild.channels.create({
      name: `${isService ? 'طلب' : 'تذكرة'}-${i.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: isService ? SERVICE_STAFF_ROLE : STAFF_ROLES[0], allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ],
    });

    const mentions = isService ? `<@&${SERVICE_STAFF_ROLE}>` : MENTION_ROLES.map(id => `<@&${id}>`).join(' ');
    await channel.send({ content: `أهلاً ${i.user}، انتظر الرد. ${mentions}`, components: getButtons(false) });
    
    return i.editReply({ content: `تم فتح تذكرتك: ${channel}` });
  }

  if (i.customId === 'confirm_close_request') {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('تأكيد الحذف').setStyle(ButtonStyle.Danger));
    return i.reply({ content: '⚠️ هل أنت متأكد من الإغلاق؟', components: [row] });
  }

  if (i.customId === 'final_delete') {
    await i.reply('🗑️ جاري حذف التذكرة...');
    return setTimeout(() => i.channel.delete().catch(() => {}), 3000);
  }
});

client.login(process.env.TOKEN);
