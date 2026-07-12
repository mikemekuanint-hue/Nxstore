require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  BOT_TOKEN: process.env.BOT_TOKEN,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  VERIFY_ET_API_KEY: process.env.VERIFY_ET_API_KEY,
  ADMIN_LOGS_CHANNEL_ID: process.env.ADMIN_LOGS_CHANNEL_ID
};
