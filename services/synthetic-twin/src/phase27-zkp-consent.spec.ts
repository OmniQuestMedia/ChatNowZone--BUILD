import { AntiLookalikeGuard } from '../../../src/domain/anti-lookalike.guard';
import { zkpConsentService } from '../../../src/services/consent/zkp-consent.service';
import { createHash } from 'crypto';

describe('Phase 2.7 ZKP consent enforcement', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires valid consent proof before generation validation', async () => {
    const guard = new AntiLookalikeGuard();

    await expect(
      guard.validateGenerationWithContext(Buffer.from('frame'), {
        mode: 'fantasy',
        prompt: 'original concept art',
        characterId: 'creator-character',
      }),
    ).rejects.toThrow('Valid zero-knowledge consent proof required');
  });

  it('accepts fallback consent proof verification path', async () => {
    const signals = ['0xabc', 'char-hash', '123'];
    const commitment = createHash('sha256').update(JSON.stringify(signals)).digest('hex');

    const verified = await zkpConsentService.verifyConsentProof(
      { mode: 'dev-fallback', commitment },
      signals,
    );

    expect(verified).toBe(true);
  });

  it('applies context-aware guardrails after consent proof verification', async () => {
    const guard = new AntiLookalikeGuard();
    guard.initializeCelebrityEmbeddings({ celeb: new Float32Array(512).fill(0.5) });

    jest.spyOn(zkpConsentService, 'verifyConsentProof').mockResolvedValue(true);

    const result = await guard.validateGenerationWithContext(Buffer.alloc(16), {
      mode: 'fantasy',
      prompt: 'real person inspired fantasy portrait',
      characterId: 'character-123',
      zkpConsentProof: { proof: { ok: true }, publicSignals: ['a', 'b', 'c'] },
    });

    expect(result.safe).toBe(false);
    expect(result.issues.some((issue) => issue.includes('Fantasy mode cannot reference'))).toBe(
      true,
    );
  });
});
