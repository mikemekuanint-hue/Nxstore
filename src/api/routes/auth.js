const express = require('express');
const router = express.Router();
const supabase = require('../../database/supabase');
const bcrypt = require('bcrypt');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    try {
        // Fetch from settings table
        const { data: adminSettings, error } = await supabase.from('settings').select('key, value');
        
        if (error || !adminSettings) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        const dbUsername = adminSettings.find(s => s.key === 'admin_username')?.value;
        const dbPasswordHash = adminSettings.find(s => s.key === 'admin_password_hash')?.value;
        
        if (username !== dbUsername) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const isMatch = await bcrypt.compare(password, dbPasswordHash);
        
        if (isMatch) {
            const is2FA = adminSettings.find(s => s.key === 'admin_2fa_enabled')?.value === 'true';
            const adminChatId = adminSettings.find(s => s.key === 'admin_telegram_chat_id')?.value;

            if (is2FA && adminChatId) {
                // Generate OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                // Save OTP to DB temporarily
                await supabase.from('settings').upsert({ key: 'admin_current_otp', value: otp }, { onConflict: 'key' });
                
                // Send via Bot
                try {
                    const { Telegraf } = require('telegraf');
                    const env = require('../../config/env');
                    const bot = new Telegraf(env.BOT_TOKEN);
                    await bot.telegram.sendMessage(adminChatId, `🔐 *Admin Login OTP*\n\nYour one-time password is: \`${otp}\``, { parse_mode: 'Markdown' });
                } catch(e) {
                    console.error('Failed to send OTP:', e);
                    return res.status(500).json({ error: 'Failed to send OTP to Telegram.' });
                }

                return res.json({ success: true, requireOtp: true });
            }

            // No 2FA
            req.session.isAdmin = true;
            req.session.username = username;
            res.json({ success: true, requireOtp: false });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/verify-otp', async (req, res) => {
    const { username, otp } = req.body;
    try {
        const { data: settings } = await supabase.from('settings').select('key, value').in('key', ['admin_username', 'admin_current_otp']);
        const dbUsername = settings.find(s => s.key === 'admin_username')?.value;
        const dbOtp = settings.find(s => s.key === 'admin_current_otp')?.value;

        if (username === dbUsername && otp === dbOtp && otp) {
            // Success
            await supabase.from('settings').delete().eq('key', 'admin_current_otp'); // clear OTP
            req.session.isAdmin = true;
            req.session.username = username;
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid OTP' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/logout', (req, res) => {
    req.session = null;
    res.json({ success: true });
});

router.get('/me', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({ loggedIn: true, username: req.session.username });
    } else {
        res.json({ loggedIn: false });
    }
});

router.post('/change-password', async (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old and new passwords are required' });
    }

    try {
        const { data: adminSettings } = await supabase.from('settings').select('key, value');
        const dbPasswordHash = adminSettings.find(s => s.key === 'admin_password_hash')?.value;

        const isMatch = await bcrypt.compare(oldPassword, dbPasswordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect old password' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await supabase.from('settings').upsert({ key: 'admin_password_hash', value: newHash }, { onConflict: 'key' });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
