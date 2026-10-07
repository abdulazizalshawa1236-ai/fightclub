#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
for tool in docker age tar sha256sum; do command -v "$tool" >/dev/null || { echo "Required command missing: $tool" >&2; exit 1; }; done
task_archive=${1:?Usage: bash scripts/restore-check.sh /private/path/backup.tar.gz.age}
: "${AGE_IDENTITY_FILE:?Path to private backup decryption identity is required}"
[[ -f "$task_archive" && -f "$AGE_IDENTITY_FILE" ]] || { echo 'Backup or identity file unavailable' >&2; exit 1; }
task_tmp=$(mktemp -d)
task_container="fightclub-restore-check-$(date +%s)-$$"
task_started=false
cleanup() { if [[ "$task_started" == true ]]; then docker rm -f "$task_container" >/dev/null 2>&1 || true; fi; rm -rf -- "$task_tmp"; }
trap cleanup EXIT
age -d -i "$AGE_IDENTITY_FILE" "$task_archive" > "$task_tmp/backup.tar.gz"
# Only restore archives produced by backup.sh; reject absolute or parent paths.
while IFS= read -r entry; do
  [[ "$entry" != /* && "/$entry/" != */../* ]] || { echo 'Unsafe archive path' >&2; exit 1; }
done < <(tar -tzf "$task_tmp/backup.tar.gz")
mkdir "$task_tmp/restored"
tar -xzf "$task_tmp/backup.tar.gz" -C "$task_tmp/restored" --no-same-owner --no-same-permissions
(cd "$task_tmp/restored" && sha256sum -c database.sha256 >/dev/null && { [[ ! -s media.sha256 ]] || sha256sum -c media.sha256 >/dev/null; })
docker run -d --name "$task_container" --network none --tmpfs /var/lib/postgresql/data:rw -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=restore_check postgres:17-bookworm >/dev/null
task_started=true
task_ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$task_container" pg_isready -U postgres -d restore_check >/dev/null 2>&1; then task_ready=true; break; fi
  sleep 1
done
[[ "$task_ready" == true ]] || { echo 'Isolated restore database did not start' >&2; exit 1; }
docker exec -i "$task_container" pg_restore -U postgres -d restore_check --no-owner --no-acl --exit-on-error < "$task_tmp/restored/database.dump"
docker exec "$task_container" psql -U postgres -d restore_check -v ON_ERROR_STOP=1 -c "SELECT 'members' AS entity,count(*) AS rows FROM members UNION ALL SELECT 'memberships',count(*) FROM memberships UNION ALL SELECT 'media',count(*) FROM media;"
docker exec "$task_container" psql -U postgres -d restore_check -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF EXISTS(SELECT 1 FROM media WHERE object_key LIKE '/%' OR object_key LIKE '%..%') THEN RAISE EXCEPTION 'Unsafe media object key'; END IF; END \$\$;"
docker exec "$task_container" psql -U postgres -d restore_check -At -v ON_ERROR_STOP=1 -c 'SELECT object_key FROM media;' > "$task_tmp/media-keys.txt"
while IFS= read -r task_key; do [[ -f "$task_tmp/restored/media/$task_key" ]] || { echo 'Restored database references a missing media object' >&2; exit 1; }; done < "$task_tmp/media-keys.txt"
printf 'PASS: PostgreSQL dump restored in isolated temporary container; database and media checksums verified; referenced media present. Production was not changed.\n'
