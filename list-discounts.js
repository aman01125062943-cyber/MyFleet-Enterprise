
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function listDiscountCodes() {
    const { data, error } = await supabase.from('discount_codes').select('*');

    if (error) {
        console.error("❌ Error:", error);
    } else {
        console.log("✅ Codes in DB:", JSON.stringify(data, null, 2));
    }
}

listDiscountCodes();
