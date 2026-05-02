import { describe, expect, it } from 'vitest';
import {
  buildEmailAlerts,
  buildExpirationTimeline,
  buildRiskFeed,
  type RiskProvider,
} from '../src/risk/dashboard';

const NOW = new Date('2026-05-02T00:00:00.000Z');

function providersFixture(): RiskProvider[] {
  return [
    {
      id: 'prov-1',
      name: 'Dr. Red',
      practiceName: 'North Clinic',
      email: 'ops@north.test',
      checkpoints: [
        {
          type: 'license',
          expiresAt: '2026-04-30T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'prov-2',
      name: 'Dr. Yellow',
      practiceName: 'North Clinic',
      email: 'ops@north.test',
      checkpoints: [
        {
          type: 'caqh_attestation',
          dueAt: '2026-05-20T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'prov-3',
      name: 'Dr. Green',
      practiceName: 'South Clinic',
      email: 'ops@south.test',
      checkpoints: [
        {
          type: 'dea',
          expiresAt: '2026-08-20T00:00:00.000Z',
        },
      ],
    },
  ];
}

describe('buildRiskFeed', () => {
  it('classifies providers into red/yellow/green and sorts by severity', () => {
    const feed = buildRiskFeed(providersFixture(), NOW);

    expect(feed.map((item) => item.riskLevel)).toEqual(['red', 'yellow', 'green']);
    expect(feed[0].reasons[0]).toContain('overdue');
    expect(feed[1].reasons[0]).toContain('due in');
    expect(feed[2].reasons[0]).toContain('No upcoming expirations within 30 days');
  });
});

describe('buildExpirationTimeline', () => {
  it('maps events into overdue and 30/60/90/120 day windows', () => {
    const timeline = buildExpirationTimeline(
      [
        {
          id: 'prov-1',
          name: 'Dr. A',
          practiceName: 'A',
          email: 'a@test',
          checkpoints: [
            { type: 'license', expiresAt: '2026-04-30T00:00:00.000Z' },
            { type: 'dea', expiresAt: '2026-05-25T00:00:00.000Z' },
            { type: 'board_cert', expiresAt: '2026-06-20T00:00:00.000Z' },
            { type: 'malpractice', expiresAt: '2026-07-20T00:00:00.000Z' },
            { type: 'caqh_attestation', dueAt: '2026-08-10T00:00:00.000Z' },
          ],
        },
      ],
      NOW,
    );

    expect(timeline.overdue).toHaveLength(1);
    expect(timeline.window30Days).toHaveLength(1);
    expect(timeline.window60Days).toHaveLength(1);
    expect(timeline.window90Days).toHaveLength(1);
    expect(timeline.window120Days).toHaveLength(1);
  });
});

describe('buildEmailAlerts', () => {
  it('creates critical and warning email alerts for <=30 day and overdue events', () => {
    const alerts = buildEmailAlerts(providersFixture(), NOW);

    expect(alerts).toHaveLength(2);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].subject).toContain('Critical credential alert');
    expect(alerts[1].severity).toBe('warning');
    expect(alerts[1].subject).toContain('Warning credential alert');
  });
});
