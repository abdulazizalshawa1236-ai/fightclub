# Production operations

The production definition is `infra/compose.production.yaml`. It runs PostgreSQL 17 on a persistent named volume, the compiled Nest API, a separate compiled queue worker, Next standalone, and Caddy for HTTPS. Only Caddy publishes ports. Local development's root Compose database and local media directory are separate. Production media uploads require S3. These files are prepared infrastructure, not evidence of a deployment, a certificate, a provider-approved template, or a restored production backup.

## Prerequisites and private configuration

Use a Linux deployment host with Docker Compose, sufficient disk for database/media backup snapshots, DNS pointing the club hostname to the host, and incoming TCP 80/443 (UDP 443 optional). Restrict host SSH. Provision actual S3 media and independent private backup buckets. Enable bucket versioning, encryption and lifecycle retention on both. Public delivery applies only to approved club images through the chosen media origin; database backups must stay private. Use least-privilege IAM keys and keep backup permissions separate from application upload permissions.

Keep runtime configuration outside the checkout, for example `/etc/fightclub/runtime.env`, readable only by the operator. Do not put credentials into Docker build arguments or commit them. The ignored development `.env` uses local database port 56432 and web port 3100 and must not be copied into production.

The runtime file must contain `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `DATABASE_URL` using Compose hostname `db` and port 5432. Percent-encode database credentials in the connection URL. Supply `APP_ORIGIN=https://<actual-club-domain>`, independent random 32-byte hexadecimal `DATA_ENCRYPTION_KEY` and `IDENTITY_DIGEST_KEY`, and the S3 values consumed by the API: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `MEDIA_PUBLIC_URL` and optional `S3_ENDPOINT`. Preserve both crypto keys in an encrypted secrets recovery store. Without the encryption key, stored identity ciphertext cannot be recovered; changing the digest key breaks existing ID lookups and sessions.

For member authentication, keep `LOCAL_OTP_PREVIEW=false` or omit the flag in production. A true preview flag causes production startup to fail. Set `SMS_PROVIDER=taqnyat`, `TAQNYAT_BEARER_TOKEN` and the exact approved `TAQNYAT_SENDER`. Enable API access, authorize the deployment's outgoing IP and allow Saudi recipients in the Taqnyat portal. Maintain account balance and exercise both Arabic and English SMS with a consenting real member. Credentials alone do not prove delivery. Consult the [official SMS setup and API contract](https://dev.taqnyat.sa/en/doc/sms/).

The file also carries actual Meta configuration for club messages: `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_GRAPH_VERSION`, `META_EXPIRING_TEMPLATE`, `META_EXPIRED_TEMPLATE`, `META_RENEWED_TEMPLATE`, and `META_MARKETING_TEMPLATE`. Verify the current supported Graph version and actual language codes/template parameters before enabling sends. Environment variable presence does not prove template approval or delivery.

## Build and first launch

Set these operator variables to actual values. They contain file location, hostname and email, not application secret values:

```sh
export RUNTIME_ENV_FILE=/etc/fightclub/runtime.env
export CLUB_DOMAIN=your-actual-club-hostname
export TLS_EMAIL=your-certificate-administrator-email
docker compose -f infra/compose.production.yaml build
docker compose -f infra/compose.production.yaml up -d db
docker compose -f infra/compose.production.yaml --profile tools run --rm migrate
```

Inspect the repository's seed/provisioning script before running it. On an empty first installation only, run the audited seed command through the tools image:

```sh
docker compose -f infra/compose.production.yaml --profile tools run --rm migrate npm run db:seed
docker compose -f infra/compose.production.yaml up -d api worker web caddy
docker compose -f infra/compose.production.yaml ps
```

Use the seed script's documented admin provisioning variables through the private runtime file. Remove bootstrap credentials after provisioning. Do not reseed an existing production database blindly. Run migrations before new API/worker containers; first assess migration compatibility with the running version. API checks cover its public data endpoint; worker health also requires monitoring queue age and process logs. Caddy obtains and renews certificates when real DNS/network prerequisites are met. Confirm HTTPS and redirect behavior from outside the host. Do not use `docker compose down -v`, which deletes the persistent database and certificate volumes.

The image builds all three workspaces without runtime credentials. The API image runs as the Node user with production dependencies; the web image uses Next's standalone output and public assets. API requests route directly through Caddy, preserving the browser origin, while server rendering uses the internal API URL.

## Official WhatsApp verification

