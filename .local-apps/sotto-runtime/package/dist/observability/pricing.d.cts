import { c as TokenUsage } from '../index-BYxnMqfP.cjs';
import 'zod';
import '../ai/browser.cjs';

interface TokenPricing {
    inputPerMillion: number | null;
    outputPerMillion: number | null;
    cachedInputPerMillion?: number | null;
    cacheWritePerMillion?: number | null;
}
/** Token charges only. Missing measurements or necessary rates never imply zero cost. */
declare function estimateTokenCost(usage: TokenUsage, pricing: TokenPricing | null): number | null;

export { type TokenPricing, estimateTokenCost };
