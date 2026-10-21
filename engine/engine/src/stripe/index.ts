export const STRIPE_CONFIG = {
  apiVersion: '2025-09_Stable',
  currency: 'gbp',
};

export type StripeConfig = {
  apiVersion: string;
  currency: string;
};

export class StripeService {
  private readonly config: StripeConfig;

  constructor(config: StripeConfig = STRIPE_CONFIG) {
    this.config = config;
  }

  getConfig(): StripeConfig {
    return this.config;
  }
}
