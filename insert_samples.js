const supabase = require('./src/database/supabase');

async function insertSamples() {
    const sampleProducts = [
        { name: 'Netflix Premium (1 Month)', description: '4K UHD, 4 screens.', price: 150.00, stock: 10, is_active: true },
        { name: 'Spotify Premium (1 Month)', description: 'Ad-free music listening.', price: 80.00, stock: 5, is_active: true },
        { name: 'ChatGPT Plus (1 Month)', description: 'Access to GPT-4.', price: 500.00, stock: 2, is_active: true },
        { name: 'Telegram Premium (3 Months)', description: 'Extra features on Telegram.', price: 300.00, stock: 0, is_active: true }
    ];

    console.log('Inserting sample products...');
    
    for (const product of sampleProducts) {
        const { data, error } = await supabase.from('products').insert([product]);
        if (error) {
            console.error(`Failed to insert ${product.name}:`, error.message);
        } else {
            console.log(`Inserted ${product.name}`);
        }
    }
    console.log('Done!');
}

insertSamples();
