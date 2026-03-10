const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  const { data, error } = await supabase.from('plans').select('*');
  console.log('Error:', error);
  console.log('Plans:', JSON.stringify(data, null, 2));
})();
