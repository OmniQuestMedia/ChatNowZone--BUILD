import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { MotionProfile } from '../../domain/motion/motion-profile.types';

interface BlendshapeCategory {
  categoryName: string;
  score: number;
}

interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

interface FaceLandmarkerResultLike {
  faceLandmarks?: LandmarkPoint[][];
  faceBlendshapes?: Array<{ categories: BlendshapeCategory[] }>;
  facialTransformationMatrixes?: Array<{ data: number[] }>;
}

const DEFAULT_MEDIAPIPE_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

export interface AnonymizedMotionProfile extends MotionProfile {
  intensity: number;
}

export class MotionExtractorService {
  private landmarker?: FaceLandmarker;

  async initialize(wasmPath = DEFAULT_MEDIAPIPE_WASM_PATH): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(wasmPath);
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'face_landmarker.task' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  }

  async extractAnonymizedMotion(
    videoFrames: Buffer[],
    profileName = 'extracted_motion',
  ): Promise<AnonymizedMotionProfile[]> {
    if (!this.landmarker) {
      throw new Error('MotionExtractorService is not initialized');
    }

    const motionData: AnonymizedMotionProfile[] = [];

    for (let i = 0; i < videoFrames.length; i += 1) {
      const timestamp = i * 33;
      const frame = videoFrames[i];
      const results = (await this.landmarker.detectForVideo(
        frame as unknown as ImageSource,
        timestamp,
      )) as FaceLandmarkerResultLike;

      if (results.faceLandmarks?.[0] && results.faceBlendshapes?.[0]?.categories) {
        motionData.push({
          id: `motion_${Date.now()}_${i}`,
          name: profileName,
          category: this.categorizeExpression(results.faceBlendshapes[0].categories),
          blendshapes: this.extractBlendshapes(results.faceBlendshapes[0].categories),
          headPose: this.extractHeadPose(results),
          eyeGaze: this.estimateEyeGaze(results.faceLandmarks[0]),
          timestamp,
          intensity: this.calculateExpressionIntensity(results.faceBlendshapes[0].categories),
          source: 'PUBLIC_CONSENTED',
          anonymized: true,
        });
      }
    }

    return motionData;
  }

  private categorizeExpression(blendshapes: BlendshapeCategory[]): string {
    const lookup = new Map(
      blendshapes.map((blendshape) => [blendshape.categoryName, blendshape.score]),
    );
    const smile = (lookup.get('mouthSmileLeft') ?? 0) + (lookup.get('mouthSmileRight') ?? 0);
    const brow = lookup.get('browInnerUp') ?? 0;
    const jawOpen = lookup.get('jawOpen') ?? 0;

    if (smile > 1.0 && brow > 0.35) return 'flirty';
    if (jawOpen > 0.45 && brow < 0.2) return 'dominant';
    if (smile > 0.55) return 'playful';
    return 'generic';
  }

  private calculateExpressionIntensity(blendshapes: BlendshapeCategory[]): number {
    if (blendshapes.length === 0) return 0;
    const avg =
      blendshapes.reduce((sum, blendshape) => sum + blendshape.score, 0) / blendshapes.length;
    return Number(Math.max(0, Math.min(1, avg)).toFixed(6));
  }

  private extractBlendshapes(blendshapes: BlendshapeCategory[]): Record<string, number> {
    const map: Record<string, number> = {};

    for (const shape of blendshapes) {
      map[shape.categoryName] = shape.score;
    }

    return map;
  }

  private extractHeadPose(results: FaceLandmarkerResultLike): {
    pitch: number;
    yaw: number;
    roll: number;
  } {
    const matrix = results.facialTransformationMatrixes?.[0]?.data;
    if (!matrix || matrix.length < 16) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    const pitch = Math.atan2(-matrix[9], Math.sqrt(matrix[8] ** 2 + matrix[10] ** 2));
    const yaw = Math.atan2(matrix[8], matrix[10]);
    const roll = Math.atan2(matrix[1], matrix[5]);

    return {
      pitch: Number(pitch.toFixed(6)),
      yaw: Number(yaw.toFixed(6)),
      roll: Number(roll.toFixed(6)),
    };
  }

  private estimateEyeGaze(landmarks: LandmarkPoint[]): { x: number; y: number } {
    const leftIris = landmarks[468];
    const rightIris = landmarks[473];

    if (!leftIris || !rightIris) {
      return { x: 0.5, y: 0.5 };
    }

    return {
      x: Number(((leftIris.x + rightIris.x) / 2).toFixed(6)),
      y: Number(((leftIris.y + rightIris.y) / 2).toFixed(6)),
    };
  }
}
