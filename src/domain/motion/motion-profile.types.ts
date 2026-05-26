export interface HeadPose {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface EyeGaze {
  x: number;
  y: number;
}

export interface MotionProfile {
  id: string;
  name: string;
  category: string;
  blendshapes: Record<string, number>;
  headPose: HeadPose;
  eyeGaze: EyeGaze;
  timestamp: number;
  source: 'PUBLIC_CONSENTED' | 'PUBLIC_LICENSED' | 'SYNTHETIC';
  anonymized: true;
}

export interface RetargetedMotionFrame {
  timestamp: number;
  characterId: string;
  motionProfileId?: string;
  blendshapes: Record<string, number>;
  headPose: HeadPose;
  eyeGaze: EyeGaze;
}
