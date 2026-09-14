Supabase setup for Sokoban
=================================

1) Create a free project on Supabase (https://supabase.com).

2) In the SQL editor, run the SQL from `supabase-users.sql` included in this repo.

3) Configure Row Level Security (RLS) and policies:
   - If you want client-side access (anonymous), create a policy that allows
     `INSERT`/`UPDATE` for authenticated users or the anon key with careful limits.
   - Recommended: perform upserts via a server endpoint (safer). If using client REST,
     ensure you set `Prefer: resolution=merge-duplicates` header for upsert behavior.

4) Configure CORS and get your REST URL and anon/service role key.

5) Pass configuration into the app at runtime by setting a global:

   <script>
     window.SUPABASE_CONFIG = {
       url: 'https://your-project.supabase.co',
       key: 'YOUR_ANON_OR_SERVICE_KEY'
     };
   </script>

   The app will call `Storage.setSupabaseConfig()` automatically if `window.SUPABASE_CONFIG` is set.

6) The `users` table stores a JSON `data` field per `user_id`. The app saves
   `{ undos, lastRefill, stars, completedLevels }` in `data` for each user.

7) For production, implement server-side endpoints to validate payments and
   to perform secure upserts to Supabase using the service role key.
