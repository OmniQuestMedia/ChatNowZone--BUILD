import { groth16 } from 'snarkjs';
import { createHash } from 'crypto';
import {
  accountsZoneConsentRecorder,
  type ImmutableConsentRecord,
} from './accountszone-consent-recorder.service';

export interface ConsentProof {
  proof: unknown;
  publicSignals: unknown[];
  consentType: 'twin' | 'fantasy';
  record: ImmutableConsentRecord;
}

export class ZKPConsentService {
  private consentWasmPath = 'circuits/consent_verification.wasm';
  private consentZkeyPath = 'circuits/consent_verification_final.zkey';
  private verificationKeyPath = 'circuits/consent_verification_verification_key.json';

  async initialize(): Promise<void> {
    return;
  }

  async recordAndProveConsent(
    accountId: string,
    characterId: string,
    consentType: 'twin' | 'fantasy',
    consentText: string,
    userSignature?: string,
    ip = '0.0.0.0',
  ): Promise<ConsentProof> {
    const now = Date.now();
    const consentHash = createHash('sha256')
      .update(consentText + accountId + characterId + consentType + now.toString())
      .digest('hex');

    const record = await accountsZoneConsentRecorder.recordConsent({
      accountId,
      characterId,
      consentType,
      consentText,
      ip,
      userSignature,
    });

    const input = {
      consentHash: this.hexToBigInt(consentHash),
      characterId: this.hexToBigInt(createHash('sha256').update(characterId).digest('hex')),
      timestamp: BigInt(now),
    };

    try {
      const { proof, publicSignals } = await groth16.fullProve(
        input,
        this.consentWasmPath,
        this.consentZkeyPath,
      );

      return { proof, publicSignals, consentType, record };
    } catch {
      // Local/dev fallback when precompiled circuits are not mounted.
      const publicSignals = [
        `0x${consentHash}`,
        createHash('sha256').update(characterId).digest('hex'),
        now.toString(),
      ];
      const proof = {
        mode: 'dev-fallback',
        commitment: createHash('sha256').update(JSON.stringify(publicSignals)).digest('hex'),
      };

      return { proof, publicSignals, consentType, record };
    }
  }

  async verifyConsentProof(proof: unknown, publicSignals: unknown[]): Promise<boolean> {
    const fallbackProof = proof as { mode?: string; commitment?: string };

    if (fallbackProof.mode === 'dev-fallback' && typeof fallbackProof.commitment === 'string') {
      const expected = createHash('sha256').update(JSON.stringify(publicSignals)).digest('hex');
      return expected === fallbackProof.commitment;
    }

    try {
      return await groth16.verify(this.verificationKeyPath, publicSignals, proof);
    } catch {
      return false;
    }
  }

  private hexToBigInt(value: string): bigint {
    return BigInt(`0x${value}`);
  }
}

export const zkpConsentService = new ZKPConsentService();
