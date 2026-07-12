-- Run this in your Supabase SQL editor to add the stock column

ALTER TABLE products 
ADD COLUMN stock INTEGER DEFAULT 0;
