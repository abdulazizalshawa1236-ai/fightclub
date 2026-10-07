#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
for tool in docker aws age tar sha256sum; do command -v "$tool" >/dev/null || { echo "Required command missing: $tool" >&2; exit 1; }; done
: "${RUNTIME_ENV_FILE:?Private deployment env file is required}"
: "${AGE_RECIPIENT:?Backup encryption public recipient is required}"
: "${MEDIA_BUCKET:?Source media bucket is required}"
: "${BACKUP_BUCKET:?Independent private backup bucket is required}"
[[ "$MEDIA_BUCKET" != "$BACKUP_BUCKET" ]] || { echo 'Media and backup buckets must differ' >&2; exit 1; }
task_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
task_tmp=$(mktemp -d)
trap 'rm -rf -- "$task_tmp"' EXIT
task_stamp=$(date -u +%Y%m%dT%H%M%SZ)
task_endpoint=()
if [[ -n "${AWS_ENDPOINT_URL:-}" ]]; then task_endpoint=(--endpoint-url "$AWS_ENDPOINT_URL"); fi
docker compose -f "$task_root/infra/compose.production.yaml" exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$task_tmp/database.dump"
mkdir "$task_tmp/media"
aws "${task_endpoint[@]}" s3 sync "s3://$MEDIA_BUCKET/" "$task_tmp/media/" --only-show-errors
printf 'timestamp=%s\nmedia_bucket=%s\n' "$task_stamp" "$MEDIA_BUCKET" > "$task_tmp/metadata.txt"
(cd "$task_tmp" && find media -type f -print0 | sort -z | xargs -0 -r sha256sum > media.sha256 && sha256sum database.dump > database.sha256)
tar -C "$task_tmp" -czf - database.dump database.sha256 media media.sha256 metadata.txt | age -r "$AGE_RECIPIENT" > "$task_tmp/backup.tar.gz.age"
task_key="${BACKUP_PREFIX:-fightclub}/$task_stamp.tar.gz.age"
aws "${task_endpoint[@]}" s3 cp "$task_tmp/backup.tar.gz.age" "s3://$BACKUP_BUCKET/$task_key" --only-show-errors
printf 'Encrypted database and media backup uploaded: s3://%s/%s\n' "$BACKUP_BUCKET" "$task_key"
