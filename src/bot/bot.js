const { Telegraf, Markup } = require('telegraf');
const env = require('../config/env');
const LocalSession = require('telegraf-session-local');
const { getOrCreateUser } = require('../services/users');

const bot = new Telegraf(env.BOT_TOKEN);

// Initialize session middleware
bot.use((new LocalSession({ database: 'session_db.json' })).middleware());

// Main Menu Keyboard Definition
const mainMenuKeyboard = Markup.keyboard([
  ['🛒 Shop', '💳 Wallet'],
  ['📦 Orders', '👤 Profile'],
  ['🎧 Support', '⭐️ Reviews']
]).resize();

const supabase = require('../database/supabase');

bot.start(async (ctx) => {
  const referredBy = ctx.payload || null;
  const user = await getOrCreateUser(ctx, referredBy);
  if (user) {
      ctx.reply(`Welcome to Nexus Store, ${user.first_name}!\n\nPlease select an option from the menu below:`, mainMenuKeyboard);
  } else {
      ctx.reply('Welcome to Nexus Store! We had some trouble loading your profile. Please try again later.');
  }
});

const bcrypt = require('bcrypt');

bot.command('linkadmin', async (ctx) => {
    try {
        const parts = ctx.message.text.split(' ');
        if (parts.length !== 4) {
            return ctx.reply('Usage: /linkadmin <code> <username> <password>');
        }
        
        const [_, code, username, password] = parts;
        
        // Check code
        const { data: settingsData } = await supabase.from('settings').select('key, value');
        const codeSetting = settingsData.find(s => s.key === 'telegram_link_code');
        if (!codeSetting || codeSetting.value !== code) {
            return ctx.reply('❌ Invalid or expired link code.');
        }

        // Check admin credentials
        const dbUsername = settingsData.find(s => s.key === 'admin_username')?.value;
        const dbPasswordHash = settingsData.find(s => s.key === 'admin_password_hash')?.value;

        if (username !== dbUsername) {
            return ctx.reply('❌ Invalid admin credentials.');
        }
        
        const match = await bcrypt.compare(password, dbPasswordHash);
        if (!match) {
            return ctx.reply('❌ Invalid admin credentials.');
        }

        // Save Chat ID
        await supabase.from('settings').upsert({ key: 'admin_telegram_chat_id', value: ctx.chat.id.toString() }, { onConflict: 'key' });
        
        // Delete the used code
        await supabase.from('settings').delete().eq('key', 'telegram_link_code');
        
        ctx.reply('✅ Successfully linked this chat as the Admin Notification Channel!');
        // Delete the message containing the password if possible
        try {
            await ctx.deleteMessage();
        } catch(e) {}
    } catch (e) {
        console.error(e);
        ctx.reply('❌ An error occurred during linking.');
    }
});

const { setupShopActions, showCatalog } = require('./actions/shop');
const setupWalletActions = require('./actions/wallet');

// Initialize Actions
setupShopActions(bot);
setupWalletActions(bot);

// Maintenance Mode Middleware
bot.use(async (ctx, next) => {
    try {
        const { data: maintSetting } = await supabase.from('settings').select('value').eq('key', 'maintenance_mode').single();
        const { data: adminChatId } = await supabase.from('settings').select('value').eq('key', 'admin_telegram_chat_id').single();
        
        const isMaintenance = maintSetting && maintSetting.value === 'true';
        const isAdmin = adminChatId && ctx.chat && ctx.chat.id.toString() === adminChatId.value;

        // If maintenance is on, block non-admin users from everything except specific allowed commands
        if (isMaintenance && !isAdmin) {
            // Check if it's a command that should always be allowed? The user didn't specify, just that admin can post.
            return ctx.reply('⚙️ The bot is currently under maintenance. Please check back later.');
        }
    } catch(e) {}
    
    return next();
});

// Admin Broadcast Command
bot.command('broadcast', async (ctx) => {
    const { data: adminChatId } = await supabase.from('settings').select('value').eq('key', 'admin_telegram_chat_id').single();
    if (!adminChatId || ctx.chat.id.toString() !== adminChatId.value) return;

    const message = ctx.message.text.replace('/broadcast ', '').trim();
    if (!message || message === '/broadcast') return ctx.reply('Usage: /broadcast <message>');

    const { data: users } = await supabase.from('users').select('telegram_id');
    if (!users) return ctx.reply('No users found.');

    let successCount = 0;
    for (const user of users) {
        try {
            await ctx.telegram.sendMessage(user.telegram_id, `📣 *Announcement*\n\n${message}`, { parse_mode: 'Markdown' });
            successCount++;
        } catch(e) {}
    }
    ctx.reply(`✅ Broadcast sent to ${successCount}/${users.length} users.`);
});

