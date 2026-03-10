const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  const { data } = await supabase.from('public_config').select('*').single();
  console.log('Public Config:', JSON.stringify(data, null, 2));
})();
