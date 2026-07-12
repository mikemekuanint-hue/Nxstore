-- Run this in your Supabase SQL Editor

-- 1. Add auto_verify column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS auto_verify BOOLEAN DEFAULT false;

-- 2. Add metadata column to orders to store references
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. (Optional) Create an index on deposit_requests metadata for faster reference checking
CREATE INDEX IF NOT EXISTS idx_deposit_requests_reference ON public.deposit_requests USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON public.orders USING gin (metadata);