// Admin Send Direct Message
bot.command('send', async (ctx) => {
    const { data: adminChatId } = await supabase.from('settings').select('value').eq('key', 'admin_telegram_chat_id').single();
    if (!adminChatId || ctx.chat.id.toString() !== adminChatId.value) return;

    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) return ctx.reply('Usage: /send <user_telegram_id> <message>');

    const userId = parts[1];
    const message = parts.slice(2).join(' ');

    try {
        await ctx.telegram.sendMessage(userId, `💬 *Message from Admin*\n\n${message}`, { parse_mode: 'Markdown' });
        ctx.reply(`✅ Message sent to ${userId}.`);
    } catch(e) {
        ctx.reply(`❌ Failed to send message to ${userId}. They might have blocked the bot.`);
    }
});

// Routing for main menu buttons
bot.hears('🛒 Shop', async (ctx) => {
    showCatalog(ctx, false).catch(() => {});
});

bot.hears('💳 Wallet', async (ctx) => {
    const user = await getOrCreateUser(ctx);
    if (!user) return ctx.reply('Error loading wallet.');
    
    ctx.reply(`🟢 **Your Digital Wallet**\n\nBalance: ${user.wallet_balance} ETB\n\nSelect an action:`, 
        Markup.inlineKeyboard([
            [Markup.button.callback('Deposit Funds', 'action_deposit')]
        ])
    );
});

bot.hears('📦 Orders', (ctx) => {
    ctx.reply('Your order history is currently empty.');
});

