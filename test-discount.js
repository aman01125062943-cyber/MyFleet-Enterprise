
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testDiscountCode() {
    const payload = {
        code: 'ANTIGRAVITY50',
        description: 'Test Code from Agent',
        discount_type: 'percentage',
        discount_value: 50,
        max_uses: 100,
        is_active: true
    };

    console.log("Inserting code...");
    const { data, error } = await supabase.from('discount_codes').insert(payload).select();

    if (error) {
        console.error("❌ Error:", error);
    } else {
        console.log("✅ Success:", data);
    }
}

testDiscountCode();
