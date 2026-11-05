-- Preserve existing rows while allowing every valid receive request to be recorded.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE public.ip_records ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.ip_records ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.ip_records ADD COLUMN IF NOT EXISTS consent boolean NOT NULL DEFAULT false;
UPDATE public.ip_records SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.ip_records ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.ip_records DROP CONSTRAINT IF EXISTS ip_records_pkey;
ALTER TABLE public.ip_records ADD CONSTRAINT ip_records_pkey PRIMARY KEY (id);
ALTER TABLE public.ip_records ADD CONSTRAINT ip_records_username_format CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,20}$');
CREATE INDEX IF NOT EXISTS ip_records_first_seen_idx ON public.ip_records (first_seen DESC);
CREATE INDEX IF NOT EXISTS ip_records_username_idx ON public.ip_records (username);
