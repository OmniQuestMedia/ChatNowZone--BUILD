import { MotionProfile } from './motion-profile.types';

const PROFILE_CATEGORIES = ['flirty', 'seductive', 'dominant', 'playful', 'teasing', 'romantic'];

const PROFILE_VARIANTS = [
  'smile',
  'wink',
  'lip_bite',
  'eyebrow_raise',
  'slow_blink',
  'half_smirk',
  'chin_tilt',
  'head_turn',
  'gaze_hold',
  'laugh',
];

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(4));
}

function seedBlendshapes(seed: number): Record<string, number> {
  return {
    eyeBlinkLeft: clamp(0.05 + (seed % 7) * 0.03),
    eyeBlinkRight: clamp(0.05 + (seed % 5) * 0.04),
    mouthSmileLeft: clamp(0.15 + (seed % 9) * 0.06),
    mouthSmileRight: clamp(0.14 + (seed % 8) * 0.06),
    browInnerUp: clamp(0.08 + (seed % 6) * 0.05),
    browDownLeft: clamp(0.04 + (seed % 4) * 0.05),
    browDownRight: clamp(0.04 + (seed % 3) * 0.06),
    jawOpen: clamp(0.07 + (seed % 10) * 0.05),
    mouthPucker: clamp(0.09 + (seed % 11) * 0.04),
    mouthFunnel: clamp(0.06 + (seed % 12) * 0.03),
    cheekSquintLeft: clamp(0.05 + (seed % 7) * 0.04),
    cheekSquintRight: clamp(0.05 + (seed % 6) * 0.04),
  };
}

export function seedGenericMotionProfiles(): MotionProfile[] {
  const profiles: MotionProfile[] = [];
  let index = 0;

  for (const category of PROFILE_CATEGORIES) {
    for (const variant of PROFILE_VARIANTS) {
      index += 1;
      profiles.push({
        id: `motion_seed_${index.toString().padStart(3, '0')}`,
        name: `${category}_${variant}`,
        category,
        blendshapes: seedBlendshapes(index),
        headPose: {
          pitch: Number((((index % 7) - 3) * 1.9).toFixed(3)),
          yaw: Number((((index % 9) - 4) * 2.2).toFixed(3)),
          roll: Number((((index % 5) - 2) * 1.7).toFixed(3)),
        },
        eyeGaze: {
          x: clamp(0.25 + (index % 10) * 0.055),
          y: clamp(0.25 + (index % 8) * 0.06),
        },
        timestamp: index * 33,
        source: 'SYNTHETIC',
        anonymized: true,
      });
    }
  }

  return profiles;
}
