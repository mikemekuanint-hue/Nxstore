const supabase = require('./src/database/supabase');
const bcrypt = require('bcrypt');

async function setupAdmin() {
    const username = 'admin';
    const password = 'password123';
    
    console.log('Hashing password...');
    const hash = await bcrypt.hash(password, 10);
    
    console.log('Inserting into settings...');
    
    // Insert username
    await supabase.from('settings').upsert([
        { key: 'admin_username', value: username, description: 'Admin Login Username' }
    ], { onConflict: 'key' });
    
    // Insert password hash
    await supabase.from('settings').upsert([
        { key: 'admin_password_hash', value: hash, description: 'Admin Login Password Hash' }
    ], { onConflict: 'key' });
    
    console.log('Admin account created! Username: admin, Password: password123');
}

setupAdmin().catch(console.error);
