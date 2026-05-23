const { Client: SelfClient } = require('discord.js-selfbot-v13'); // مكتبة الحساب الشخصي
const { 
  Client: BotClient, 
  GatewayIntentBits, 
  PermissionsBitField, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  EmbedBuilder, 
  REST, 
  Routes, 
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js'); // مكتبة البوت الرسمي

// 1️⃣ تشغيل الحساب الشخصي (للقراءة فقط)
const userClient = new SelfClient({ checkUpdate: false });

// 2️⃣ تشغيل البوت الأساسي (للبناء والتحكم ونظام التذاكر)
const client = new BotClient({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildMembers
  ],
});

// --- الإعدادات الأساسية لنظام التذاكر ---
const PREFIX = "+";
const LOG_CHANNEL_ID = "1496196313132306472";

// آيدي الكاتيجوري (القسم) الذي ستفتح تحته التذاكر تلقائياً
const TICKET_CATEGORY_ID = "1507516679171739719";

// الرتب التي ترى التيكت وتتحكم بالأزرار والأوامر الإدارية
const STAFF_ROLES = ["1491506068579155968", "1491519894066561034", "1489834831431864361", "1489833620708393057", "1491507205902696580"];

// رتب الاستثناء (تتكلم بالتيكت بدون الحاجة للضغط على استلام)
const BYPASS_ROLES = ["1491519894066561034", "1489834831431864361", "1491507205902696580"];

// رتب المنشن الفوري عند فتح تذكرة جديدة
const MENTION_ROLES = ["1491507205902696580", "1491506068579155968"];


// --- تسجيل أوامر السلاش (التذاكر + النسخ السري) عند جاهزية البوت ---
client.once('ready', async () => {
    console.log(`🤖 البوت الرسمي [${client.user.tag}] جاهز ومحمي بالكامل!`);
    
    // استخدام التوكن المتاح في المشروع
    const token = process.env.TOKEN || 'ضع_توكن_البوت_هنا_إذا_لم_يكن_في_البيئة';
    const rest = new REST({ version: '10' }).setToken(token);
    
    // تجميع كافة الأوامر في مصفوفة واحدة لتسجيلها معاً
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
            .addStringOption(option => option.setName('name').setDescription('اكتب الاسم الجديد للتذكرة').setRequired(true)),
        new SlashCommandBuilder()
            .setName('clone-secret-server')
            .setDescription('نسخ رومات سيرفر مخفي (حسابك الشخصي يجب أن يكون داخله)')
            .addStringOption(option => 
                option.setName('server-id')
                      .setDescription('ضع آيدي السيرفر المراد سحب الرومات منه')
                      .setRequired(true)
            )
    ].map(c => c.toJSON());
    
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        console.log('✅ تم تجديد وتسجيل جميع أوامر السلاش (التذاكر + النسخ) بنجاح!');
    } catch (e) {
        console.error('❌ حدث خطأ أثناء تسجيل أوامر السلاش:', e);
    }
});

// --- عند جاهزية الحساب الشخصي السري ---
userClient.once('ready', () => {
    console.log(`📡 الحساب الشخصي [${userClient.user.tag}] متصل ومستعد لقراءة السيرفرات المخفية!`);
});

// مصفوفة الأزرار الجاهزة للتذاكر
const getButtons = (claimed = false) => {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(claimed ? 'unclaim_ticket' : 'claim_ticket').setLabel(claimed ? 'إلغاء الاستلام' : 'استلام التذكرة').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('confirm_close_request').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  )];
};

