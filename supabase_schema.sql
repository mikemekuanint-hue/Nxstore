-- Nexus Store - Supabase Database Schema

-- 1. Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  wallet_balance DECIMAL DEFAULT 0.00,
  reward_points INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_purchases DECIMAL DEFAULT 0.00,
  commission_earned DECIMAL DEFAULT 0.00,
  account_status TEXT DEFAULT 'active',
  role TEXT DEFAULT 'customer'
);

-- 2. Products Table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- 3. Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  amount DECIMAL NOT NULL,
  payment_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivery_date TIMESTAMP WITH TIME ZONE,
  delivery_message TEXT,
  internal_notes TEXT
);

-- 4. Transactions (Deposit History)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  type TEXT NOT NULL, -- 'deposit', 'purchase', 'refund'
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
