ALTER TABLE sessions ADD COLUMN hosted_demo boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD CONSTRAINT hosted_demo_member_session
  CHECK(NOT hosted_demo OR (kind='member' AND NOT local_preview));
ALTER TABLE outbox DROP CONSTRAINT outbox_channel;
ALTER TABLE outbox ADD CONSTRAINT outbox_channel CHECK(channel IN ('sms','whatsapp','local','demo'));
ALTER TABLE outbox ADD CONSTRAINT hosted_demo_delivery
  CHECK(channel<>'demo' OR (status='preview' AND category='authentication' AND provider_id IS NULL));
