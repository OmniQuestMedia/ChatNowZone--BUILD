/**
 * Data Transfer Objects for CyranoEngines API
 */

export interface GenerateSyntheticTwinDto {
  /** Input image data or URL */
  input_image: string;
  /** Generation parameters */
  parameters?: Record<string, any>;
  /** Callback webhook URL for result delivery */
  callback_url: string;
  /** Optional caller-provided correlation ID */
  correlation_id?: string;
  /** Caller platform identifier (synthi | cnz) */
  platform: 'synthi' | 'cnz';
  /** User/account identifier for StudioTokens charging */
  account_id: string;
}

export interface GenerateVideoDto {
  /** Video generation prompt or script */
  prompt: string;
  /** Avatar/character selection */
  avatar?: string;
  /** Generation parameters */
  parameters?: Record<string, any>;
  /** Callback webhook URL for result delivery */
  callback_url: string;
  /** Optional caller-provided correlation ID */
  correlation_id?: string;
  /** Caller platform identifier (synthi | cnz) */
  platform: 'synthi' | 'cnz';
  /** User/account identifier for StudioTokens charging */
  account_id: string;
}

export interface GenerateVoiceDto {
  /** Text to synthesize */
  text: string;
  /** Voice profile selection */
  voice_id?: string;
  /** Generation parameters */
  parameters?: Record<string, any>;
  /** Callback webhook URL for result delivery */
  callback_url: string;
  /** Optional caller-provided correlation ID */
  correlation_id?: string;
  /** Caller platform identifier (synthi | cnz) */
  platform: 'synthi' | 'cnz';
  /** User/account identifier for StudioTokens charging */
  account_id: string;
}

export interface MemoryQueryDto {
  /** Query text or embedding */
  query: string;
  /** Context or session identifier */
  context_id?: string;
  /** Maximum results to return */
  limit?: number;
  /** Callback webhook URL for result delivery */
  callback_url: string;
  /** Optional caller-provided correlation ID */
  correlation_id?: string;
  /** Caller platform identifier (synthi | cnz) */
  platform: 'synthi' | 'cnz';
}

export interface WebhookResponseDto {
  /** Unique job identifier */
  job_id: string;
  /** Correlation ID for tracking */
  correlation_id: string;
  /** Job status */
  status: 'accepted' | 'queued' | 'processing';
  /** Message */
  message: string;
  /** Estimated completion time in seconds */
  estimated_completion_seconds?: number;
}

export interface WebhookCallbackPayload {
  /** Original job identifier */
  job_id: string;
  /** Correlation ID for tracking */
  correlation_id: string;
  /** Job status */
  status: 'completed' | 'failed';
  /** Result data (if successful) */
  result?: any;
  /** Error information (if failed) */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  /** Timestamp */
  timestamp: string;
}
