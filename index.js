const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  EmbedBuilder, 
  REST, 
  Routes, 
  SlashCommandBuilder
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildMembers
  ],
});

// --- الإعدادات الأساسية ---
const PREFIX = "+";
const LOG_CHANNEL_ID = "1496196313132306472";

// آيدي الكاتيجوري (القسم) الذي ستفتح تحته التذاكر
const TICKET_CATEGORY_ID = "1507516679171739719";

// الرتب التي ترى التيكت وتتحكم بالأزرار والأوامر
const STAFF_ROLES = ["1491506068579155968", "1491519894066561034", "1489834831431864361", "1489833620708393057", "1491507205902696580"];

// رتب الاستثناء (تتكلم بدون استلام)
const BYPASS_ROLES = ["1491519894066561034", "1489834831431864361", "1491507205902696580"];

// رتب المنشن عند فتح التيكت
const MENTION_ROLES = ["1491507205902696580", "1491506068579155968"];

// --- تسجيل أوامر السلاش النظيفة عند جاهزية البوت ---
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} جاهز! تم إغلاق الثغرات وتنظيف الأوامر.`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    // تسجيل الأوامر الخاصة بالتيكيت فقط (تم إزالة الأوامر القديمة تماماً)
    const commands = [
        new SlashCommandBuilder().setName('setup-ticket').setDescription('إعداد لوحة الدعم الفني في الروم الحالي'),
        new SlashCommandBuilder().setName('come').setDescription('مناداة العضو صاحب التذكرة للحضور يدوياً'),
        new SlashCommandBuilder().setName('close').setDescription('إغلاق وتصفية التذكرة الحالية'),
        new SlashCommandBuilder()
            .setName('add')
            .setDescription('إضافة عضو معين للتذكرة الحالية')
            .addUserOption(option => option.setName('user').setDescription('اختر العضو المراد إضافته').setRequired(true)),
        new SlashCommandBuilder()
            .setName('rename')
            .setDescription('تغيير اسم التذكرة الحالية')
            .addStringOption(option => option.setName('name').setDescription('اكتب الاسم الجديد للتذكرة').setRequired(true))
    ].map(c => c.toJSON());
    
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        console.log('✅ تم تجديد وتسجيل الأوامر بنجاح!');
    } catch (e) {
        console.error('❌ حدث خطأ أثناء تسجيل الأوامر:', e);
    }
});

const getButtons = (claimed = false) => {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام التذكرة').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  )];
};

// --- معالجة التفاعلات وأوامر السلاش وأزرار التيكت ---
client.on('interactionCreate', async (i) => {
  
  // 1. معالجة أوامر السلاش (Chat Input Commands)
  if (i.isChatInputCommand()) {
      
      if (i.commandName === 'setup-ticket') {
        const embed = new EmbedBuilder()
          .setTitle('الدعم الفني ☄️')
          .setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__مراجعة القوانين <#1507521644632211547>__')
          .setColor('#5865F2');
          
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setStyle(ButtonStyle.Secondary).setEmoji('🎫')
        );
        
        await i.reply({ content: '✅ تم إرسال لوحة التذاكر المحدثة بنجاح!', ephemeral: true });
        return i.channel.send({ embeds: [embed], components: [row] });
      }

      if (['come', 'add', 'rename', 'close'].includes(i.commandName)) {
        if (!i.channel.name.includes('تذكرة-')) {
          return i.reply({ content: '❌ هذا الأمر يمكن استخدامه داخل قنوات التذاكر فقط!', ephemeral: true });
        }
        if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) {
          return i.reply({ content: '❌ هذا الأمر مخصص لطاقم الدعم الفني فقط!', ephemeral: true });
        }
      }

      if (i.commandName === 'come') {
        await i.reply({ content: '⏳ جاري النداء...', ephemeral: true });
        const targetOverwrite = i.channel.permissionOverwrites.cache.filter(p => p.type === 1).first();
        if (!targetOverwrite) return i.followUp({ content: '❌ لم يتم العثور على عضو صاحب صلاحية خاصة في هذه التذكرة.', ephemeral: true });
        return i.channel.send(`يا <@${targetOverwrite.id}>، الإدارة تطلب حضورك هنا فوراً!`);
      }

      if (i.commandName === 'add') {
        const user = i.options.getUser('user');
        await i.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, AttachFiles: true, EmbedLinks: true });
        return i.reply({ content: `✅ تم إضافة ${user} للتذكرة بنجاح.` });
      }

      if (i.commandName === 'rename') {
        const newName = i.options.getString('name');
        await i.channel.setName(`تذكرة-${newName}`);
        return i.reply({ content: `✅ تم تغيير اسم التذكرة إلى: \`تذكرة-${newName}\`` });
      }

      if (i.commandName === 'close') {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('تأكيد الإغلاق').setStyle(ButtonStyle.Danger));
        return i.reply({ content: '⚠️ هل أنت متأكد من رغبتك في إغلاق هذه التذكرة؟', components: [row] });
      }
  }

  // 2. معالجة الأزرار التفاعلية (Buttons)
  if (!i.isButton()) return;

  // زر فتح التذكرة (متاح للجميع)
  if (i.customId === 'open_ticket') {
    const channel = await i.guild.channels.create({
      name: `تذكرة-${i.user.username}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks] },
        ...STAFF_ROLES.map(id => ({
           id, 
           allow: [PermissionsBitField.Flags.ViewChannel], 
           deny: BYPASS_ROLES.includes(id) ? [] : [PermissionsBitField.Flags.SendMessages] 
        }))
      ],
    });

    const mns = MENTION_ROLES.map(id => `<@&${id}>`).join(' ');
    await channel.send({ content: `أهلاً ${i.user}، انتظر الرد من طاقم الدعم. ${mns}`, components: getButtons(false) });
    return i.reply({ content: `تم فتح تذكرتك بنجاح: ${channel}`, ephemeral: true });
  }

  // 🔒 حماية زر استلام التذكرة (للتأكد من رتب الإدارة فقط)
  if (i.customId === 'claim_ticket') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) {
      return i.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة والدعم الفني فقط!', ephemeral: true });
    }
    await i.channel.permissionOverwrites.edit(i.user.id, { SendMessages: true });
    await i.update({ components: getButtons(true) });
    return i.channel.send(`✅ تم استلام التذكرة بواسطة المشرف: ${i.user}`);
  }

  // 🔒 حماية زر إلغاء استلام التذكرة (للتأكد من رتب الإدارة فقط)
  if (i.customId === 'unclaim_ticket') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) {
      return i.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة والدعم الفني فقط!', ephemeral: true });
    }
    await i.channel.permissionOverwrites.edit(i.user.id, { SendMessages: false });
    await i.update({ components: getButtons(false) });
    return i.channel.send(`⚠️ تم إلغاء استلام التذكرة بواسطة المشرف: ${i.user}`);
  }

  // طلب تأكيد الإغلاق (محمي للإدارة)
  if (i.customId === 'confirm_close_request') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) {
      return i.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة والدعم الفني فقط!', ephemeral: true });
    }
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('تأكيد الإغلاق').setStyle(ButtonStyle.Danger));
    return i.reply({ content: '⚠️ هل أنت متأكد من إغلاق وحذف التذكرة؟', components: [row] });
  }

  // الحذف النهائي (محمي للإدارة)
  if (i.customId === 'final_delete') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) {
      return i.reply({ content: '❌ هذا الإجراء مخصص لطاقم الإدارة فقط!', ephemeral: true });
    }
    await i.reply('🗑️ جاري تصفية وحذف التذكرة خلال ثانيتين...');
    setTimeout(() => i.channel.delete().catch(() => {}), 2000);
  }
});

// --- معالجة أوامر البريفكس العادية داخل التيكيتات (+come, +add, +rename, +close) ---
client.on('messageCreate', async (m) => {
  if (m.author.bot || !m.content.startsWith(PREFIX)) return;
  
  const args = m.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (!m.channel.name.includes('تذكرة-')) return;
  if (!STAFF_ROLES.some(r => m.member.roles.cache.has(r))) return;

  if (cmd === 'come') {
    m.delete().catch(() => {});
    const targetOverwrite = m.channel.permissionOverwrites.cache.filter(p => p.type === 1).first();
    if (!targetOverwrite) return m.reply('❌ لم يتم العثور على عضو صاحب التذكرة هنا.');
    m.channel.send(`يا <@${targetOverwrite.id}>، الإدارة تطلب حضورك هنا فوراً!`);
  }

  if (cmd === 'add') {
    const user = m.mentions.users.first() || m.guild.members.cache.get(args[0]);
    if (!user) return m.reply('❌ يرجى عمل منشن للعضو أو وضع الآيدي الخاص به بشكل صحيح.');
    await m.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, AttachFiles: true, EmbedLinks: true });
    m.reply(`✅ تم إضافة ${user} للتذكرة بنجاح.`);
  }

  if (cmd === 'rename') {
    if (!args[0]) return m.reply('❌ يرجى كتابة الاسم الجديد المراد تطبيقه على التذكرة.');
    const newName = args.join('-');
    await m.channel.setName(`تذكرة-${newName}`);
    m.reply(`✅ تم تغيير اسم التذكرة بنجاح إلى: \`تذكرة-${newName}\``);
  }

  if (cmd === 'close') {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('تأكيد الإغلاق').setStyle(ButtonStyle.Danger));
    m.reply({ content: '⚠️ هل أنت متأكد من رغبتك في إغلاق هذه التذكرة؟', components: [row] });
  }
});

client.login(process.env.TOKEN);
