export type RiskLevel = 'red' | 'yellow' | 'green';

export interface CredentialCheckpoint {
  type: 'license' | 'dea' | 'board_cert' | 'malpractice' | 'caqh_attestation';
  expiresAt?: string;
  dueAt?: string;
}

export interface RiskProvider {
  id: string;
  name: string;
  practiceName: string;
  email: string;
  checkpoints: CredentialCheckpoint[];
}

export interface RiskFeedItem {
  providerId: string;
  providerName: string;
  practiceName: string;
  riskLevel: RiskLevel;
  reasons: string[];
}

export interface TimelineEntry {
  providerId: string;
  providerName: string;
  practiceName: string;
  checkpointType: CredentialCheckpoint['type'];
  dueAt: string;
  daysUntilDue: number;
}

export interface ExpirationTimeline {
  overdue: TimelineEntry[];
  window30Days: TimelineEntry[];
  window60Days: TimelineEntry[];
  window90Days: TimelineEntry[];
  window120Days: TimelineEntry[];
}

export interface EmailAlert {
  to: string;
  subject: string;
  body: string;
  severity: 'critical' | 'warning';
  providerId: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function buildRiskFeed(providers: RiskProvider[], now = new Date()): RiskFeedItem[] {
  return providers
    .map((provider) => scoreProvider(provider, now))
    .sort((a, b) => riskOrder(a.riskLevel) - riskOrder(b.riskLevel));
}

export function buildExpirationTimeline(providers: RiskProvider[], now = new Date()): ExpirationTimeline {
  const timeline: ExpirationTimeline = {
    overdue: [],
    window30Days: [],
    window60Days: [],
    window90Days: [],
    window120Days: [],
  };

  for (const provider of providers) {
    for (const checkpoint of provider.checkpoints) {
      const dueAt = checkpoint.expiresAt ?? checkpoint.dueAt;
      if (!dueAt) {
        continue;
      }

      const daysUntilDue = daysUntil(dueAt, now);
      const entry: TimelineEntry = {
        providerId: provider.id,
        providerName: provider.name,
        practiceName: provider.practiceName,
        checkpointType: checkpoint.type,
        dueAt,
        daysUntilDue,
      };

      if (daysUntilDue < 0) {
        timeline.overdue.push(entry);
      } else if (daysUntilDue <= 30) {
        timeline.window30Days.push(entry);
      } else if (daysUntilDue <= 60) {
        timeline.window60Days.push(entry);
      } else if (daysUntilDue <= 90) {
        timeline.window90Days.push(entry);
      } else if (daysUntilDue <= 120) {
        timeline.window120Days.push(entry);
      }
    }
  }

  for (const key of Object.keys(timeline) as (keyof ExpirationTimeline)[]) {
    timeline[key].sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  return timeline;
}

export function buildEmailAlerts(providers: RiskProvider[], now = new Date()): EmailAlert[] {
  const alerts: EmailAlert[] = [];

  for (const provider of providers) {
    for (const checkpoint of provider.checkpoints) {
      const dueAt = checkpoint.expiresAt ?? checkpoint.dueAt;
      if (!dueAt) {
        continue;
      }

      const days = daysUntil(dueAt, now);
      if (days > 30) {
        continue;
      }

      const isCritical = days < 0 || days <= 7;
      const timing = days < 0 ? `${Math.abs(days)} day(s) overdue` : `due in ${days} day(s)`;

      alerts.push({
        to: provider.email,
        subject: `${isCritical ? 'Critical' : 'Warning'} credential alert: ${provider.name}`,
        body: `${provider.name} (${provider.practiceName}) has ${checkpoint.type} ${timing} (${dueAt}).`,
        severity: isCritical ? 'critical' : 'warning',
        providerId: provider.id,
      });
    }
  }

  return alerts.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
}

function scoreProvider(provider: RiskProvider, now: Date): RiskFeedItem {
  const reasons: string[] = [];
  let riskLevel: RiskLevel = 'green';

  for (const checkpoint of provider.checkpoints) {
    const dueAt = checkpoint.expiresAt ?? checkpoint.dueAt;
    if (!dueAt) {
      continue;
    }

    const days = daysUntil(dueAt, now);
    if (days < 0) {
      riskLevel = 'red';
      reasons.push(`${checkpoint.type} overdue by ${Math.abs(days)} day(s)`);
      continue;
    }

    if (days <= 30) {
      if (riskLevel !== 'red') {
        riskLevel = 'yellow';
      }
      reasons.push(`${checkpoint.type} due in ${days} day(s)`);
    }
  }

  if (reasons.length === 0) {
    reasons.push('No upcoming expirations within 30 days');
  }

  return {
    providerId: provider.id,
    providerName: provider.name,
    practiceName: provider.practiceName,
    riskLevel,
    reasons,
  };
}

function daysUntil(isoDate: string, now: Date): number {
  const diffMs = new Date(isoDate).getTime() - now.getTime();
  return Math.floor(diffMs / DAY_IN_MS);
}

function riskOrder(level: RiskLevel): number {
  if (level === 'red') {
    return 0;
  }
  if (level === 'yellow') {
    return 1;
  }
  return 2;
}

function severityOrder(level: EmailAlert['severity']): number {
  if (level === 'critical') {
    return 0;
  }
  return 1;
}
