import TelegramBot from 'node-telegram-bot-api';

const token = '8505345900:AAHhopakfErouS3_WWW7IeQyKBxdTvhe0JI';
const bot = new TelegramBot(token, { polling: false });

console.log("🔍 Recherche de mises à jour Telegram...");

try {
    const updates = await bot.getUpdates();
    if (updates.length > 0) {
        console.log("✅ Updates trouvées :");
        updates.forEach(u => {
            if (u.message && u.message.chat) {
                console.log(`- Chat: ${u.message.chat.title || u.message.chat.username} | ID: ${u.message.chat.id} | Type: ${u.message.chat.type}`);
            }
            if (u.channel_post && u.channel_post.chat) {
                console.log(`- Channel: ${u.channel_post.chat.title} | ID: ${u.channel_post.chat.id}`);
            }
            if (u.my_chat_member && u.my_chat_member.chat) {
                 console.log(`- Chat Member Update: ${u.my_chat_member.chat.title} | ID: ${u.my_chat_member.chat.id}`);
            }
        });
    } else {
        console.log("⚠️ Aucune mise à jour trouvée. Assurez-vous d'avoir ajouté le bot au canal/groupe et envoyé un message.");
    }
} catch (error) {
    console.error("❌ Erreur:", error.message);
}
