
import { createClient } from '@supabase/supabase-js';

// NOTE: If the app worked before and stopped, your free Supabase project may be paused.
// Login to https://app.supabase.com and click "Resume Project" to fix the connection.

const supabaseUrl = 'https://irjyelameqzyusreowei.supabase.co';
const supabaseAnonKey = 'sb_publishable_jGZUUaNiRorPY_Xxw4qoAg_JaTaYJnN';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
