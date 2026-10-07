-- Exact timetable from original commit c37ac11f36cb701c2c22efd85beb9b667371bc70.
-- SQLite snapshot: work/pre-release-2026-10-06/club.db, 1,565 classes,
-- 2026-10-01 through 2027-09-30. Blank source coaches remain unassigned.
-- This finite date range is preserved; future years are managed by staff.
SELECT pg_advisory_xact_lock(hashtext('club.schedule'));
CREATE TEMP TABLE source_schedule ON COMMIT DROP AS
WITH rules(weekdays,sport,start_time,end_time,title_ar,title_en,age_ar,age_en,notes_ar,notes_en) AS (
  VALUES
  (ARRAY[0,2,4], 'muay-thai', '17:00', '18:30', 'مواي تاي', 'Muay Thai', 'أطفال', 'Children', 'صالة A + صالة B', 'Hall A + Hall B'),
  (ARRAY[0,2,4], 'taekwondo', '18:30', '20:00', 'تايكوندو', 'Taekwondo', 'مبتدئون', 'Beginners', 'صالة A', 'Hall A'),
  (ARRAY[0,2,4], 'muay-thai', '18:30', '20:00', 'مواي تاي', 'Muay Thai', 'مبتدئون', 'Beginners', 'صالة B', 'Hall B'),
  (ARRAY[0,2,4], 'boxing', '20:00', '21:30', 'ملاكمة', 'Boxing', 'كبار', 'Adults', 'صالة A', 'Hall A'),
  (ARRAY[0,2,4], 'muay-thai', '20:00', '21:30', 'مواي تاي', 'Muay Thai', 'متقدمون', 'Advanced', 'صالة B', 'Hall B'),
  (ARRAY[1,3,6], 'boxing', '16:00', '17:00', 'ملاكمة الفتيات', 'Girls Boxing', 'فتيات', 'Girls', 'صالة A + صالة B', 'Hall A + Hall B'),
  (ARRAY[1,3,6], 'boxing', '17:00', '18:30', 'ملاكمة', 'Boxing', 'أطفال', 'Children', 'صالة A', 'Hall A'),
  (ARRAY[1,3,6], 'taekwondo', '17:00', '18:30', 'تايكوندو', 'Taekwondo', 'أطفال متقدمون', 'Advanced children', 'صالة B', 'Hall B'),
  (ARRAY[1,3,6], 'taekwondo', '18:30', '20:00', 'تايكوندو', 'Taekwondo', 'كبار متقدمون', 'Advanced adults', 'صالة A + صالة B', 'Hall A + Hall B'),
  (ARRAY[1,3,6], 'boxing', '20:00', '21:30', 'ملاكمة', 'Boxing', 'كبار', 'Adults', 'صالة A + صالة B', 'Hall A + Hall B')
), sessions AS (
  SELECT to_char(day,'YYYY-MM-DD') AS date, rules.*,
    md5('fightclub:c37ac11f36cb701c2c22efd85beb9b667371bc70:' ||
      to_char(day,'YYYY-MM-DD') || ':' || start_time || ':' || title_en || ':' || age_en || ':' || notes_en) AS digest
  FROM generate_series(date '2026-10-01',date '2027-09-30',interval '1 day') AS days(day)
  JOIN rules ON extract(dow FROM day)::integer=ANY(rules.weekdays)
), identified AS (
  SELECT *, (substr(digest,1,8)||'-'||substr(digest,9,4)||'-5'||substr(digest,14,3)||'-8'||substr(digest,18,3)||'-'||substr(digest,21,12))::uuid AS id
  FROM sessions
)
SELECT id, jsonb_build_object(
  'id',id,'date',date,'startTime',start_time,'endTime',end_time,'sportId',sport,
  'title',jsonb_build_object('ar',title_ar,'en',title_en),
  'ageGroup',jsonb_build_object('ar',age_ar,'en',age_en),
  'coachId',NULL,'room',notes_en,
  'notes',jsonb_build_object('ar',notes_ar,'en',notes_en),'status','scheduled'
) AS data FROM identified;

-- Refuse a conflicting staff timetable rather than overwriting it or double booking.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM source_schedule incoming JOIN classes existing
      ON incoming.data->>'date'=existing.data->>'date'
      AND incoming.data->>'startTime'<existing.data->>'endTime'
      AND existing.data->>'startTime'<incoming.data->>'endTime'
      AND existing.data->>'status'='scheduled'
      AND (incoming.data->>'room'=existing.data->>'room'
        OR (incoming.data->>'room'='Hall A + Hall B' AND existing.data->>'room' IN ('Hall A','Hall B'))
        OR (existing.data->>'room'='Hall A + Hall B' AND incoming.data->>'room' IN ('Hall A','Hall B')))
    WHERE incoming.id<>existing.id AND incoming.data-'id'<>existing.data-'id'
  ) THEN
    RAISE EXCEPTION 'Source timetable conflicts with existing staff classes. Reconcile those sessions before applying migration 006.';
  END IF;
END $$;

WITH imported AS (
  INSERT INTO classes(id,data)
  SELECT incoming.id,incoming.data FROM source_schedule incoming
  WHERE NOT EXISTS (SELECT 1 FROM classes existing WHERE existing.data-'id'=incoming.data-'id')
  ON CONFLICT(id) DO NOTHING
  RETURNING id
)
INSERT INTO audit_events(id,actor,action,details)
SELECT 'cec675fb-5c37-5216-81f3-653eddb6b065'::uuid,'system:migration:006','schedule.imported',
  jsonb_build_object('sourceCommit','c37ac11f36cb701c2c22efd85beb9b667371bc70',
    'sourceRows',1565,'created',count(*),'from','2026-10-01','to','2027-09-30')
FROM imported;