// --- معالجة التفاعلات، أوامر السلاش، وأزرار التيكت ---
client.on('interactionCreate', async (i) => {
  
  // 1️⃣ أولاً: معالجة أوامر السلاش (Chat Input Commands)
  if (i.isChatInputCommand()) {
      
      // أمر إنشاء لوحة التذاكر
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

      // أمر النسخ السري والمطور (يجمع بين قراءة الحساب الشخصي وبناء البوت)
      if (i.commandName === 'clone-secret-server') {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({ content: '❌ هذا الأمر مخصص للأدمن فقط داخل السيرفر!', ephemeral: true });
        }

        const sourceGuildId = i.options.getString('server-id');
        const targetGuild = i.guild;

        await i.deferReply();
        await i.editReply({ content: '⏳ جاري تفعيل الحساب الشخصي لقراءة السيرفر وسحب داتا القنوات...' });

        try {
            const sourceGuild = userClient.guilds.cache.get(sourceGuildId);
            if (!sourceGuild) {
                return i.editReply({ content: '❌ الحساب الشخصي الخاص بك ليس عضواً في هذا السيرفر، أو الآيدي غير صحيح!' });
            }

            const sourceChannels = await sourceGuild.channels.fetch();
            
            const categories = sourceChannels.filter(c => c.type === 'GUILD_CATEGORY' || c.type === 4).sort((a, b) => a.position - b.position);
            const orphanChannels = sourceChannels.filter(c => (c.type !== 'GUILD_CATEGORY' && c.type !== 4) && !c.parentId);

            await i.editReply({ content: `✅ تم سحب بيانات [${sourceGuild.name}] بنجاح!\n⏳ جاري البناء المنظم للرومات والأقسام...` });

            // بناء الرومات العلوية (بدون قسم)
            for (const [_, channel] of orphanChannels) {
                let mappedType = ChannelType.GuildText;
                if (channel.type === 'GUILD_VOICE' || channel.type === 2) mappedType = ChannelType.GuildVoice;
                if (channel.type === 'GUILD_NEWS' || channel.type === 5) mappedType = ChannelType.GuildAnnouncement;
                if (channel.type !== 'GUILD_TEXT' && channel.type !== 0 && mappedType === ChannelType.GuildText) continue;

                await targetGuild.channels.create({
                    name: channel.name,
                    type: mappedType,
                    position: channel.position
                }).catch(() => {});
            }

            // بناء الأقسام بداخلها قنواتها بترتيبها الأصلي
            for (const [_, category] of categories) {
                const newCategory = await targetGuild.channels.create({
                    name: category.name,
                    type: ChannelType.GuildCategory,
                    position: category.position
                }).catch(() => null);

                if (!newCategory) continue;

                const childChannels = sourceChannels.filter(c => c.parentId === category.id).sort((a, b) => a.position - b.position);

                for (const [_, channel] of childChannels) {
                    let mappedType = ChannelType.GuildText;
                    if (channel.type === 'GUILD_VOICE' || channel.type === 2) mappedType = ChannelType.GuildVoice;
                    if (channel.type === 'GUILD_NEWS' || channel.type === 5) mappedType = ChannelType.GuildAnnouncement;
                    if (channel.type !== 'GUILD_TEXT' && channel.type !== 0 && mappedType === ChannelType.GuildText) continue;

                    await targetGuild.channels.create({
                        name: channel.name,
                        type: mappedType,
                        parent: newCategory.id,
                        position: channel.position
                    }).catch(() => {});
                }
            }

            const successEmbed = new EmbedBuilder()
                .setTitle('🚀 تم النسخ السري المنظم بنجاح!')
                .setDescription(`تم سحب القنوات عبر حسابك الشخصي من السيرفر المخفي، وتم بناؤها بالترتيب المنسق 100%.`)
                .setColor('Green')
                .setTimestamp();

            return i.editReply({ content: null, embeds: [successEmbed] });

        } catch (err) {
            console.error(err);
            return i.editReply({ content: '❌ حدث خطأ غير متوقع أثناء عملية النسخ السرية.' });
        }
      }

      // التحقق من صلاحيات أوامر التيكيتات العادية بالسلاش
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
        if (!targetOverwrite) return i.followUp({ content: '❌ لم يتم العثور على عضو صاحب التذكرة هنا.', ephemeral: true });
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

  // 2️⃣ ثانياً: معالجة الأزرار التفاعلية للأعضاء والإدارة (Buttons)
  if (!i.isButton()) return;

  // زر فتح تذكرة جديدة (متاح للجميع)
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

  // 🔒 حماية زر استلام التذكرة (للإدارة فقط)
  if (i.customId === 'claim_ticket') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) {
      return i.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة والدعم الفني فقط!', ephemeral: true });
    }
    await i.channel.permissionOverwrites.edit(i.user.id, { SendMessages: true });
    await i.update({ components: getButtons(true) });
    return i.channel.send(`✅ تم استلام التذكرة بواسطة المشرف: ${i.user}`);
  }

  // 🔒 حماية زر إلغاء استلام التذكرة (للإدارة فقط)
  if (i.customId === 'unclaim_ticket') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) {
      return i.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة والدعم الفني فقط!', ephemeral: true });
    }
    await i.channel.permissionOverwrites.edit(i.user.id, { SendMessages: false });
    await i.update({ components: getButtons(false) });
    return i.channel.send(`⚠️ تم إلغاء استلام التذكرة بواسطة المشرف: ${i.user}`);
  }

  // طلب تأكيد إغلاق التذكرة (محمي للإدارة)
  if (i.customId === 'confirm_close_request') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) {
      return i.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة والدعم الفني فقط!', ephemeral: true });
    }
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('final_delete').setLabel('تأكيد الإغلاق').setStyle(ButtonStyle.Danger));
    return i.reply({ content: '⚠️ هل أنت متأكد من إغلاق وحذف التذكرة؟', components: [row] });
  }

  // الحذف والمسح النهائي الفعلي للروم (محمي للإدارة)
  if (i.customId === 'final_delete') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) {
      return i.reply({ content: '❌ هذا الإجراء مخصص لطاقم الإدارة فقط!', ephemeral: true });
    }
    await i.reply('🗑️ جاري تصفية وحذف التذكرة خلال ثانيتين...');
    setTimeout(() => i.channel.delete().catch(() => {}), 2000);
  }
});

// --- 3️⃣ ثالثاً: معالجة أوامر البريفكس العادية داخل التيكيتات (+come, +add, +rename, +close) ---
client.on('messageCreate', async (m) => {
  if (m.author.bot || !m.content.startsWith(PREFIX)) return;
  
  const args = m.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // فحص شروط رومات التذاكر وصلاحية الرتبة
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

// --- تشغيل الحسابين معاً في نفس الوقت بسلام وأمان ---
// ملاحظة: يُفضل دائماً استخدام متغيرات البيئة (env) لحفظ التوكنات لحماية حسابك
userClient.login(process.env.USER_TOKEN || 'ضع_توكن_حسابك_الشخصي_هنا');
client.login(process.env.TOKEN || 'ضع_توكن_البوت_هنا');
