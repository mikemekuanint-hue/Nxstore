const { Markup } = require('telegraf');
const supabase = require('../../database/supabase');

const setupWalletActions = (bot) => {
    bot.action('action_deposit', async (ctx) => {
        // Fetch the global setting
        let isAutoVerify = true; // default
        try {
            const { data } = await supabase.from('settings').select('value').eq('key', 'auto_verify_deposits').single();
            if (data && data.value === 'false') {
                isAutoVerify = false;
            }
        } catch (e) {
            console.error('Failed to load setting, defaulting to auto-verify');
        }

        if (isAutoVerify) {
            // Auto Verification Flow (Precise Amounts)
            ctx.editMessageText('💰 Deposit Funds (Auto-Verify)\n\nSelect a preset amount to deposit into your digital wallet:', 
                Markup.inlineKeyboard([
                    [Markup.button.callback('50 ETB', 'action_dep_auto_50'), Markup.button.callback('100 ETB', 'action_dep_auto_100')],
                    [Markup.button.callback('200 ETB', 'action_dep_auto_200'), Markup.button.callback('500 ETB', 'action_dep_auto_500')],
                    [Markup.button.callback('1000 ETB', 'action_dep_auto_1000')],
                    [Markup.button.callback('« Back to Wallet', 'action_back_wallet')]
                ])
            );
        } else {
            // Manual Verification Flow (Photo Upload)
            ctx.editMessageText('💰 Deposit Funds (Manual Approval)\n\nSelect a preset amount to deposit into your digital wallet:', 
                Markup.inlineKeyboard([
                    [Markup.button.callback('50 ETB', 'action_dep_manual_50'), Markup.button.callback('100 ETB', 'action_dep_manual_100')],
                    [Markup.button.callback('200 ETB', 'action_dep_manual_200'), Markup.button.callback('500 ETB', 'action_dep_manual_500')],
                    [Markup.button.callback('1000 ETB', 'action_dep_manual_1000')],
                    [Markup.button.callback('« Back to Wallet', 'action_back_wallet')]
                ])
            );
        }
    });

    bot.action('action_back_wallet', (ctx) => {
        ctx.editMessageText('Main menu selected. Please use the 💳 Wallet button from the keyboard again.');
    });

    // Handle preset auto-deposit amounts
    const amounts = [50, 100, 200, 500, 1000];
    amounts.forEach(amt => {
        bot.action(`action_dep_auto_${amt}`, async (ctx) => {
            const cents = Math.floor(Math.random() * 99) + 1; // 1 to 99 cents
            const preciseAmount = amt + (cents / 100);
            
            // Fetch account details from settings
            const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'payment_methods').single();
            let banks = [{ bank: 'Telebirr', accountName: 'Nahom Mekuanint', accountNumber: '251901585028' }];
            if (settingsData && settingsData.value) {
                try { banks = JSON.parse(settingsData.value); } catch(e){}
            }

            let banksText = '';
            banks.forEach(b => {
                banksText += `🏦 ${b.bank}\n👤 Name: ${b.accountName}\n🔢 Number: ${b.accountNumber}\n\n`;
            });
            
            // Set session state for this user to expect a text input
            ctx.session ??= {};
            ctx.session.awaitingAutoReference = preciseAmount;
            
            ctx.editMessageText(
                `💵 Payment — Auto-Verify\n` +
                `😀 Order: DEPOSIT\n` +
                `📦 Item: Wallet deposit × 1\n` +
                `💵 Amount: ${preciseAmount.toFixed(2)} ETB\n\n` +
                `➿➿➿➿➿➿➿➿➿➿➿➿➿\n` +
                `📤 Send exactly ${preciseAmount.toFixed(2)} ETB to ANY of the following:\n\n` +
                banksText +
                `➿➿➿➿➿➿➿➿➿➿➿➿➿\n\n` +
                `😀 Steps:\n` +
                `1. Send ${preciseAmount.toFixed(2)} ETB to an account above.\n` +
                `2. **REPLY TO THIS CHAT** with the transaction reference number from your confirmation SMS.📝\n\n` +
                `⚠️ Important:\n` +
                `➖ Send the exact amount — partial payments are rejected.\n` +
                `➖ Each reference can be used once.\n` +
                `➖ Verification is automatic & usually instant`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Cancel Deposit', 'action_cancel_auto')]
                ])
            );
        });

        // Handle preset manual deposit amounts
        bot.action(`action_dep_manual_${amt}`, async (ctx) => {
            // Set session state for this user to expect a photo
            ctx.session ??= {};
            ctx.session.awaitingReceipt = true;
            ctx.session.depositAmount = amt;
            
            // Fetch account details from settings
            const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'payment_methods').single();
            let banks = [{ bank: 'Telebirr', accountName: 'Nahom Mekuanint', accountNumber: '251901585028' }];
            if (settingsData && settingsData.value) {
                try { banks = JSON.parse(settingsData.value); } catch(e){}
            }

            let banksText = '';
            banks.forEach(b => {
                banksText += `🏦 ${b.bank}\n👤 Name: ${b.accountName}\n🔢 Number: ${b.accountNumber}\n\n`;
            });

            ctx.editMessageText(
                `💵 Payment — Manual Verification\n` +
                `😀 Order: DEPOSIT\n` +
                `📦 Item: Wallet deposit × 1\n` +
                `💵 Amount: ${amt.toFixed(2)} ETB\n\n` +
                `➿➿➿➿➿➿➿➿➿➿➿➿➿\n` +
                `📤 Send exactly ${amt.toFixed(2)} ETB to ANY of the following:\n\n` +
                banksText +
                `➿➿➿➿➿➿➿➿➿➿➿➿➿\n\n` +
                `😀 Steps:\n` +
                `1. Send ${amt.toFixed(2)} ETB to an account above.\n` +
                `2. **Upload a clear screenshot of your receipt here.**\n\n` +
                `⚠️ Important:\n` +
                `➖ Send the exact amount — partial payments are rejected.\n` +
                `➖ Each reference can be used once.\n` +
                `➖ Verification is manual & will be reviewed by an admin.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Cancel Deposit', 'action_cancel_manual')]
                ])
            );
        });
    });

    bot.action('action_cancel_manual', (ctx) => {
        if (ctx.session) {
            ctx.session.awaitingReceipt = false;
            ctx.session.depositAmount = null;
        }
        ctx.editMessageText('Deposit cancelled. Returning to Wallet menu...', Markup.inlineKeyboard([
            [Markup.button.callback('« Back to Wallet', 'action_deposit')]
        ]));
    });

    bot.action('action_cancel_auto', (ctx) => {
        if (ctx.session) {
            ctx.session.awaitingAutoReference = null;
            ctx.session.depositAccountNumber = null;
        }
        ctx.editMessageText('Deposit cancelled. Returning to Wallet menu...', Markup.inlineKeyboard([
            [Markup.button.callback('« Back to Wallet', 'action_deposit')]
        ]));
    });
};

module.exports = setupWalletActions;