bot.hears('👤 Profile', async (ctx) => {
    const user = await getOrCreateUser(ctx);
    if (!user) return ctx.reply('Error loading profile.');
    
    // Fetch referral count
    const { count: referralCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', user.telegram_id);
    
    const botInfo = await ctx.telegram.getMe();
    const referralLink = `https://t.me/${botInfo.username}?start=${user.telegram_id}`;
    
        ctx.reply(
            `👤 Profile\n\n` +
            `Name: ${user.first_name}\n` +
            `ID: ${user.telegram_id}\n` +
            `Registered: ${new Date(user.registered_at).toLocaleDateString()}\n\n` +
            `🎁 Referral Program\n` +
            `You have referred ${referralCount || 0} users.\n\n` +
            `Share your referral link to earn rewards:\n${referralLink}`
        );
    });

    bot.hears('🎧 Support', (ctx) => {
        ctx.reply('Need help? Contact our support team: @NexusSupportAdmin');
    });

    bot.hears('⭐️ Reviews', async (ctx) => {
        // Since the channel is public, we can link directly to it.
        // We use the ID format or invite link if necessary, but since they want direct:
        ctx.reply('Check out our customer reviews here: https://t.me/c/1003810274567');
    });

    // Handle Auto-Verification References
    bot.on('text', async (ctx, next) => {
        if (ctx.session && (ctx.session.awaitingAutoReference || ctx.session.awaitingAutoOrderReference)) {
            const isDeposit = !!ctx.session.awaitingAutoReference;
            const expectedAmount = isDeposit ? ctx.session.awaitingAutoReference : null;
            const productId = !isDeposit ? ctx.session.awaitingAutoOrderReference : null;
            const reference = ctx.message.text.trim();
            const user = await getOrCreateUser(ctx);

            ctx.reply('⏳ Verifying your transaction...');

            try {
                // 1. Check for Duplicate Reference in DB
                const { data: depDups } = await supabase.from('deposit_requests').select('id').eq('metadata->>reference', reference);
                const { data: ordDups } = await supabase.from('orders').select('id').eq('metadata->>reference', reference);
                if ((depDups && depDups.length > 0) || (ordDups && ordDups.length > 0)) {
                    return ctx.reply('❌ Verification Failed.\n\nThis reference number has already been used.');
                }

                // 2. Fetch configured banks
                const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'payment_methods').single();
                let banks = [{ bank: 'Telebirr', accountName: 'Nahom Mekuanint', accountNumber: '251901585028' }];
                if (settingsData && settingsData.value) {
                    try { banks = JSON.parse(settingsData.value); } catch(e){}
                }

                // 3. Loop through banks and try to verify
                let verifiedData = null;
                let matchedBank = null;

                for (const bankObj of banks) {
                    const verifyRes = await fetch('https://verify.et/api/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-api-key': env.VERIFY_ET_API_KEY },
                        body: JSON.stringify({ reference: reference })
                    });
                    
                    const verifyData = await verifyRes.json();
                    
                    if (verifyData && verifyData.matched === true) {
                        // Check if receiverName matches (case-insensitive)
                        const apiReceiver = (verifyData.receiverName || verifyData.transaction?.receiverName || '').toLowerCase().trim();
                        const configuredName = bankObj.accountName.toLowerCase().trim();
                        
                        if (apiReceiver === configuredName || apiReceiver.includes(configuredName) || configuredName.includes(apiReceiver)) {
                            verifiedData = verifyData;
                            matchedBank = bankObj;
                            break; // Stop looking, we found a match
                        }
                    }
                }

                if (!verifiedData) {
                    return ctx.reply('❌ Verification Failed.\n\nWe could not find a matching transaction, or it was not sent to the correct configured account. Please ensure you sent it to one of our active accounts.');
                }

                const actualAmount = verifiedData.amount || verifiedData.transaction?.amount;

                // --- Handle Deposit ---
                if (isDeposit) {
                    if (Number(actualAmount) < Number(expectedAmount)) {
                        return ctx.reply(`❌ Verification Failed.\n\nYou sent ${actualAmount} ETB, but expected ${expectedAmount} ETB.`);
                    }

                    const newBalance = Number(user.wallet_balance) + Number(actualAmount);
                    await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', user.id);

                    await supabase.from('deposit_requests').insert([{
                        user_id: user.id, amount: actualAmount, status: 'approved',
                        metadata: { reference: reference, method: 'verify_et_auto', bank: matchedBank.bank }
                    }]);

                    ctx.session.awaitingAutoReference = null;
                    return ctx.reply(`✅ Deposit Successful!\n\nYour transaction of ${actualAmount} ETB to ${matchedBank.bank} was verified. Your new balance is ${newBalance.toFixed(2)} ETB.`);
                } 
                
                // --- Handle Product Purchase ---
                else {
                    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
                    if (!product) return ctx.reply('Product not found.');

                    if (Number(actualAmount) < Number(product.price)) {
                        return ctx.reply(`❌ Verification Failed.\n\nYou sent ${actualAmount} ETB, but the product costs ${product.price} ETB.`);
                    }

                    // Create pending order
                    const { data: order, error: ordError } = await supabase.from('orders').insert([{
                        user_id: user.id, product_id: product.id, status: 'pending', amount: actualAmount,
                        metadata: { reference: reference, method: 'verify_et_auto', bank: matchedBank.bank }
                    }]).select().single();

                    if (ordError) {
                        return ctx.reply('❌ Error creating order. Please contact support.');
                    }

                    // Deduct stock
                    if (product.stock > 0) {
                        await supabase.from('products').update({ stock: product.stock - 1 }).eq('id', product.id);
                    }

                    ctx.session.awaitingAutoOrderReference = null;
                    
                    let successMessage = `✅ Payment Verified!\n\nYou have purchased ${product.name} for ${actualAmount} ETB via ${matchedBank.bank}.\n\n`;
                    if (product.installation_guide) successMessage += `📘 Installation/Usage Guide:\n${product.installation_guide}\n\n`;
                    successMessage += `Your order is now Pending Delivery. The admin has been notified.`;
                    ctx.reply(successMessage);

                    // Notify Admin
                    let adminChatId = env.ADMIN_LOGS_CHANNEL_ID;
                    const { data: adminChatSet } = await supabase.from('settings').select('value').eq('key', 'admin_telegram_chat_id').single();
                    if (adminChatSet && adminChatSet.value) adminChatId = adminChatSet.value;

                    if (adminChatId) {
                        ctx.telegram.sendMessage(adminChatId, `🛒 Auto-Verified Order!\n\n👤 User: ${user.first_name}\n📦 Product: ${product.name}\n💰 Amount: ${actualAmount} ETB\n🏦 Bank: ${matchedBank.bank}\n🔖 Reference: \`${reference}\`\n\nPlease deliver via Admin Panel.`);
                    }
                }
            } catch (err) {
                console.error('Verify.et Error:', err);
                return ctx.reply('⚠️ There was a problem contacting the verification server. Please try again later.');
            }
        } else {
            return next();
        }
    });

    // Handle Photo Uploads for Receipts
    bot.on('photo', async (ctx) => {
        if (ctx.session && ctx.session.awaitingReceipt) {
            const amount = ctx.session.depositAmount;
            const user = await getOrCreateUser(ctx);
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            
            // 1. Save deposit request to DB
            const { data: request, error } = await supabase.from('deposit_requests').insert([{
                user_id: user.id,
                amount: amount,
                receipt_file_id: fileId,
                status: 'pending'
            }]).select().single();

            if (error || !request) {
                console.error(error);
                return ctx.reply('❌ Failed to process your receipt. Please try again or contact support.');
            }

            // 2. Clear Session
            ctx.session.awaitingReceipt = false;
            ctx.session.depositAmount = null;

            // 3. Notify User
            ctx.reply('✅ Receipt Received!\n\nYour deposit request has been sent to the admins for manual verification. You will be notified once it is approved.');

            // 4. Forward to Admin Channel with Inline Buttons
            let adminChatId = env.ADMIN_LOGS_CHANNEL_ID;
            const { data: adminChatSet } = await supabase.from('settings').select('value').eq('key', 'admin_telegram_chat_id').single();
            if (adminChatSet && adminChatSet.value) adminChatId = adminChatSet.value;

            if (adminChatId) {
                await ctx.telegram.sendPhoto(adminChatId, fileId, {
                    caption: `💳 Manual Deposit Request\n\n👤 User: ${user.first_name} (@${user.username || 'N/A'})\n🆔 Telegram ID: \`${user.telegram_id}\`\n💰 Amount: ${amount} ETB\n🔖 Request ID: \`${request.id}\``,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('✅ Approve', `admin_approve_dep_${request.id}`),
                                Markup.button.callback('❌ Reject', `admin_reject_dep_${request.id}`)
                            ]
                        ]
                    }
                });
            }
        } else if (ctx.session && ctx.session.awaitingOrderReceipt) {
            const productId = ctx.session.awaitingOrderReceipt;
            const user = await getOrCreateUser(ctx);
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

            // Fetch product to get amount
            const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
            if (!product) return ctx.reply('Product not found.');

            // Create Order with pending_payment status
            const { data: order, error } = await supabase.from('orders').insert([{
                user_id: user.id,
                product_id: product.id,
                status: 'pending_payment',
                amount: product.price
            }]).select().single();

            if (error || !order) {
                console.error(error);
                return ctx.reply('❌ Failed to process your receipt. Please try again.');
            }

            // Clear Session
            ctx.session.awaitingOrderReceipt = null;

            ctx.reply('✅ Receipt Received!\n\nYour purchase request has been sent to the admins for manual verification. You will be notified and receive your item once it is approved.');

            let adminChatId = env.ADMIN_LOGS_CHANNEL_ID;
            const { data: adminChatSet } = await supabase.from('settings').select('value').eq('key', 'admin_telegram_chat_id').single();
            if (adminChatSet && adminChatSet.value) adminChatId = adminChatSet.value;

            if (adminChatId) {
                await ctx.telegram.sendPhoto(adminChatId, fileId, {
                    caption: `📦 Direct Purchase Receipt\n\n👤 User: ${user.first_name} (@${user.username || 'N/A'})\n🆔 Telegram ID: \`${user.telegram_id}\`\n🛒 Item: ${product.name}\n💰 Amount: ${product.price} ETB\n🔖 Order ID: \`${order.id}\``,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('✅ Approve & Deliver', `admin_approve_ord_${order.id}`),
                                Markup.button.callback('❌ Reject', `admin_reject_ord_${order.id}`)
                            ]
                        ]
                    }
                });
            }
        } else {
            ctx.reply('Please use the Wallet menu if you want to make a deposit, or the Shop to buy an item!');
        }
    });

    // Admin Approval Actions
    bot.action(/admin_approve_dep_(.+)/, async (ctx) => {
        const requestId = ctx.match[1];
        
        // 1. Update Request
        const { data: request, error: reqError } = await supabase.from('deposit_requests')
            .update({ status: 'approved' })
            .eq('id', requestId)
            .eq('status', 'pending')
            .select('*, users(*)')
            .single();
            
        if (reqError || !request) return ctx.answerCbQuery('Request already processed or error occurred.', { show_alert: true });

        // 2. Credit Wallet
        const newBalance = Number(request.users.wallet_balance) + Number(request.amount);
        await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', request.user_id);

        // 3. Notify Admin & Edit Message
        ctx.editMessageCaption(`✅ Deposit Approved\n\nAmount: ${request.amount} ETB\nUser: ${request.users.first_name}\n\n*Approved by Admin.*`);
        
        // 4. Notify User
        try {
            await ctx.telegram.sendMessage(request.users.telegram_id, `🎉 Deposit Approved!\n\nYour manual deposit of ${request.amount} ETB has been approved.\nYour new balance is: ${newBalance} ETB.`);
        } catch (e) {
            console.error('Could not notify user:', e);
        }
    });

    bot.action(/admin_reject_dep_(.+)/, async (ctx) => {
        const requestId = ctx.match[1];
        
        // 1. Update Request
        const { data: request, error: reqError } = await supabase.from('deposit_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId)
            .eq('status', 'pending')
            .select('*, users(*)')
            .single();
            
        if (reqError || !request) return ctx.answerCbQuery('Request already processed or error occurred.', { show_alert: true });

        // 2. Notify Admin & Edit Message
        ctx.editMessageCaption(`❌ Deposit Rejected\n\nAmount: ${request.amount} ETB\nUser: ${request.users.first_name}\n\n*Rejected by Admin.*`);
        
        // 3. Notify User
        try {
            await ctx.telegram.sendMessage(request.users.telegram_id, `❌ Deposit Rejected\n\nYour manual deposit request for ${request.amount} ETB was declined. Please ensure you sent the correct receipt or contact Support.`);
        } catch (e) {
            console.error('Could not notify user:', e);
        }
    });

    bot.action(/admin_approve_ord_(.+)/, async (ctx) => {
        const orderId = ctx.match[1];
        
        const { data: order, error: ordError } = await supabase.from('orders')
            .update({ status: 'pending' }) // Admin will fulfill it later, or it implies "payment verified"
            .eq('id', orderId)
            .eq('status', 'pending_payment')
            .select('*, users(*), products(*)')
            .single();
            
        if (ordError || !order) return ctx.answerCbQuery('Order already processed or error occurred.', { show_alert: true });

        // Deduct stock
        if (order.products.stock > 0) {
            await supabase.from('products').update({ stock: order.products.stock - 1 }).eq('id', order.product_id);
        }

        ctx.editMessageCaption(`✅ Payment Approved\n\nItem: ${order.products.name}\nUser: ${order.users.first_name}\n\n*Payment verified. Order is now Pending Delivery.*`);
        
        try {
            let successMessage = `🎉 Payment Verified!\n\nYour payment for ${order.products.name} has been approved.\n\n`;
            if (order.products.installation_guide) {
                successMessage += `📘 Installation/Usage Guide:\n${order.products.installation_guide}\n\n`;
            }
            successMessage += `Your order will be delivered shortly.`;
            await ctx.telegram.sendMessage(order.users.telegram_id, successMessage);
        } catch (e) {
            console.error('Could not notify user:', e);
        }
    });

    bot.action(/admin_reject_ord_(.+)/, async (ctx) => {
        const orderId = ctx.match[1];
        
        const { data: order, error: ordError } = await supabase.from('orders')
            .update({ status: 'cancelled' })
            .eq('id', orderId)
            .eq('status', 'pending_payment')
            .select('*, users(*), products(*)')
            .single();
            
        if (ordError || !order) return ctx.answerCbQuery('Order already processed or error occurred.', { show_alert: true });

        ctx.editMessageCaption(`❌ Payment Rejected\n\nItem: ${order.products.name}\nUser: ${order.users.first_name}\n\n*Rejected by Admin.*`);
        
        try {
            await ctx.telegram.sendMessage(order.users.telegram_id, `❌ Payment Rejected\n\nYour receipt for ${order.products.name} was declined. Please try again or contact support.`);
        } catch (e) {
            console.error('Could not notify user:', e);
        }
    });

module.exports = bot;
