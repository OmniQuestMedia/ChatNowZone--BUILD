// FIZ: PAYLOAD-001 — REDBOOK rate card integration tests
// Asserts bundle pricing, Diamond quotes, and Room-Heat payout resolution
// all read cleanly through the canonical governance constants.

import { RedbookRateCardService } from '../../services/ledger';
import {
  PIXEL_LEGACY,
  REDBOOK_RATE_CARDS,
  DIAMOND_TIER,
} from '../../services/core-api/src/config/governance.config';
import { GovernanceConfig } from '../../services/core-api/src/governance/governance.config';

const svc = new RedbookRateCardService();

describe('RedbookRateCardService — Tease Regular bundles', () => {
  it.each(REDBOOK_RATE_CARDS.TEASE_REGULAR.map((r) => r.tokens))(
    'quotes guest price for %i-token bundle',
    (tokens) => {
      const quote = svc.quoteTeaseRegular(tokens, 'guest');
      const row = REDBOOK_RATE_CARDS.TEASE_REGULAR.find((r) => r.tokens === tokens)!;
      expect(quote.priceUsd).toBe(row.guest_usd);
      expect(quote.creatorPayoutPerToken).toBe(row.creator_payout_per_token);
      expect(quote.unitPriceUsd).toBeCloseTo(row.guest_usd / tokens, 6);
    },
  );

  it('applies member pricing to creator users', () => {
    const tokens = REDBOOK_RATE_CARDS.TEASE_REGULAR[2].tokens;
    const expected = REDBOOK_RATE_CARDS.TEASE_REGULAR[2].member_usd;
    const quote = svc.quoteTeaseRegular(tokens, 'creator');
    expect(quote.priceUsd).toBe(expected);
  });

  it('throws on an unknown bundle size', () => {
    expect(() => svc.quoteTeaseRegular(777, 'guest')).toThrow(/bundle not found/);
  });
});

describe('RedbookRateCardService — Diamond Tier', () => {
  it.each(DIAMOND_TIER.VOLUME_TIERS)('resolves the $min_tokens bracket', (bracket) => {
    const quote = svc.quoteDiamond(bracket.min_tokens, 14);
    expect(quote.baseRate).toBe(bracket.base_rate);
    expect(quote.velocityMultiplier).toBe(DIAMOND_TIER.VELOCITY_MULTIPLIERS.DAYS_14);
  });

  it('applies the 180-day velocity multiplier', () => {
    const quote = svc.quoteDiamond(30_000, 180);
    expect(quote.velocityMultiplier).toBe(DIAMOND_TIER.VELOCITY_MULTIPLIERS.DAYS_180);
    expect(quote.effectivePayoutPerToken).toBeCloseTo(
      quote.baseRate * DIAMOND_TIER.VELOCITY_MULTIPLIERS.DAYS_180,
      6,
    );
  });

  it('refuses volumes below the Diamond entry threshold', () => {
    expect(() => svc.quoteDiamond(5_000, 14)).toThrow(/below entry threshold/);
  });
});

describe('RedbookRateCardService — FFS payout resolution', () => {
  it('returns Cold rate for heat score 0', () => {
    const rate = svc.resolveCreatorPayoutRate({ heatScore: 0, diamondFloorActive: false });
    expect(rate.level).toBe('cold');
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_COLD.toNumber());
    expect(rate.appliedFloor).toBe(false);
  });

  it('returns Inferno rate at heat 86+', () => {
    const rate = svc.resolveCreatorPayoutRate({ heatScore: 95, diamondFloorActive: false });
    expect(rate.level).toBe('inferno');
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_INFERNO.toNumber());
  });

  it('applies the Diamond floor when live rate is below $0.080', () => {
    const rate = svc.resolveCreatorPayoutRate({ heatScore: 10, diamondFloorActive: true });
    expect(rate.appliedFloor).toBe(true);
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_DIAMOND_FLOOR.toNumber());
  });

  it('prefers live rate over Diamond floor when live rate is higher', () => {
    const rate = svc.resolveCreatorPayoutRate({ heatScore: 100, diamondFloorActive: true });
    expect(rate.appliedFloor).toBe(false);
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_INFERNO.toNumber());
  });
});

describe('RedbookRateCardService — Pixel Legacy floor (PIXEL-LEGACY-003)', () => {
  it('does NOT apply the Pixel Legacy floor when live rate (cold $0.075) is above $0.07', () => {
    // Under the current heat-band matrix, cold ($0.075) > Pixel Legacy floor
    // ($0.07), so the floor is not raised. Verifies the comparison logic
    // is `live < floor`, not `live <= floor` or `always-floor`.
    const rate = svc.resolveCreatorPayoutRate({
      heatScore: 0,
      diamondFloorActive: false,
      isPixelLegacy: true,
    });
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_COLD.toNumber());
    expect(rate.appliedPixelLegacyFloor).toBe(false);
    expect(rate.appliedFloor).toBe(false);
  });

  it('returns the live inferno rate ($0.090) for Pixel Legacy creators at heat 95', () => {
    const rate = svc.resolveCreatorPayoutRate({
      heatScore: 95,
      diamondFloorActive: false,
      isPixelLegacy: true,
    });
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_INFERNO.toNumber());
    expect(rate.appliedPixelLegacyFloor).toBe(false);
    expect(rate.appliedDiamondFloor).toBe(false);
  });

  it('Diamond floor wins over Pixel Legacy floor when both are active', () => {
    // Diamond floor ($0.080) > Pixel Legacy floor ($0.07). When both flags
    // are true and live is below both, Diamond wins because it is applied
    // first in the composition order and Pixel Legacy will then see
    // rate=$0.080 which is already above its floor.
    const rate = svc.resolveCreatorPayoutRate({
      heatScore: 0,
      diamondFloorActive: true,
      isPixelLegacy: true,
    });
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_DIAMOND_FLOOR.toNumber());
    expect(rate.appliedDiamondFloor).toBe(true);
    // Pixel Legacy floor not applied because Diamond already raised above $0.07.
    expect(rate.appliedPixelLegacyFloor).toBe(false);
    expect(rate.appliedFloor).toBe(true);
  });

  it('Pixel Legacy floor constant matches the documented $0.07 value', () => {
    // Smoke test on the constant itself — this catches accidental edits to
    // governance.config.ts that would silently change the Pixel Legacy
    // payout band.
    expect(PIXEL_LEGACY.PAYOUT_FLOOR_USD).toBe(0.07);
    expect(PIXEL_LEGACY.PAYOUT_CEILING_USD).toBe(0.09);
  });
});
