import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function list() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*');
    if (error) console.error(error);
    else console.log("Profiles count:", profiles.length);
    console.log("Profiles Sample:", JSON.stringify(profiles.slice(0, 3), null, 2));
}
list();
