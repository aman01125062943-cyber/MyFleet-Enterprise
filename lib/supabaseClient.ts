import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// إعدادات الاتصال بـ Supabase
// ------------------------------------------------------------------

// قراءة من المتغيرات البيئية فقط (بدون fallback)
// قراءة من المتغيرات البيئية (Runtime أولاً، ثم Build time)
const SUPABASE_URL = (window as any)._env_?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (window as any)._env_?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
