
-- Remove unique constraint on chatbot_key to allow multiple add-ons per bot
ALTER TABLE public.llm_prompt_configs DROP CONSTRAINT IF EXISTS llm_prompt_configs_chatbot_key_key;

-- Add sort_order for ordering add-ons
ALTER TABLE public.llm_prompt_configs ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Add a label/description field for identifying each add-on
ALTER TABLE public.llm_prompt_configs ADD COLUMN IF NOT EXISTS addon_label TEXT NOT NULL DEFAULT '';

-- Update existing seed rows with proper addon_labels
UPDATE public.llm_prompt_configs SET addon_label = 'Basis override', sort_order = 0 WHERE addon_label = '';
