const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`تم تشغيل البوت بنجاح باسم ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
  // التجاهل إذا كان مرسل الرسالة هو البوت نفسه
  if (message.author.bot) return;

  // فحص كلمة ping سواء كانت حروف كبيرة أو صغيرة
  if (message.content.toLowerCase() === 'ping') {
    message.reply('pong! 🏓');
  }
});

client.login(process.env.TOKEN);
