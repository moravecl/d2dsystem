-- Create company_info table (singleton pattern)
CREATE TABLE IF NOT EXISTS public.company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT '',
  company_id TEXT DEFAULT '', -- IČO
  tax_id TEXT DEFAULT '', -- DIČ
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  zip TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  initials TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default company record (only one row should exist)
INSERT INTO public.company_info (company_name)
VALUES ('HouseSmart')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.company_info ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_info
-- Allow authenticated users to read company info
CREATE POLICY "Allow authenticated users to read company info"
  ON public.company_info
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to update company info
CREATE POLICY "Allow admins to update company info"
  ON public.company_info
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add updated_at trigger for company_info
CREATE OR REPLACE FUNCTION public.update_company_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_info_updated_at
  BEFORE UPDATE ON public.company_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_company_info_updated_at();

-- Add constraint to ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_info_singleton ON public.company_info ((true));