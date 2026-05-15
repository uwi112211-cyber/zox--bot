const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
});

// --- الإعدادات ---
const PREFIX = "+";
const LOG_CHANNEL_ID = "1496196313132306472";

// الرتب التي ترى التيكت
const STAFF_ROLES = ["1491506068579155968", "1491519894066561034", "1489834831431864361", "1489833620708393057", "1491507205902696580"];

// رتب الاستثناء (تتكلم بدون استلام)
const BYPASS_ROLES = ["1491519894066561034", "1489834831431864361", "1491507205902696580"];

// رتب المنشن عند فتح التيكت
const MENTION_ROLES = ["1491507205902696580", "1491506068579155968"];

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} جاهز بالإعدادات الجديدة!`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commands = [new SlashCommandBuilder().setName('setup-ticket').setDescription('إعداد الدعم الفني')].map(c => c.toJSON());
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) {}
});

const getButtons = (claimed = false) => {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام التذكرة').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  )];
};

client.on('interactionCreate', async (i) => {
  if (i.isChatInputCommand() && i.commandName === 'setup-ticket') {
    const embed = new EmbedBuilder().setTitle('الدعم الفني ☄️').setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__مراجعة القوانين <#1490688479527440534>__').setColor('#5865F2');
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setStyle(ButtonStyle.Secondary).setEmoji('🎫'));
    await i.reply({ content: '✅ تم الإرسال', ephemeral: true });
    return i.channel.send({ embeds: [embed], components: [row] });
  }

  if (!i.isButton()) return;

  if (i.customId === 'open_ticket') {
    const channel = await i.guild.channels.create({
      name: `تذكرة-${i.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        // العضو يقدر يرسل صور وروابط داخل التيكت بس
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks] },
        // الإداريين يشوفون بس ما يتكلمون (بشكل مبدئي)
        ...STAFF_ROLES.map(id => ({
           id, 
           allow: [PermissionsBitField.Flags.ViewChannel], 
           deny: BYPASS_ROLES.includes(id) ? [] : [PermissionsBitField.Flags.SendMessages] 
        }))
      ],
    });

    const mns = MENTION_ROLES.map(id => `<@&${id}>`).join(' ');
    await channel.send({ content: `أهلاً ${i.user}، انتظر الرد. ${mns}`, components: getButtons(false) });
    return i.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
  }

  // --- نظام الاستلام ---
  if (i.customId === 'claim_ticket') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) return i.reply({ content: 'للإدارة فقط', ephemeral: true });
    await i.channel.permissionOverwrites.edit(i.user.id, { SendMessages: true });
    await i.update({ components: getButtons(true) });
    return i.channel.send(`✅ تم استلام التذكرة بواسطة ${i.user}`);
  }

  if (i.customId === 'confirm_close_request') {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('تأكيد الإغلاق').setStyle(ButtonStyle.Danger));
    return i.reply({ content: '⚠️ هل أنت متأكد؟', components: [row] });
  }

  if (i.customId === 'final_delete') {
    await i.reply('🗑️ جاري الحذف...');
    setTimeout(() => i.channel.delete().catch(() => {}), 2000);
  }
});

// --- أوامر البريفكس (إصلاح come و add) ---
client.on('messageCreate', async (m) => {
  if (m.author.bot || !m.content.startsWith(PREFIX)) return;
  const args = m.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (!m.channel.name.includes('تذكرة-')) return;
  if (!STAFF_ROLES.some(r => m.member.roles.cache.has(r))) return;

  // أمر المناداة (come)
  if (cmd === 'come') {
    const topic = m.channel.name.split('-')[1];
    m.delete();
    m.channel.send(`يا <@${m.channel.permissionOverwrites.cache.filter(p => p.type === 1).first()?.id}>، الإدارة تطلب حضورك هنا!`);
  }

  // أمر إضافة عضو (add)
  if (cmd === 'add') {
    const user = m.mentions.users.first() || m.guild.members.cache.get(args[0]);
    if (!user) return m.reply('❌ منشن العضو أو حط الآيدي');
    await m.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, AttachFiles: true });
    m.reply(`✅ تم إضافة ${user} للتذكرة.`);
  }

  // أمر التسمية (rename)
  if (cmd === 'rename') {
    if (!args[0]) return m.reply('❌ اكتب الاسم الجديد');
    await m.channel.setName(`تذكرة-${args[0]}`);
    m.reply('✅ تم تغيير الاسم.');
  }
});

client.login(process.env.TOKEN);
