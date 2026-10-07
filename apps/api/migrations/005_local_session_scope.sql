ALTER TABLE sessions ADD COLUMN local_preview boolean NOT NULL DEFAULT false;
UPDATE sessions s SET local_preview=true WHERE s.kind='member' AND EXISTS(
  SELECT 1 FROM login_challenges c WHERE c.member_id=s.actor_id AND c.delivery_status='local_preview' AND c.consumed_at=s.created_at
);
UPDATE members m SET phone_verified_at=NULL WHERE EXISTS(
  SELECT 1 FROM login_challenges c WHERE c.member_id=m.id AND c.delivery_status='local_preview' AND c.consumed_at=m.phone_verified_at
);
