require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  BOT_TOKEN: process.env.BOT_TOKEN || '8750794198:AAFldGbwVTO0nilWq38OG59wNJVRvCEKX0g',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://ljreizqoivlnuynsmoej.supabase.co',
  SUPABASE_KEY: process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqcmVpenFvaXZsbnV5bnNtb2VqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzc2ODgwNiwiZXhwIjoyMDk5MzQ0ODA2fQ.DKTvJqdI4xRRFVda9OXz2WXml2WaGjPNtxZG7dUKJyc',
  VERIFY_ET_API_KEY: process.env.VERIFY_ET_API_KEY || 'VERIFY_BANK_ET_eBO28cTqbjPpLqOlxx67454iG66Qpe8mKT_ZyvLMUxtfj6ARG0rudhTYsnlkxQDy',
  ADMIN_LOGS_CHANNEL_ID: process.env.ADMIN_LOGS_CHANNEL_ID || '-1003810274567'
};
