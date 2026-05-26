import { FaceEmbeddingService } from './face-embedding.service';

const DEFAULT_CELEBRITY_BLOCKLIST = [
  'scarlett johansson',
  'taylor swift',
  'tom cruise',
  'zendaya',
  'angelina jolie',
  'brad pitt',
  'margot robbie',
  'rihanna',
  'beyonce',
  'keanu reeves',
  'look like',
  'exact face of',
  'identical to',
];

export class AntiLookalikeGuard {
  private celebrityEmbeddings = new Map<string, Float32Array>();
  private similarityThreshold = 0.83;

  async initialize(): Promise<void> {
    return;
  }

  initializeCelebrityEmbeddings(embeddings: Record<string, Float32Array>): void {
    this.celebrityEmbeddings = new Map(Object.entries(embeddings));
  }

  async validateGeneration(
    generatedFrame: Buffer,
    prompt: string,
    _characterId?: string,
  ): Promise<{ safe: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (this.containsRestrictedTerms(prompt)) {
      issues.push('Real-person references detected and sanitized');
    }

    const embedding = await this.generateFaceEmbedding(generatedFrame);

    for (const [name, celebEmb] of this.celebrityEmbeddings.entries()) {
      const similarity = this.cosineSimilarity(embedding, celebEmb);
      if (similarity > this.similarityThreshold) {
        issues.push(`High similarity to restricted face (${name})`);
      }
    }

    return {
      safe: issues.length === 0,
      issues,
    };
  }

  enforcePromptPolicy(prompt?: string): {
    safe: boolean;
    sanitizedPrompt: string;
    negativePrompt: string;
    issues: string[];
  } {
    const input = prompt ?? '';
    const sanitizedPrompt = this.sanitizePrompt(input);
    const issues = sanitizedPrompt !== input ? ['Celebrity references removed from prompt'] : [];

    return {
      safe: true,
      sanitizedPrompt,
      negativePrompt: this.buildNegativePrompt(),
      issues,
    };
  }

  private containsRestrictedTerms(prompt: string): boolean {
    return DEFAULT_CELEBRITY_BLOCKLIST.some((entry) => new RegExp(entry, 'i').test(prompt));
  }

  private sanitizePrompt(prompt: string): string {
    let sanitized = prompt;

    for (const entry of DEFAULT_CELEBRITY_BLOCKLIST) {
      sanitized = sanitized.replace(new RegExp(entry, 'gi'), '[REDACTED]');
    }

    return sanitized;
  }

  private buildNegativePrompt(): string {
    return [
      'no celebrity likeness',
      'no real person identity',
      'no public figure resemblance',
      'avoid recognizable face replication',
    ].join(', ');
  }

  private async generateFaceEmbedding(frame: Buffer): Promise<Float32Array> {
    return FaceEmbeddingService.generateEmbedding(frame);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    const length = Math.min(a.length, b.length);

    for (let i = 0; i < length; i += 1) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
  }
}
