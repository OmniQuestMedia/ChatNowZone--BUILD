import { createHash } from 'crypto';

export class FaceEmbeddingService {
  static async generateEmbedding(input: Buffer): Promise<Float32Array> {
    const salt = process.env.ARC_FACE_EMBEDDING_SALT || 'dev-arcface-salt';
    const digest = createHash('sha512').update(salt).update(input).digest();
    const vector = new Float32Array(512);

    for (let i = 0; i < vector.length; i += 1) {
      const byte = digest[i % digest.length];
      vector[i] = (byte - 127.5) / 127.5;
    }

    return vector;
  }
}
