import { AntiLookalikeGuard } from '../../../src/domain/anti-lookalike.guard';
import { FaceEmbeddingService } from '../../../src/domain/face-embedding.service';
import { motionLibraryRepository } from '../../../src/domain/motion/motion-library.repository';

describe('Phase 2.7 motion + anti-lookalike', () => {
  it('seeds at least 50 anonymized generic motion profiles', () => {
    expect(motionLibraryRepository.count()).toBeGreaterThanOrEqual(50);
  });

  it('sanitizes restricted prompt terms and emits negative prompt', () => {
    const guard = new AntiLookalikeGuard();
    const result = guard.enforcePromptPolicy('Make her look like Taylor Swift with same face');

    expect(result.sanitizedPrompt).toContain('[REDACTED]');
    expect(result.negativePrompt).toContain('no celebrity likeness');
  });

  it('flags high-similarity generated frames against celebrity embeddings', async () => {
    const guard = new AntiLookalikeGuard();
    const frame = Buffer.from('same-frame');
    const embedding = await FaceEmbeddingService.generateEmbedding(frame);

    guard.initializeCelebrityEmbeddings({ celebrity_test: embedding });

    const result = await guard.validateGeneration(frame, 'safe original prompt');
    expect(result.safe).toBe(false);
    expect(result.issues.some((issue) => issue.includes('High similarity'))).toBe(true);
  });
});
