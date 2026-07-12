const { Markup } = require('telegraf');
const supabase = require('../../database/supabase');
const { getOrCreateUser } = require('../../services/users');
const { logToAdminChannel } = require('../../utils/botLogger');

const showCatalog = async (ctx, isEdit = true) => {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .gt('stock', 0); // Hide out-of-stock items
        
        if (error) throw error;
        
        if (!products || products.length === 0) {
            const msg = 'The catalog is currently empty. Please check back later.';
            const keyboard = Markup.inlineKeyboard([[Markup.button.callback('« Back', 'action_back_main')]]);
            return isEdit ? ctx.editMessageText(msg, keyboard) : ctx.reply(msg, keyboard);
        }

        // Create buttons for products
        const buttons = products.map(p => {
            const stockIndicator = p.stock > 0 ? `🟢 ${p.stock} left` : `🔴 0 left`;
            return [Markup.button.callback(`${p.name} - ${p.price} ETB (${stockIndicator})`, `action_product_${p.id}`)];
        });
        
        // Remove the back button since we are triggering this directly from the main menu text command now,
        // but we can leave it for when people navigate back from a product.
        buttons.push([Markup.button.callback('« Close Catalog', 'action_close_catalog')]);
        
        const text = '🛒 Digital Marketplace\n\nSelect a product to view details:';
        const keyboard = Markup.inlineKeyboard(buttons);
        
        return isEdit ? ctx.editMessageText(text, keyboard) : ctx.reply(text, keyboard);
        
    } catch (err) {
        console.error(err);
        const msg = 'Error loading catalog.';
        return isEdit ? ctx.answerCbQuery(msg) : ctx.reply(msg);
    }
};

