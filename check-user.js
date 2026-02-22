import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.log("No user logged in.");
        // Try to check by email if not logged in via SDK env
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'aman01125062943@gmail.com');
        console.log("Profile by email:", JSON.stringify(profiles, null, 2));
        return;
    }
    console.log("Logged in user ID:", user.id);
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    console.log("Profile:", JSON.stringify(profile, null, 2));
}
check();
