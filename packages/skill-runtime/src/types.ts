// Skill Manifest Schema - Complete type definitions for DGOS V1 Skills

export interface SkillManifest {
  skillId: string;
  version: string;
  name: { en: string; zh: string };
  description: { en: string; zh: string };
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  icon?: string;

  // Trigger configuration
  triggers: SkillTrigger[];

  // Parameter definitions
  parameters: SkillParameter[];

  // Permission requirements
  permissions: Permission[];

  // Execution configuration
  execution: {
    timeout?: number; // milliseconds
    retryable?: boolean;
    async?: boolean;
  };

  // Category and tags
  category: SkillCategory;
  tags: string[];

  // Dependencies
  dependencies?: {
    dgos?: string; // minimum DGOS version
    skills?: string[]; // required skill IDs
    providers?: string[]; // required provider types
  };
}

export interface SkillTrigger {
  type: 'keyword' | 'pattern' | 'intent' | 'schedule' | 'event';
  value: string;
  examples?: string[];
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'enum';
  required: boolean;
  description: string;
  default?: any;
  options?: string[]; // for enum type
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface Permission {
  capability: string;
  reason: string;
}

export type SkillCategory =
  | 'productivity'
  | 'automation'
  | 'data'
  | 'communication'
  | 'creative'
  | 'system';

export interface Skill {
  skillId: string;
  manifest: SkillManifest;
  state: SkillState;
  stateVersion: number;
  installedAt: string;
  updatedAt: string;
  stats?: SkillStats;
}

export type SkillState = 'enabled' | 'disabled' | 'installing' | 'error';

export interface SkillStats {
  invocationCount: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  lastInvocation?: string;
}

export interface SkillFilters {
  category?: SkillCategory;
  tags?: string[];
  state?: SkillState;
  search?: string;
}

export interface SkillMatch {
  skillId: string;
  trigger: SkillTrigger;
  score: number;
  parameters?: Record<string, any>;
}

export interface SkillContext {
  skillId: string;
  requestId: string;
  userId: string;
  sessionId: string;
  parameters: Record<string, any>;
  environment: Record<string, any>;
}

export interface SkillResult {
  success: boolean;
  output?: any;
  error?: SkillError;
  metadata?: {
    duration: number;
    tokensUsed?: number;
  };
}

export interface SkillError {
  code: string;
  message: string;
  details?: any;
}

export type SkillStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface SkillExecution {
  requestId: string;
  skillId: string;
  status: SkillStatus;
  context: SkillContext;
  result?: SkillResult;
  startedAt: string;
  completedAt?: string;
}

export interface SkillLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: Record<string, any>;
}

// Workflow types
export interface SkillWorkflow {
  workflowId: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  skillId: string;
  parameters: Record<string, any>;
  onSuccess?: string; // next step ID
  onFailure?: string; // fallback step ID
}
