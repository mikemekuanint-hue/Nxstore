const env = require('../config/env');

const logToAdminChannel = async (bot, message) => {
    if (env.ADMIN_LOGS_CHANNEL_ID) {
        try {
            await bot.telegram.sendMessage(env.ADMIN_LOGS_CHANNEL_ID, `🔔 **System Log:**\n\n${message}`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Failed to send message to admin channel:', error);
        }
    } else {
        console.log(`[Admin Log Required but Channel ID missing]: ${message}`);
    }
};

module.exports = {
    logToAdminChannel
};
