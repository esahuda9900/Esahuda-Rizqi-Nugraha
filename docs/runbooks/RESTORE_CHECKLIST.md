# Emergency Restore Checklist

1. Pastikan project tujuan kosong / disposable.
2. Restore public schema.
3. Restore public data.
4. Restore custom roles bila dibutuhkan.
5. Enable extensions yang diperlukan.
6. Recreate Supabase Auth users.
7. Recreate/verify `app_user_roles`.
8. Re-set Edge Function secrets seperti `GEMINI_API_KEY` dan Supabase server secrets.
9. Deploy `gemini-parse-claim`.
10. Buka SDLG app dan verifikasi login.
11. Jalankan smoke test: list claims, parse, duplicate detection, Source Lock, controlled save ke test claim.
12. Bandingkan row count, latest claim ID, parts total, history rows, audit rows.
