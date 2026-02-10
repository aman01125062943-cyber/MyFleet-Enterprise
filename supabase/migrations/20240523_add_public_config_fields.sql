-- Add new columns to public_config if they don't exist
ALTER TABLE public_config 
ADD COLUMN IF NOT EXISTS support_contact TEXT,
ADD COLUMN IF NOT EXISTS survey_link TEXT;

-- Verify the columns are readable by public (existing policy covers SELECT using true, but good to be sure)
-- No changes needed to policy if it's already "USING (true)" for all columns.
