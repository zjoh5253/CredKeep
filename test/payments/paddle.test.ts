import { describe, expect, it } from 'vitest';
import {
  STAGE0_PRICING,
  buildPaddleWebhookSignature,
  buildSandboxCheckoutSession,
  getPaddleEnvironmentFromEnv,
  handlePaddleWebhook,
  resolveTierUnitPriceCents,
  verifyPaddleWebhookSignature,
} from '../../src/payments/paddle';

describe('STAGE0_PRICING', () => {
  it('defines the required stage-0 tier prices', () => {
    expect(STAGE0_PRICING.entry.price.amountCents).toBe(3900);
    expect(STAGE0_PRICING.anchorRange).toEqual({
      minCents: 5900,
      maxCents: 7900,
      recommendedDefaultCents: 6900,
    });
    expect(STAGE0_PRICING.power.price.amountCents).toBe(9900);
  });
});

describe('resolveTierUnitPriceCents', () => {
  it('returns fixed price for entry/power and ranged price for anchor', () => {
    expect(resolveTierUnitPriceCents('entry')).toBe(3900);
    expect(resolveTierUnitPriceCents('power')).toBe(9900);
    expect(resolveTierUnitPriceCents('anchor')).toBe(6900);
    expect(resolveTierUnitPriceCents('anchor', 7500)).toBe(7500);
  });

  it('throws for out-of-range anchor custom pricing', () => {
    expect(() => resolveTierUnitPriceCents('anchor', 5800)).toThrow(
      'anchorUnitPriceCents must be within 5900-7900 cents ($59-$79)',
    );
  });
});

describe('buildSandboxCheckoutSession', () => {
  it('builds a per-provider checkout item payload', () => {
    const session = buildSandboxCheckoutSession(
      {
        tier: 'anchor',
        providerCount: 3,
        customerId: 'cust_123',
        customerEmail: 'ops@credkeep.test',
        anchorUnitPriceCents: 6900,
      },
      {
        successUrl: 'https://app.credkeep.test/billing/success',
        cancelUrl: 'https://app.credkeep.test/billing/cancel',
      },
    );

    expect(session.items[0]).toEqual({
      description: 'anchor tier subscription',
      quantity: 3,
      unitPriceCents: 6900,
    });
    expect(session.customData).toEqual({
      tier: 'anchor',
      providerCount: 3,
      customerId: 'cust_123',
    });
  });
});

describe('paddle env + webhook flow', () => {
  it('loads sandbox env and validates webhook signature', () => {
    const env = getPaddleEnvironmentFromEnv({
      PADDLE_VENDOR_ID: 'vendor_abc',
      PADDLE_API_KEY: 'api_abc',
      PADDLE_WEBHOOK_SECRET: 'whsec_123',
    });

    expect(env.mode).toBe('sandbox');
    expect(env.checkoutUrl).toBe('https://sandbox-checkout.paddle.com');

    const rawBody = JSON.stringify({
      event_type: 'subscription.created',
      event_id: 'evt_1',
      data: {
        customer_id: 'cust_123',
        subscription_id: 'sub_123',
      },
    });

    const signature = buildPaddleWebhookSignature(rawBody, env.webhookSecret);

    expect(
      verifyPaddleWebhookSignature({
        rawBody,
        signatureHeader: signature,
        secret: env.webhookSecret,
      }),
    ).toBe(true);

    const activation = handlePaddleWebhook(rawBody, signature, env.webhookSecret);
    expect(activation).toEqual({
      customerId: 'cust_123',
      subscriptionId: 'sub_123',
      status: 'active',
    });
  });

  it('rejects invalid webhook signatures', () => {
    const rawBody = JSON.stringify({ event_type: 'subscription.created', event_id: 'evt_1' });

    expect(() => handlePaddleWebhook(rawBody, 'deadbeef', 'whsec_123')).toThrow(
      'Invalid Paddle webhook signature',
    );
  });
});
