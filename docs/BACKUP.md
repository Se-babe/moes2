# Backups, recovery and data integration

## What is backed up, and where

| What | Where it lives | How it is protected |
|---|---|---|
| Database (requests, announcements, profiles, training, documents list, settings) | Supabase project `sjsavaijgoazitnrjtab` (central store for the whole platform) | Nightly encrypted dump by `.github/workflows/backup.yml`, kept 30 days |
| Uploaded files (photos, documents, profile pictures) | Supabase Storage buckets | Supabase's own storage durability; download a copy from the dashboard before major changes |
| Application code | GitHub `Se-babe/moes2` | Every change is a commit; Render and GitHub Pages rebuild from it |

## Turn on nightly backups (one time)

1. Supabase dashboard → **Project Settings → Database → Connection string** → copy the **URI** for the session pooler and put your database password in it.
2. GitHub → `Se-babe/moes2` → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL` = that URI
   - `BACKUP_PASSPHRASE` = a long random passphrase. **Store a copy offline** — without it the backups can't be opened.
3. GitHub → **Actions → Nightly database backup → Run workflow** to test it. Each run produces an artifact `nwsc-db-backup`.

The repository is public, so backups are encrypted with AES-256 before they are stored.

## Restore

```bash
# 1. Download the artifact from the workflow run and unzip it, then:
gpg --decrypt nwsc-backup-<date>.tar.gz.gpg > backup.tar.gz   # asks for BACKUP_PASSPHRASE
mkdir backup && tar -xzf backup.tar.gz -C backup

# 2. Restore into an EMPTY Supabase project (or a local one):
psql "$TARGET_DB_URL" -f backup/roles.sql
psql "$TARGET_DB_URL" -f backup/schema.sql
psql "$TARGET_DB_URL" -c "SET session_replication_role = replica" -f backup/data.sql
```

Then point the app at the new project (`app.json` → `extra.supabaseUrl` / `supabaseAnonKey`), redeploy the Edge Functions
(`supabase functions deploy …`) and set their secrets again (`supabase secrets set …`).

## Integration with other NWSC systems

Every table is reachable through the Supabase REST API (`https://sjsavaijgoazitnrjtab.supabase.co/rest/v1/…`), governed by the same
row-level security as the app:

- **Public, read-only feeds** (publishable key, no sign-in): published announcements, published documents and versions,
  open consultations and surveys, and `rpc/public_performance` (aggregate figures, no personal data).
- **Internal systems** (billing, GIS, call centre): create a dedicated staff account with the least role needed and use its token,
  or a server-side integration using the service key kept on the server only. Requests from other channels can be created through the
  `submit-feedback` Edge Function with `source` set (e.g. `Phone call`) using a staff token, so they get reference numbers and SMS acknowledgements.
- Administrators can download a full CSV export (ZIP) from **Admin console → Data & integration**.
