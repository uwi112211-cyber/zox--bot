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
  SlashCommandBuilder,
  PermissionFlagsBits 
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildMembers
  ],
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

// --- تسجيل جميع أوامر السلاش عند جاهزية البوت ---
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} جاهز بالإعدادات الجديدة!`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    // تعريف الأوامر الأربعة للسلاش (تم إضافة أمر النسخ هنا)
    const commands = [
        new SlashCommandBuilder().setName('setup-ticket').setDescription('إعداد الدعم الفني'),
        new SlashCommandBuilder().setName('nuke-channels').setDescription('تصفية وحذف جميع قنوات السيرفر'),
        new SlashCommandBuilder().setName('nuke-roles').setDescription('تصفية وحذف جميع رتب السيرفر'),
        new SlashCommandBuilder()
            .setName('clone-server')
            .setDescription('نسخ الأقسام والرومات مع كامل صلاحياتها ونقلها هنا (للأدمن فقط)')
            .addStringOption(option => 
                option.setName('server-id')
                      .setDescription('ضع آيدي السيرفر الذي تريد نسخ الرومات وصلاحياتها منه')
                      .setRequired(true)
            )
    ].map(c => c.toJSON());
    
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        console.log('✅ تم تسجيل جميع أوامر السلاش بنجاح!');
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

// --- وظيفة مساعدة لتحويل وحساب صلاحيات الرومات من السيرفر القديم للجديد ---
function calculatePermissions(sourceChannel, targetGuild) {
  const newOverwrites = [];

  sourceChannel.permissionOverwrites.cache.forEach(overwrite => {
    // رتبة الجميع @everyone
    if (overwrite.id === sourceChannel.guild.roles.everyone.id) {
      newOverwrites.push({
        id: targetGuild.roles.everyone.id,
        allow: overwrite.allow.toArray(),
        deny: overwrite.deny.toArray()
      });
    } else {
      // الرتب المخصصة (تعتمد على تطابق اسم الرتبة في السيرفرين)
      const sourceRole = sourceChannel.guild.roles.cache.get(overwrite.id);
      if (sourceRole) {
        const targetRole = targetGuild.roles.cache.find(r => r.name === sourceRole.name);
        if (targetRole) {
          newOverwrites.push({
            id: targetRole.id,
            allow: overwrite.allow.toArray(),
            deny: overwrite.deny.toArray()
          });
        }
      }
    }
  });

  return newOverwrites;
}

// --- معالجة التفاعلات وأوامر السلاش وازرار التيكت ---
client.on('interactionCreate', async (i) => {
  
  // 1. أوامر السلاش (Chat Input Commands)
  if (i.isChatInputCommand()) {
      
      // أمر إعداد التيكت
      if (i.commandName === 'setup-ticket') {
        const embed = new EmbedBuilder().setTitle('الدعم الفني ☄️').setDescription('__يرجى عدم الاستهبال بفتح التيكت__\n\n__مراجعة القوانين <#1490688479527440534>__').setColor('#5865F2');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setStyle(ButtonStyle.Secondary).setEmoji('🎫'));
        await i.reply({ content: '✅ تم الإرسال', ephemeral: true });
        return i.channel.send({ embeds: [embed], components: [row] });
      }

      // أمر حذف جميع القنوات
      if (i.commandName === 'nuke-channels') {
          if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
              return i.reply({ content: '❌ لازم تكون إداري عشان تشغل هالأمر القوي!', ephemeral: true });
          }
          await i.reply('⚠️ جاري تصفية جميع القنوات...');
          return i.guild.channels.cache.forEach(channel => channel.delete().catch(() => {}));
      }

      // أمر حذف جميع الرتب
      if (i.commandName === 'nuke-roles') {
          if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
              return i.reply({ content: '❌ لازم تكون إداري عشان تشغل هالأمر القوي!', ephemeral: true });
          }
          await i.reply('⚠️ جاري تصفية جميع الرتب (الرولات) من السيرفر...');
          return i.guild.roles.cache.forEach(role => {
              if (role.id !== i.guild.id && !role.managed) {
                  role.delete().catch(() => {});
              }
          });
      }

      // 🔄 أمر نسخ ونقل السيرفر الذكي مع الصلاحيات
      if (i.commandName === 'clone-server') {
          // قفل الأمر للأدمن فقط
          if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
              return i.reply({ content: '❌ | هذا الأمر مخصص فقط للأعضاء الذين يمتلكون صلاحية الإدارة العليا (Administrator)!', ephemeral: true });
          }

          const sourceGuildId = i.options.getString('server-id');
          const targetGuild = i.guild;

          const sourceGuild = client.guilds.cache.get(sourceGuildId);
          if (!sourceGuild) {
              return i.reply({ content: '❌ | لم أتمكن من العثور على السيرفر المصدر. تأكد من وجود البوت في السيرفرين معاً!', ephemeral: true });
          }

          await i.deferReply();
          await i.editReply({ content: '⏳ | جاري بدء النسخ الذكي للرومات مع كامل صلاحياتها وأذوناتها... يرجى الانتظار.' });

          try {
              const sourceChannels = await sourceGuild.channels.fetch();
              
              const categories = sourceChannels.filter(c => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
              const remainingChannels = sourceChannels.filter(c => c.type !== ChannelType.GuildCategory);

              const categoryMap = new Map();

              // 1. نسخ الكاتيجوري مع صلاحياتها
              for (const [_, category] of categories) {
                  const permissionOverwrites = calculatePermissions(category, targetGuild);
                  const newCategory = await targetGuild.channels.create({
                      name: category.name,
                      type: ChannelType.GuildCategory,
                      position: category.position,
                      permissionOverwrites: permissionOverwrites
                  });
                  categoryMap.set(category.id, newCategory.id);
              }

              // 2. نسخ الرومات (كتابي وصوتي) ووضعها بالأقسام والصلاحيات الصحيحة
              for (const [_, channel] of remainingChannels) {
                  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildAnnouncement) continue;

                  const parentId = channel.parentId ? categoryMap.get(channel.parentId) : null;
                  const permissionOverwrites = calculatePermissions(channel, targetGuild);

                  await targetGuild.channels.create({
                      name: channel.name,
                      type: channel.type,
                      parent: parentId,
                      position: channel.position,
                      permissionOverwrites: permissionOverwrites
                  });
              }

              const successEmbed = new EmbedBuilder()
                  .setTitle('✅ تم نسخ السيرفر بالكامل!')
                  .setDescription(`قام المسؤول ${i.user} بنسخ جميع الأقسام والرومات مع نقل كافة الأذونات والصلاحيات بدقة.`)
                  .addFields(
                      { name: 'من سيرفر', value: `\`${sourceGuild.name}\``, inline: true },
                      { name: 'إلى سيرفر', value: `\`${targetGuild.name}\``, inline: true }
                  )
                  .setColor('Green')
                  .setTimestamp();

              return i.editReply({ content: null, embeds: [successEmbed] });

          } catch (err) {
              console.error(err);
              return i.editReply({ content: '❌ | حدث خطأ أثناء النقل. تأكد من أن رتبة البوت أدمن وهي أعلى رتبة بالسيرفرين.' });
          }
      }
  }

  // 2. معالجة أزرار التيكيتات
  if (!i.isButton()) return;

  if (i.customId === 'open_ticket') {
    const channel = await i.guild.channels.create({
      name: `تذكرة-${i.user.username}`,
      type: ChannelType.GuildText,
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
    await channel.send({ content: `أهلاً ${i.user}، انتظر الرد. ${mns}`, components: getButtons(false) });
    return i.reply({ content: `تم فتح تذكرتك: ${channel}`, ephemeral: true });
  }

  if (i.customId === 'claim_ticket') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) return i.reply({ content: 'للإدارة فقط', ephemeral: true });
    await i.channel.permissionOverwrites.edit(i.user.id, { SendMessages: true });
    await i.update({ components: getButtons(true) });
    return i.channel.send(`✅ تم استلام التذكرة بواسطة ${i.user}`);
  }

  if (i.customId === 'unclaim_ticket') {
    if (!STAFF_ROLES.some(r => i.member.roles.cache.has(r))) return i.reply({ content: 'للإدارة فقط', ephemeral: true });
    await i.channel.permissionOverwrites.edit(i.user.id, { SendMessages: false });
    await i.update({ components: getButtons(false) });
    return i.channel.send(`⚠️ تم إلغاء استلام التذكرة بواسطة ${i.user}`);
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

// --- أوامر البريفكس العادية داخل التيكيتات (+come, +add, +rename) ---
client.on('messageCreate', async (m) => {
  if (m.author.bot || !m.content.startsWith(PREFIX)) return;
  const args = m.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (!m.channel.name.includes('تذكرة-')) return;
  if (!STAFF_ROLES.some(r => m.member.roles.cache.has(r))) return;

  if (cmd === 'come') {
    m.delete();
    m.channel.send(`يا <@${m.channel.permissionOverwrites.cache.filter(p => p.type === 1).first()?.id}>، الإدارة تطلب حضورك هنا!`);
  }

  if (cmd === 'add') {
    const user = m.mentions.users.first() || m.guild.members.cache.get(args[0]);
    if (!user) return m.reply('❌ منشن العضو أو حط الآيدي');
    await m.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, AttachFiles: true });
    m.reply(`✅ تم إضافة ${user} للتذكرة.`);
  }

  if (cmd === 'rename') {
    if (!args[0]) return m.reply('❌ اكتب الاسم الجديد');
    await m.channel.setName(`تذكرة-${args[0]}`);
    m.reply('✅ تم تغيير الاسم.');
  }
});

client.login(process.env.TOKEN);
