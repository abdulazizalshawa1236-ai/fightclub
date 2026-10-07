import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  membershipStatus,
  remainingDays,
  renewalDates,
  todayRiyadh,
} from './membership-domain';
test('Riyadh calendar flips before UTC midnight', () =>
  assert.equal(todayRiyadh(new Date('2026-10-07T21:00:00Z')), '2026-10-08'));
test('inclusive expiry, warning, upcoming and suspension precedence', () => {
  assert.equal(membershipStatus('2026-10-01', '2026-10-07', false, 14, '2026-10-07'), 'expiring');
  assert.equal(membershipStatus('2026-10-01', '2026-10-07', false, 14, '2026-10-08'), 'expired');
  assert.equal(membershipStatus('2026-11-01', '2026-12-01', true, 14, '2026-10-07'), 'suspended');
  assert.equal(membershipStatus('2026-11-01', '2026-12-01', false, 14, '2026-10-07'), 'upcoming');
  assert.equal(membershipStatus('2026-10-01', '2027-10-07', false, 14, '2026-10-07'), 'active');
  assert.equal(remainingDays('2026-10-07', '2026-10-07'), 1);
});
test('renewal extends a valid end and expired renewal starts today', () => {
  assert.deepEqual(renewalDates('2026-01-01', '2026-10-10', 90, '2026-10-07'), {
    startDate: '2026-01-01',
    endDate: '2027-01-08',
  });
  assert.deepEqual(renewalDates('2026-01-01', '2026-10-06', 90, '2026-10-07'), {
    startDate: '2026-10-07',
    endDate: '2027-01-04',
  });
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});
