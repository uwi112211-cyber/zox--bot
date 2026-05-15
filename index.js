const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// --- الإعدادات الأصلية ---
const PREFIX_TICKET = "+";
const STAFF_ROLES = ["1491507205902696580", "1491506068579155968", "1491519894066561034", "1489834831431864361", "1489833620708393057"];
const MENTION_ROLES = ["1491507205902696580", "1491506068579155968"]; 
const LOG_CHANNEL_ID = "1496196313132306472";

client.once('ready', async () => { 
  console.log(`✅ البوت جاهز ونظام اللوق مفعل!`); 
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  const commands = [
    new SlashCommandBuilder().setName('setup-ticket').setDescription('إعداد الدعم الفني')
  ].map(c => c.toJSON());
  try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

const getButtons = (claimed = false) => {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(claimed ? '🔙' : '✅'),
    new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  )];
};

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup-ticket') {
      const embed = new EmbedBuilder().setTitle('الدعم الفني ☄️').setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__يرجى مراجعة قوانين التيكت <#1490688479527440534>__').setColor('#5865F2');
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Secondary));
      await interaction.reply({ content: 'تم الإرسال.', ephemeral: true });
      return interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === 'open_ticket') {
    const channel = await interaction.guild.channels.create({
      name: `تذكرة-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ...STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }))
      ],
    });

    const mentions = MENTION_ROLES.map(id => `<@&${id}>`).join(' ');
    await channel.send({ content: `أهلاً ${interaction.user}، انتظر الدعم. ${mentions}`, components: getButtons(false) });

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const logEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle('فتح تيكت').addFields({ name: 'المستخدم', value: `${interaction.user.tag}` }, { name: 'القناة', value: `<#${channel.id}>` }).setTimestamp();
      logChannel.send({ embeds: [logEmbed] });
    }
    return interaction.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
  }

  if (!STAFF_ROLES.some(r => interaction.member.roles.cache.has(r))) return interaction.reply({ content: 'للإدارة فقط.', ephemeral: true });

  if (interaction.customId === 'claim_ticket') {
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: true });
    await interaction.update({ components: getButtons(true) });
    interaction.channel.send(`✅ تم استلام التذكرة من قبل: ${interaction.user}`);
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

// أوامر البريفكس للتغيير
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX_TICKET)) return;
  const args = message.content.slice(PREFIX_TICKET.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'rename' && message.channel.name.includes('تذكرة-')) {
    if (!STAFF_ROLES.some(r => message.member.roles.cache.has(r))) return;
    const word = args[0];
    if (!word) return message.reply('❌ اكتب الاسم الجديد!');
    await message.channel.setName(`تذكرة-${word}`);
    message.reply(`✅ تم تغيير الاسم لـ: **تذكرة-${word}**`);
  }
});

client.login(process.env.TOKEN);
