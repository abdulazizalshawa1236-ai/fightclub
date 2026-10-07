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

Open http://127.0.0.1:3100/ar or /en. Admin: /ar/admin. Member portal: /ar/account. The generated private `.env` contains the local admin credentials. No credentials or member fixtures are committed. Seeding preserves existing catalogue edits and creates no classes or members.

Run `npm run build -w @fightclub/api` and `npm run worker -w @fightclub/api` in a separate terminal to process durable notifications. Local media uses a private filesystem directory; production requires S3. Member login uses SMS through Taqnyat. Set `SMS_PROVIDER=taqnyat`, `TAQNYAT_BEARER_TOKEN` and `TAQNYAT_SENDER` in the private environment, activate the sender and authorize the server IP in the provider account. Enrollment requests and club messages continue to use WhatsApp. Automated WhatsApp messages need official Meta credentials and approved templates. The app never substitutes a fake OTP or reports a missing provider as successful delivery.

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
