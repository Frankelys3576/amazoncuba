ALTER TABLE public.stores
ADD COLUMN accepts_zelle BOOLEAN DEFAULT false,
ADD COLUMN zelle_info JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.orders
ADD COLUMN payment_method TEXT DEFAULT 'cash_on_delivery',
ADD COLUMN payment_proof_url TEXT;

