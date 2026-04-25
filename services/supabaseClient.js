const SUPABASE_URL = 'https://wuytnazthvbwldbwjife.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1eXRuYXp0aHZid2xkYndqaWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MTAzMDksImV4cCI6MjA5MjQ4NjMwOX0.fqvhJA19xyfvV5EcMcc8iubSNbrU5AWtFeB8hiKbi-E';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
