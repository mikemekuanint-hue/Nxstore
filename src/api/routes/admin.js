const express = require('express');
const router = express.Router();
const supabase = require('../../database/supabase');

// Middleware to check admin session
router.use((req, res, next) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// Get Dashboard Stats
router.get('/stats', async (req, res) => {
    try {
        const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: pendingOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { data: revenueData } = await supabase.from('orders').select('amount').eq('status', 'completed');
        
        let revenue = 0;
        if (revenueData) {
            revenue = revenueData.reduce((acc, order) => acc + Number(order.amount), 0);
        }

        res.json({
            users: usersCount || 0,
            pendingOrders: pendingOrders || 0,
            revenueToday: revenue
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get All Orders (for Orders page)
router.get('/orders', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`id, status, amount, created_at, users ( first_name, username ), products ( name )`)
            .order('created_at', { ascending: false });
        if (error) throw error;
        
        const orders = data.map(o => ({
            id: o.id,
            displayId: o.id.split('-')[0],
            customer: o.users ? (o.users.username || o.users.first_name) : 'Unknown',
            product: o.products ? o.products.name : 'Unknown',
            amount: o.amount,
            status: o.status,
            date: new Date(o.created_at).toLocaleString()
        }));
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Recent Orders (for Dashboard)
router.get('/orders/recent', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`id, status, amount, users ( first_name, username ), products ( name )`)
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (error) throw error;
        
        const orders = data.map(o => ({
            id: o.id,
            displayId: o.id.split('-')[0],
            customer: o.users ? (o.users.username || o.users.first_name) : 'Unknown',
            product: o.products ? o.products.name : 'Unknown',
            status: o.status
        }));
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deliver Order Endpoint
router.post('/orders/:id/deliver', async (req, res) => {
    const orderId = req.params.id;
    try {
        const { data: order, error: ordError } = await supabase.from('orders').select('*, users(*), products(*)').eq('id', orderId).single();
        if (ordError || !order) return res.status(404).json({ error: 'Order not found' });
        if (order.status === 'completed') return res.status(400).json({ error: 'Already delivered' });

        const { error: updError } = await supabase.from('orders').update({ status: 'completed', delivery_date: new Date() }).eq('id', orderId);
        if (updError) throw updError;

        try {
            const bot = require('../../bot/bot');
            let successMessage = `📦 Your Order has been Delivered!\n\nYour purchase of ${order.products.name} is complete.\n\n`;
            if (order.products.installation_guide) successMessage += `📘 Installation/Usage Guide:\n${order.products.installation_guide}\n\n`;
            await bot.telegram.sendMessage(order.users.telegram_id, successMessage);
        } catch (e) {
            console.error('Could not notify user via bot:', e);
        }
        res.json({ success: true, message: 'Order delivered.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Users
router.get('/users', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('*').order('registered_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Adjust User Balance
router.post('/users/:id/balance', async (req, res) => {
    try {
        const { amount } = req.body;
        const { data: user, error: uErr } = await supabase.from('users').select('wallet_balance, telegram_id').eq('id', req.params.id).single();
        if (uErr || !user) throw new Error('User not found');
        
        const newBalance = Number(user.wallet_balance) + Number(amount);
        const { error } = await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', req.params.id);
        if (error) throw error;
        
        try {
            const bot = require('../../bot/bot');
            const action = Number(amount) >= 0 ? 'credited to' : 'deducted from';
            await bot.telegram.sendMessage(user.telegram_id, `💰 Admin has ${action} your wallet by ${Math.abs(Number(amount))} ETB.\nNew Balance: ${newBalance} ETB`);
        } catch(e) {}
        
        res.json({ success: true, newBalance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Products
router.get('/products', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*').order('name');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add Product
router.post('/products', async (req, res) => {
    try {
        const { name, description, price, stock, installation_guide, auto_verify } = req.body;
        const { error } = await supabase.from('products').insert([{ name, description, price, stock, installation_guide, auto_verify: auto_verify || false, is_active: true }]);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Product
router.put('/products/:id', async (req, res) => {
    try {
        const { name, description, price, stock, installation_guide, is_active, auto_verify } = req.body;
        const { error } = await supabase.from('products').update({ name, description, price, stock, installation_guide, is_active, auto_verify: auto_verify || false }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Product
router.delete('/products/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('products').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Settings
router.get('/settings', async (req, res) => {
    try {
        const { data, error } = await supabase.from('settings').select('*');
        if (error) throw error;
        const settings = {};
        data.forEach(s => settings[s.key] = s.value);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Settings
router.post('/settings', async (req, res) => {
    try {
        const updates = req.body; // e.g. { payment_account_name: '...', payment_account_number: '...' }
        for (const [key, value] of Object.entries(updates)) {
            await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate Telegram Link Code
router.post('/telegram-link', async (req, res) => {
    try {
        // Generate a random 6 digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        // Save to settings
        await supabase.from('settings').upsert({ key: 'telegram_link_code', value: code }, { onConflict: 'key' });
        res.json({ code });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Broadcast Message
router.post('/broadcast', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const { data: users, error } = await supabase.from('users').select('telegram_id');
        if (error) throw error;
        
        let count = 0;
        const bot = require('../../bot/bot');
        for (const user of users) {
            try {
                await bot.telegram.sendMessage(user.telegram_id, `📣 *Announcement*\n\n${message}`, { parse_mode: 'Markdown' });
                count++;
            } catch (e) {
                // Ignore errors for individual users (e.g., blocked bot)
            }
        }
        
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
