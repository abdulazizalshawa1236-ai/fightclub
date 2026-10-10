# Hosted stakeholder test

The test deployment uses two Vercel projects, `fightclub-test-web` and
`fightclub-test-api`, and a separate Neon free-plan PostgreSQL database. The
frontend calls the protected API through a server-only proxy. API protection
credentials and the signed client-IP key are never sent to browser code.

The database contains the source club catalogue and timetable, plus one
synthetic stakeholder member. It contains no imported real members. Store access
credentials and private demonstration links outside Git.

## OTP demonstration

`HOSTED_OTP_DEMO=true` requires `APP_ENV=test`, a canonical HTTPS `APP_ORIGIN`,
an exactly matching `DEMO_ORIGIN`, one allowlisted `DEMO_MEMBER_ID`, and
`LOCAL_OTP_PREVIEW=false`. Unsafe combinations prevent API startup.

The allowlisted member receives a freshly generated code on the login screen.
The screen explicitly states that no SMS was sent. Challenges retain their
expiry, attempt limits, single-use consumption and identity-version checks.
Only code hashes are persisted. Demo sessions never mark the phone as verified,
and stop working if demo mode is disabled or its member allowlist changes.
Other members cannot use the hosted demonstration flow.

Apply migrations, seed the catalogue, and run
`node --import tsx apps/api/scripts/provision-demo.ts` with `APP_ENV=test` and
`HOSTED_OTP_DEMO=false` before enabling the hosted flag. Provisioning requires
an empty member database, or the exact previously created synthetic record.
Use independent encryption and identity keys for this database.

## Configuration

The API requires its own `DATABASE_URL`, `DATA_ENCRYPTION_KEY`,
`IDENTITY_DIGEST_KEY`, and the OTP flags above. Both projects use the same private
`TRUSTED_PROXY_SECRET`. The frontend requires the API project's HTTPS
`API_ORIGIN` and server-only `API_PROTECTION_BYPASS`. Keep deployment protection
enabled and distribute the private frontend access link only to the intended
demonstration audience.

The project root directories are `apps/api` and `apps/web`. Their build commands
build `@fightclub/shared` before their respective workspace. Use the current
Vercel CLI without changing unrelated projects.

## Real delivery and deferred services

Keep `SMS_PROVIDER=taqnyat`. After the club purchases credit and configures its
approved sender and API credential, disable `HOSTED_OTP_DEMO`, redeploy the API,
and verify real delivery with a consenting member. Demonstration challenges and
sessions cannot establish phone ownership for the real flow.

The long-running WhatsApp reminder worker is not deployed as a Vercel function.
Automated reminders require their own scheduled execution setup and approved
Meta templates. New media uploads require an S3 bucket and credentials. Neither
service is necessary for the login demonstration. Production backup and restore
acceptance remains separate from this test deployment.
