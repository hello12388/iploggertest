CREATE TABLE public.ip_records (
  ip text PRIMARY KEY CHECK (length(ip) <= 45),
  version text NOT NULL DEFAULT 'unknown',
  first_seen timestamptz NOT NULL DEFAULT now()
);

-- Server-side code (service role) owns all access; no client-facing grants.
GRANT ALL ON public.ip_records TO service_role;

-- RLS with no policies: anon and authenticated have no access at all.
ALTER TABLE public.ip_records ENABLE ROW LEVEL SECURITY;