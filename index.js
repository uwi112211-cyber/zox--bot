const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log('جاري مسح أوامر السلاش القديمة...');
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        // هذا السطر يمسح كل الأوامر العالمية (Global)
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        console.log('✅ تم مسح جميع الأوامر العالمية بنجاح!');
        console.log('انتظر دقيقة ثم ارجع حط كود البوت الأصلي.');
    } catch (error) {
        console.error(error);
    }
});

client.login(process.env.TOKEN);