Register the actual HTTPS webhook route `/api/whatsapp/webhook` in Meta, verify the token challenge, subscribe to message status callbacks, and confirm the POST route accepts authentic signed callbacks without a browser Origin. Utility templates use package name, end date and editable reminder wording in that order. Marketing templates use announcement title and body. All templates must be approved with these exact contracts and intended languages. Send controlled tests to consenting real recipients; verify accepted, delivered, read where available, rejected and ambiguous outcomes. Confirm marketing and membership consent are recorded and withdrawn preferences suppress queued sends. SMS login-code consent is distinct. Never enable unofficial WhatsApp browser automation. Never label API acceptance as successful delivery.

## Automated encrypted backups

Install AWS CLI v2, `age`, GNU coreutils/findutils and Bash on the backup host. Give the backup identity read access to the media bucket and write access to the private backup bucket. Application S3 credentials use `S3_*`; the backup AWS CLI uses its independent `AWS_*` credentials or an instance role. If using an S3-compatible service, set `AWS_ENDPOINT_URL` for the backup endpoint. The two backup-script buckets must be different.

Keep `/etc/fightclub/backup.env` private and outside the checkout. It supplies `RUNTIME_ENV_FILE`, `CLUB_DOMAIN`, `TLS_EMAIL`, `MEDIA_BUCKET`, `BACKUP_BUCKET`, optional `BACKUP_PREFIX`, `AGE_RECIPIENT`, and backup-specific AWS configuration. `AGE_RECIPIENT` is the public encryption recipient; store the matching private identity offline or in a protected recovery secret store. Install this operator command as `/usr/local/sbin/fightclub-backup`:

```sh
#!/usr/bin/env bash
set -Eeuo pipefail
set -a
source /etc/fightclub/backup.env
set +a
exec bash /opt/fightclub/scripts/backup.sh
```

An example host cron entry runs hourly and captures failures for the host's monitoring integration:

```cron
0 * * * * /usr/local/sbin/fightclub-backup >>/var/log/fightclub-backup.log 2>&1
```

The script creates a consistent PostgreSQL custom dump, downloads current media objects, creates checksum manifests, encrypts the complete archive with age, and uploads it to the separate private backup bucket. It never deletes source media. Cleartext temporary files require an encrypted host disk and are removed on exit. Budget storage and network for the full media corpus; this first implementation is a full backup. Configure alerts on nonzero exit and stale newest-backup timestamp. Cron is only automated after the operator installs it; no schedule is installed by these repository files.

An hourly schedule targets at most one hour of database data loss only if backups succeed. Media copy occurs after the database dump, so the archive is not an atomic cross-system snapshot. Existing uploads are immutable and the platform does not delete them, which supports restore references. Retain independent S3 versions for recovery and prevent media lifecycle rules from deleting database-referenced objects. Do not claim an RPO/RTO until measured through a drill. Apply retention and optional Object Lock according to the club's policy; verify version recovery separately because `s3 sync` copies current objects, not historical versions.

## Restore verification and disaster recovery

Download a selected encrypted backup using the backup operator credentials. Keep it outside the checkout. Run:

```sh
export AGE_IDENTITY_FILE=/private/recovery/age-identity.txt
bash scripts/restore-check.sh /private/recovery/backup.tar.gz.age
```

The script decrypts into a private temporary directory, validates database/media checksums, starts a uniquely named PostgreSQL 17 container with no network and an ephemeral in-memory database, restores with errors fatal, queries core row counts, checks that every recorded media object exists, and removes only its own temporary container/files. It neither connects to production nor replaces production storage. Size host memory for the restored database; large datasets need a dedicated isolated restore host with adequate capacity.

Passing this check verifies database readability and archived media integrity, not a full product recovery. A full disaster drill restores into a separate deployment, restores media into a separate bucket, supplies recovered keys/secrets, verifies admin/member access, dates, published content and images, and records elapsed time. Keep outbound WhatsApp disabled during drills to prevent duplicate sends. For a real cutover, reconcile previously sending/unknown outbox records before enabling the worker; do not bulk resend ambiguous messages. Obtain an explicit production cutover instruction before replacing live data. Restore S3 versions using an operator-reviewed procedure when current versions were deleted or damaged.

## Release and rollback

Before each release: create and verify an encrypted backup, record the deployed commit and migration version, run required checks, and use staging with separate secrets, buckets and Meta recipients. Keep previous images available. Roll back application images only when schema changes remain backward-compatible. Restoring an older database can discard subsequent renewals/consent changes and duplicate communications, so it is a separate recovery operation with reconciliation. Preserve the Compose project name and named database volume between releases.

Monitor API failures, PostgreSQL disk capacity, queue age and unknown outcomes, Meta delivery failures, certificate expiry, and backup freshness. Logs must exclude national IDs, OTPs, session cookies, passwords and access tokens. A production handover requires actual HTTPS, authenticated owner isolation, approved-template delivery, persistence across restart, and a measured successful restore drill.
