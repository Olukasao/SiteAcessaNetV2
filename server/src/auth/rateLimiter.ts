import { AppError } from "../errors.js";

interface Bucket {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

export interface RateLimitRule {
  limit: number;
  windowMs: number;
  cooldownMs?: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  consume(key: string, rule: RateLimitRule) {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (current?.blockedUntil && current.blockedUntil > now) {
      throw new AppError(429, "RATE_LIMITED", "Muitas tentativas. Tente novamente em instantes.", {
        retryAfterSeconds: Math.ceil((current.blockedUntil - now) / 1000)
      });
    }

    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      return;
    }

    current.count += 1;

    if (current.count > rule.limit) {
      current.blockedUntil = now + (rule.cooldownMs ?? rule.windowMs);
      throw new AppError(429, "RATE_LIMITED", "Muitas tentativas. Tente novamente em instantes.", {
        retryAfterSeconds: Math.ceil(((current.blockedUntil ?? current.resetAt) - now) / 1000)
      });
    }
  }

  reset() {
    this.buckets.clear();
  }
}
