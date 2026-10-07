# Architecture

Fight Club has three product surfaces: bilingual public conversion, staff operations, and private member access. Payments and final enrollment remain staff controlled. Public plan buttons create WhatsApp requests containing package, price, duration and blank intake prompts. They never create a membership.

## Application boundaries

Next.js renders public content on the server and serves interactive React screens. Browser requests use the same-origin `/api` path. Production Caddy routes that path directly to NestJS; local Next rewrites reach the development API. API handlers validate input and invoke domain services. PostgreSQL is authoritative for identity, sessions, memberships, content and delivery state. SQL uses bound parameters and explicit transaction boundaries.

The API is a modular monolith. Identity, members and operations are separated by domain. A separate worker uses the same database and application services. This avoids a second queue datastore and keeps membership changes plus notification enqueue atomic. Shared TypeScript contracts describe the transport shapes. Runtime Zod validation checks incoming mutations and stored catalogue data.

## Membership and identity

National ID/Iqama lookup uses an independent keyed digest with a unique database constraint; the original identifier is encrypted with AES-GCM. Member screens and CSV export show only a masked identifier. Admin sessions and member sessions use separate opaque, HttpOnly, SameSite cookies. PostgreSQL stores token digests. Credential changes revoke previous Admin sessions. Production cookies require HTTPS.

Member login sends a six-digit SMS through a dedicated Taqnyat adapter. OTP challenges bind to a member, registered phone and identity version. Requesting authentication records its own consent separately from membership and marketing choices. Verification locks the member and challenge, limits attempts, checks the five-minute expiry and identity version, consumes once and marks the registered phone verified. Identity changes revoke challenges and sessions. There is no development OTP bypass. Missing provider configuration fails before creating a challenge. An uncertain send consumes the challenge and never retries automatically. Authentication outbox records identify their SMS channel; Meta receipts cannot update them. Previously accepted WhatsApp challenges remain usable only until their original expiry.

Membership changes create history rather than overwriting the original package terms. Plan name, duration, price and benefits are snapshotted. Renewal locks the member, checks the expected membership version and records a unique request key plus request digest. An identical retry returns the previous result; a reused key with changed data fails. Active renewal extends the existing inclusive end date. Expired renewal begins today. Durations are fixed days, not calendar months. Riyadh date calculations do not depend on server timezone. Suspension takes precedence over calculated statuses.

Prices are displayed in SAR with at most two decimal places. The product does not process payment or perform financial settlement. Introducing payment/invoices requires a separate integer-minor-unit ledger and its own migration.

## Content and schedules

Settings, plans, offers and coaches are audited operational records. Content sections use explicit ordered revisions. Saving creates a private draft; publishing swaps the single published revision under an advisory transaction lock and expected-revision check. Restoration creates a new draft and must be published. Seed operations never overwrite staff edits.

Class sessions use explicit dates, times, sport, age label, coach, room, notes and cancellation status. Conflicting room/coach times are rejected under a schedule lock. Month copying preserves the nth weekday occurrence, skips absent fifth occurrences, previews conflicts and commits atomically with an idempotency key. Historical source schedules are not presented as current club commitments.

## WhatsApp delivery

Only the official Meta WhatsApp Business Platform adapter can send automated club messages. Utility templates require three body parameters in order: package name, end date, editable reminder wording. Marketing uses an approved template with title and body parameters. Exact languages, template names and approval must match the configured Meta account. Member login uses SMS separately.

The worker commits a durable claim before contacting Meta. It reloads current membership, identity version, verification and category-specific consent. It holds the member lock through the bounded provider call, so an Admin consent/phone change serializes against delivery. Provider-accepted messages are tracked separately from delivered/read receipts. A timeout or process crash leaves an uncertain state, which is reconciled using signed callbacks rather than automatically resent. Explicit rate-limit rejections retry with bounded backoff. Callback receipts are stored independently to tolerate webhook-first arrival; duplicate and out-of-order events cannot downgrade read/delivered status.

Membership and marketing consent are separately recorded with their source and timestamp. Authentication never enables those preferences. Unsupported or unconfigured templates fail visibly in Admin.

## Storage and operations

Uploads are size limited, decoded as supported raster images, rotated/resized and re-encoded to WebP without original metadata. Production objects live in S3 with immutable random keys; only the media prefix is publicly readable. Development can use private local filesystem storage behind the image route. Tokens, database dumps and keys are excluded from public/static files and Docker build context.

PostgreSQL volumes survive application restarts. Migrations run explicitly and record checksums. HTTPS is handled by Caddy. Encrypted database plus media snapshots are uploaded to a separate backup bucket and verified by an isolated restore script. Keys must be retained separately with restricted access. A deployment is accepted only after real-template delivery, offsite backup restoration and HTTPS checks pass.
