const supabase = require('../database/supabase');

const getOrCreateUser = async (ctx, referredBy = null) => {
  const telegramUser = ctx.from;
  
  try {
    // Check if user exists
    let { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramUser.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return null;
    }

    // Create user if not exists
    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          telegram_id: telegramUser.id,
          username: telegramUser.username || null,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name || null,
          referred_by: referredBy ? parseInt(referredBy) : null
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user:', insertError);
        return null;
      }
      user = newUser;
    } else {
        // Update username or name if they changed on Telegram
        if (user.username !== telegramUser.username || user.first_name !== telegramUser.first_name) {
             const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({
                    username: telegramUser.username || null,
                    first_name: telegramUser.first_name,
                    last_name: telegramUser.last_name || null,
                })
                .eq('telegram_id', telegramUser.id)
                .select()
                .single();
            if(!updateError) user = updatedUser;
        }
    }

    return user;
  } catch (err) {
    console.error('Unexpected error in getOrCreateUser:', err);
    return null;
  }
};

module.exports = {
  getOrCreateUser
};
