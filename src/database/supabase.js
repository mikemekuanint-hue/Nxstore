const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');

// Initialize the Supabase client
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

module.exports = supabase;
