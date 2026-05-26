import { MotionProfile, RetargetedMotionFrame } from '../../domain/motion/motion-profile.types';
import { motionLibraryRepository } from '../../domain/motion/motion-library.repository';
import { MotionExtractorService } from './motion-extractor.service';

export class ExpressionRetargeter {
  private readonly motionExtractor = new MotionExtractorService();

  async initialize(): Promise<void> {
    await this.motionExtractor.initialize();
  }

  async retargetMotion(
    sourceVideoFrames: Buffer[],
    targetCharacterEmbeddings: Record<string, number>,
    motionProfileId?: string,
  ): Promise<RetargetedMotionFrame[]> {
    const extracted = await this.motionExtractor.extractAnonymizedMotion(sourceVideoFrames);
    const profile = motionProfileId ? motionLibraryRepository.getById(motionProfileId) : undefined;
    return extracted.map((frame) =>
      this.applyToCharacter(frame, targetCharacterEmbeddings, profile),
    );
  }

  private applyToCharacter(
    frame: MotionProfile,
    targetCharacterEmbeddings: Record<string, number>,
    motionProfile?: MotionProfile,
  ): RetargetedMotionFrame {
    const profileWeights = motionProfile?.blendshapes ?? {};
    const mergedBlendshapes: Record<string, number> = {};

    for (const [shape, score] of Object.entries(frame.blendshapes)) {
      const profileBias = profileWeights[shape] ?? 0;
      const embedScale = targetCharacterEmbeddings[shape] ?? 1;
      mergedBlendshapes[shape] = Number(
        Math.min(1, Math.max(0, (score + profileBias) * embedScale)).toFixed(6),
      );
    }

    return {
      timestamp: frame.timestamp,
      characterId: String(targetCharacterEmbeddings.characterId ?? 'unknown-character'),
      motionProfileId: motionProfile?.id,
      blendshapes: mergedBlendshapes,
      headPose: frame.headPose,
      eyeGaze: frame.eyeGaze,
    };
  }
}
