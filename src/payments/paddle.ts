import { createHmac, timingSafeEqual } from 'node:crypto';

export type BillingTier = 'entry' | 'anchor' | 'power';

export interface TierPrice {
  currency: 'USD';
  interval: 'month';
  amountCents: number;
}

export interface PricingTier {
  key: BillingTier;
  displayName: string;
  price: TierPrice;
  notes: string[];
}

export interface AnchorTierRange {
  minCents: number;
  maxCents: number;
  recommendedDefaultCents: number;
}

export interface Stage0PricingCatalog {
  entry: PricingTier;
  anchor: PricingTier;
  power: PricingTier;
  anchorRange: AnchorTierRange;
}

export interface PaddleEnvironment {
  mode: 'sandbox';
  vendorId: string;
  apiKey: string;
  webhookSecret: string;
  checkoutUrl: string;
}

export interface CheckoutRequest {
  tier: BillingTier;
  providerCount: number;
  customerId: string;
  customerEmail: string;
  anchorUnitPriceCents?: number;
}

export interface CheckoutSessionInput {
  customerId: string;
  customerEmail: string;
  customData: Record<string, string | number>;
  items: Array<{ description: string; quantity: number; unitPriceCents: number }>;
  successUrl: string;
  cancelUrl: string;
}

export interface WebhookVerificationInput {
  rawBody: string;
  signatureHeader: string;
  secret: string;
}

export interface WebhookEvent {
  eventType: string;
  eventId: string;
  customerId?: string;
  subscriptionId?: string;
}

export interface BillingActivation {
  customerId: string;
  subscriptionId: string;
  status: 'active';
}

export const STAGE0_PRICING: Stage0PricingCatalog = {
  entry: {
    key: 'entry',
    displayName: 'Entry',
    price: {
      currency: 'USD',
      interval: 'month',
      amountCents: 3900,
    },
    notes: ['Per provider, per month'],
  },
  anchor: {
    key: 'anchor',
    displayName: 'Anchor',
    price: {
      currency: 'USD',
      interval: 'month',
      amountCents: 6900,
    },
    notes: ['Per provider, per month', 'Includes payer-enrollment tracker'],
  },
  power: {
    key: 'power',
    displayName: 'Power',
    price: {
      currency: 'USD',
      interval: 'month',
      amountCents: 9900,
    },
    notes: ['Per provider, per month', 'Includes diff-and-fix engine + concierge'],
  },
  anchorRange: {
    minCents: 5900,
    maxCents: 7900,
    recommendedDefaultCents: 6900,
  },
};

export function getPaddleEnvironmentFromEnv(env: NodeJS.ProcessEnv): PaddleEnvironment {
  const vendorId = env.PADDLE_VENDOR_ID;
  const apiKey = env.PADDLE_API_KEY;
  const webhookSecret = env.PADDLE_WEBHOOK_SECRET;

  if (!vendorId || !apiKey || !webhookSecret) {
    throw new Error('Missing required Paddle env vars: PADDLE_VENDOR_ID, PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET');
  }

  return {
    mode: 'sandbox',
    vendorId,
    apiKey,
    webhookSecret,
    checkoutUrl: 'https://sandbox-checkout.paddle.com',
  };
}

export function resolveTierUnitPriceCents(
  tier: BillingTier,
  anchorUnitPriceCents?: number,
): number {
  if (tier !== 'anchor') {
    return STAGE0_PRICING[tier].price.amountCents;
  }

  const selected = anchorUnitPriceCents ?? STAGE0_PRICING.anchorRange.recommendedDefaultCents;

  if (selected < STAGE0_PRICING.anchorRange.minCents || selected > STAGE0_PRICING.anchorRange.maxCents) {
    throw new Error('anchorUnitPriceCents must be within 5900-7900 cents ($59-$79)');
  }

  return selected;
}

export function buildSandboxCheckoutSession(
  request: CheckoutRequest,
  urls: { successUrl: string; cancelUrl: string },
): CheckoutSessionInput {
  if (request.providerCount < 1) {
    throw new Error('providerCount must be at least 1');
  }

  const unitPriceCents = resolveTierUnitPriceCents(request.tier, request.anchorUnitPriceCents);

  return {
    customerId: request.customerId,
    customerEmail: request.customerEmail,
    customData: {
      tier: request.tier,
      providerCount: request.providerCount,
      customerId: request.customerId,
    },
    items: [
      {
        description: `${request.tier} tier subscription`,
        quantity: request.providerCount,
        unitPriceCents,
      },
    ],
    successUrl: urls.successUrl,
    cancelUrl: urls.cancelUrl,
  };
}

export function buildPaddleWebhookSignature(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifyPaddleWebhookSignature(input: WebhookVerificationInput): boolean {
  const expected = buildPaddleWebhookSignature(input.rawBody, input.secret);

  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(input.signatureHeader, 'hex');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function parsePaddleWebhookEvent(rawBody: string): WebhookEvent {
  const payload = JSON.parse(rawBody) as {
    event_type?: string;
    event_id?: string;
    data?: { customer_id?: string; subscription_id?: string };
  };

  if (!payload.event_type || !payload.event_id) {
    throw new Error('Invalid Paddle webhook event payload');
  }

  return {
    eventType: payload.event_type,
    eventId: payload.event_id,
    customerId: payload.data?.customer_id,
    subscriptionId: payload.data?.subscription_id,
  };
}

export function handlePaddleWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): BillingActivation | null {
  if (!verifyPaddleWebhookSignature({ rawBody, signatureHeader, secret })) {
    throw new Error('Invalid Paddle webhook signature');
  }

  const event = parsePaddleWebhookEvent(rawBody);

  if (
    event.eventType === 'subscription.created' &&
    event.customerId &&
    event.subscriptionId
  ) {
    return {
      customerId: event.customerId,
      subscriptionId: event.subscriptionId,
      status: 'active',
    };
  }

  return null;
}
