-- Run this in your Supabase SQL editor to add the referral tracking column

ALTER TABLE users 
ADD COLUMN referred_by BIGINT DEFAULT NULL;