const setupShopActions = (bot) => {
    // Show catalog via callback
    bot.action('action_view_catalog', async (ctx) => {
        await showCatalog(ctx, true);
    });

    // View specific product details
    bot.action(/action_product_(.+)/, async (ctx) => {
        const productId = ctx.match[1];
        try {
            const { data: product, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (error || !product) throw new Error('Product not found');

            const stockText = product.stock > 0 ? `🟢 In Stock (${product.stock} available)` : `🔴 Out of Stock`;
            
            let buttons = [];
            if (product.stock > 0) {
                buttons.push([Markup.button.callback(`💳 Buy Now (${product.price} ETB)`, `action_buy_${product.id}`)]);
            }
            buttons.push([Markup.button.callback('🔙 Back to Catalog', 'action_view_catalog')]);

            ctx.editMessageText(
                `📦 ${product.name}\n\n` +
                `📝 Description: ${product.description || 'No description available.'}\n` +
                `💰 Price: ${product.price} ETB\n` +
                `📊 Status: ${stockText}`,
                Markup.inlineKeyboard(buttons)
            );
        } catch (err) {
            console.error(err);
            ctx.answerCbQuery('Error loading product.');
        }
    });

    // Handle Purchase Button (Show Payment Options)
    bot.action(/action_buy_(.+)/, async (ctx) => {
        const productId = ctx.match[1];
        try {
            const { data: product, error } = await supabase.from('products').select('*').eq('id', productId).single();
            if (error || !product) return ctx.answerCbQuery('Product not found.');
            if (product.stock <= 0) return ctx.answerCbQuery('Sorry, this product is out of stock!', { show_alert: true });

            ctx.editMessageText(
                `🛒 **Checkout: ${product.name}**\n\n` +
                `Amount due: **${product.price} ETB**\n\n` +
                `How would you like to pay?`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🧾 Upload Receipt', `action_pay_receipt_${product.id}`)],
                    [Markup.button.callback('💳 Pay with Wallet', `action_pay_wallet_${product.id}`)],
                    [Markup.button.callback('🔙 Cancel', `action_product_${product.id}`)]
                ])
            );
        } catch (err) {
            console.error(err);
            ctx.answerCbQuery('Error loading checkout.');
        }
    });

    // Handle Pay with Receipt
    bot.action(/action_pay_receipt_(.+)/, async (ctx) => {
        const productId = ctx.match[1];
        try {
            const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
            if (!product) return ctx.answerCbQuery('Product not found.');

            ctx.session ??= {};

            // Fetch account details from settings
            const { data: settingsData } = await supabase.from('settings').select('key, value').in('key', ['payment_methods']);
            let banks = [{ bank: 'Telebirr', accountName: 'Nahom Mekuanint', accountNumber: '251901585028' }];
            if (settingsData && settingsData.length > 0) {
                try { banks = JSON.parse(settingsData[0].value); } catch(e){}
            }

            let banksText = '';
            banks.forEach(b => {
                banksText += `🏦 ${b.bank}\n👤 Name: ${b.accountName}\n🔢 Number: ${b.accountNumber}\n\n`;
            });

            if (product.auto_verify) {
                ctx.session.awaitingAutoOrderReference = productId;
                ctx.editMessageText(
                    `💵 Payment — Auto-Verify\n` +
                    `📦 Item: ${product.name} × 1\n` +
                    `💵 Amount: ${product.price.toFixed(2)} ETB\n\n` +
                    `➿➿➿➿➿➿➿➿➿➿➿➿➿\n` +
                    `📤 Send exactly ${product.price.toFixed(2)} ETB to ANY of the following:\n\n` +
                    banksText +
                    `➿➿➿➿➿➿➿➿➿➿➿➿➿\n\n` +
                    `😀 Steps:\n` +
                    `1. Send ${product.price.toFixed(2)} ETB to an account above.\n` +
                    `2. **Reply to this message with your Transaction Reference Number (e.g. 7HGF4D...).**\n\n` +
                    `⚡ Your payment will be verified instantly!`,
                    Markup.inlineKeyboard([[Markup.button.callback('Cancel', `action_product_${product.id}`)]])
                );
            } else {
                ctx.session.awaitingOrderReceipt = productId;
                ctx.editMessageText(
                    `💵 Payment — Manual Verification\n` +
                    `📦 Item: ${product.name} × 1\n` +
                    `💵 Amount: ${product.price.toFixed(2)} ETB\n\n` +
                    `➿➿➿➿➿➿➿➿➿➿➿➿➿\n` +
                    `📤 Send exactly ${product.price.toFixed(2)} ETB to ANY of the following:\n\n` +
                    banksText +
                    `➿➿➿➿➿➿➿➿➿➿➿➿➿\n\n` +
                    `😀 Steps:\n` +
                    `1. Send ${product.price.toFixed(2)} ETB to an account above.\n` +
                    `2. **Upload a clear screenshot of your receipt here.**\n\n` +
                    `⚠️ An admin will manually verify this shortly.`,
                    Markup.inlineKeyboard([[Markup.button.callback('Cancel', `action_product_${product.id}`)]])
                );
            }
        } catch (err) {
            console.error(err);
            ctx.answerCbQuery('Error loading payment details.');
        }
    });

    // Handle Pay with Wallet
    bot.action(/action_pay_wallet_(.+)/, async (ctx) => {
        const productId = ctx.match[1];
        const user = await getOrCreateUser(ctx);
        if (!user) return ctx.answerCbQuery('Error loading user profile.');

        try {
            // 1. Fetch product again to ensure it's still in stock
            const { data: product, error: prodError } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (prodError || !product) return ctx.answerCbQuery('Product not found.');
            if (product.stock <= 0) return ctx.answerCbQuery('Sorry, this product is out of stock!', { show_alert: true });

            // 2. Check user balance
            if (user.wallet_balance < product.price) {
                return ctx.editMessageText(
                    `❌ Insufficient Balance\n\n` +
                    `You need ${product.price} ETB to buy this, but your balance is only ${user.wallet_balance} ETB.\n` +
                    `Please deposit funds to continue.`,
                    Markup.inlineKeyboard([
                        [Markup.button.callback('💳 Deposit Funds', 'action_deposit')],
                        [Markup.button.callback('🔙 Back to Catalog', 'action_view_catalog')]
                    ])
                );
            }

            // 3. Deduct balance and update stock (Ideally in a transaction/RPC, but doing sequential here for simplicity)
            const newBalance = Number(user.wallet_balance) - Number(product.price);
            const newStock = product.stock - 1;

            await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', user.id);
            await supabase.from('products').update({ stock: newStock }).eq('id', product.id);

            // 4. Create Order
            const { data: order, error: orderError } = await supabase.from('orders').insert([{
                user_id: user.id,
                product_id: product.id,
                status: 'pending',
                amount: product.price
            }]).select().single();

            // 5. Notify User
            let successMessage = `✅ Purchase Successful!\n\n` +
                `You have purchased ${product.name} for ${product.price} ETB.\n` +
                `Your new balance is: ${newBalance.toFixed(2)} ETB.\n\n`;
                
            if (product.installation_guide) {
                successMessage += `📘 Installation/Usage Guide:\n${product.installation_guide}\n\n`;
            }
                
            successMessage += `Your order is now Pending. The admin has been notified and will deliver your item shortly.`;

            ctx.editMessageText(successMessage,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Back to Catalog', 'action_view_catalog')]
                ])
            );

            // 6. Notify Admin
            logToAdminChannel(bot, `🛒 New Order Alert!\n\n` +
                `👤 User: ${user.first_name} (@${user.username || 'N/A'})\n` +
                `🆔 User ID: \`${user.telegram_id}\`\n` +
                `📦 Product: ${product.name}\n` +
                `💰 Amount: ${product.price} ETB\n` +
                `🏷 Order ID: \`${order ? order.id : 'Error'}\`\n\n` +
                `Please process this delivery in the Admin Panel.`
            );

        } catch (err) {
            console.error('Purchase error:', err);
            ctx.answerCbQuery('An error occurred during purchase.');
        }
    });

    bot.action('action_back_main', (ctx) => {
        ctx.editMessageText('Main menu selected. Use the keyboard below to navigate.');
    });
    
    bot.action('action_close_catalog', (ctx) => {
        ctx.deleteMessage().catch(() => {});
    });
};

module.exports = { setupShopActions, showCatalog };
