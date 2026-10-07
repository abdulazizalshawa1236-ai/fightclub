# Fight Club platform

Bilingual club website, staff operations portal and private member portal. Rebuilt with Next.js 16, React 19, TypeScript, NestJS, PostgreSQL 17, Motion and S3-compatible media storage.

## Run locally

Requires Node.js 22.16+ and Docker.

```sh
npm ci
node scripts/setup-local.mjs
docker compose up -d
npm run build -w @fightclub/shared
npm run db:migrate
npm run db:seed
npm run dev:api
```

In another terminal:

```sh
npm run dev:web
```

Open http://127.0.0.1:3100/ar or /en. Admin: /ar/admin. Member portal: /ar/account. The generated private `.env` contains the local admin credentials. No credentials or member fixtures are committed. Seeding preserves existing catalogue edits and creates no classes or members. Create a member in Admin before trying member login.

Local setup explicitly enables `LOCAL_OTP_PREVIEW=true`. The verification screen shows the generated code in a clearly labeled local testing panel; no SMS is sent. The same expiry, attempt limits and single-use verification apply. Both development servers bind to loopback. Preview mode rejects production, nonlocal origins and trusted proxy configuration, and cannot verify a preview challenge after it is disabled. Sessions issued by preview also require the active local gate on every request. Preview sign-in does not establish real mobile verification or enable automated messages. Set `LOCAL_OTP_PREVIEW=false` when adding real Taqnyat credentials, then restart the API. Keep the flag false or absent in production.

Run `npm run build -w @fightclub/api` and `npm run worker -w @fightclub/api` in a separate terminal to process durable notifications. Local media uses a private filesystem directory; production requires S3. Member login uses SMS through Taqnyat when preview mode is disabled. Set `SMS_PROVIDER=taqnyat`, `TAQNYAT_BEARER_TOKEN` and `TAQNYAT_SENDER` in the private environment, activate the sender and authorize the server IP in the provider account. Enrollment requests and club messages continue to use WhatsApp. Automated WhatsApp messages need official Meta credentials and approved templates. Preview codes are real expiring challenges and are never reported as SMS deliveries.

## Structure

- `apps/web`: public website, Admin and member screens, bilingual layout, interaction motion.
- `apps/api`: identity, membership ledger, catalogue/CMS, schedules, media, communications and separate worker.
- `packages/shared`: typed browser/API contracts and the supplied public catalogue.
- `assets/source`: original brochure and trainer biography, asset inventory.
- `infra`: production containers and HTTPS reverse proxy.
- `scripts`: private local setup, encrypted backups and isolated restoration check.

Public prices and contact details come from the original repository. Existing SQLite data is not silently imported. The historical calendar is not assumed to represent the club's current schedule.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration -w @fightclub/api
npm run build
```

Integration checks require the local PostgreSQL database. Operations checks use an isolated schema. Tests substitute external SMS/WhatsApp network boundaries; verification does not send real messages.

See [architecture](docs/ARCHITECTURE.md), [API contracts](docs/API-CONTRACT.md), [operations and deployment](docs/OPERATIONS.md), [legacy audit](docs/LEGACY-AUDIT.md), and [handover evidence](docs/VERIFICATION.md).
