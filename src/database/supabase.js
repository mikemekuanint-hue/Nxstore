const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');

let supabase = null;

try {
    if (env.SUPABASE_URL && env.SUPABASE_KEY) {
        supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    } else {
        console.warn('Supabase URL or Key is missing! Supabase will not be initialized.');
    }
} catch (error) {
    console.error('Failed to initialize Supabase client:', error);
}

module.exports = supabase || { 
    from: () => ({ 
        select: () => { throw new Error('Supabase is not configured. Please add SUPABASE_URL and SUPABASE_KEY to Environment Variables.'); },
        insert: () => { throw new Error('Supabase is not configured.'); },
        update: () => { throw new Error('Supabase is not configured.'); },
        upsert: () => { throw new Error('Supabase is not configured.'); },
        delete: () => { throw new Error('Supabase is not configured.'); }
    }) 
};
