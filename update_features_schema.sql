-- 1. Create a global settings table
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value VARCHAR(255) NOT NULL,
    description TEXT
);

-- Insert the default auto-verify setting
INSERT INTO settings (key, value, description) 
VALUES ('auto_verify_deposits', 'true', 'If true, uses Verify.et. If false, asks user to upload receipt.');

-- 2. Add installation_guide to products
ALTER TABLE products ADD COLUMN installation_guide TEXT;

-- 3. Create a table to track manual deposit requests
CREATE TABLE deposit_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    amount DECIMAL NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    receipt_file_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
