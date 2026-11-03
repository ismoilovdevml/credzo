/**
 * Application Constants
 * Central location for all application-wide constants
 */

// Session Configuration
export const SESSION_CONFIG = {
  DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
  COOKIE_NAME: 'session_token',
  TOKEN_LENGTH: 32,
} as const;

// Password Configuration
export const PASSWORD_CONFIG = {
  MIN_LENGTH: 8,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
} as const;

// Audit Log Configuration
export const AUDIT_CONFIG = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 1000,
  RETENTION_DAYS: 90,
} as const;

// File Upload Configuration
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['.credzo', '.json'],
} as const;

// Request body limits for JSON API routes
export const REQUEST_LIMITS = {
  DEFAULT_JSON_BYTES: 1024 * 1024, // 1MB
  IMPORT_JSON_BYTES: FILE_UPLOAD.MAX_SIZE,
  IMPORT_MAX_PROJECTS: 500,
  IMPORT_MAX_CREDENTIALS_PER_PROJECT: 1000,
} as const;

// Organization Configuration
export const ORGANIZATION_CONFIG = {
  SLUG_MIN_LENGTH: 3,
  SLUG_MAX_LENGTH: 50,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
} as const;

// Project Configuration
export const PROJECT_CONFIG = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
} as const;

// Credential Configuration
export const CREDENTIAL_CONFIG = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 2000,
  MAX_FIELDS: 50,
  FIELD_NAME_MAX_LENGTH: 64,
  FIELD_VALUE_MAX_LENGTH: 64 * 1024,
  MAX_LINKED_SERVERS: 50,
  LINKED_SERVER_MAX_LENGTH: 255,
  ROTATION_DAYS_MIN: 1,
  ROTATION_DAYS_MAX: 3650,
  SEARCH_MAX_LENGTH: 200,
} as const;

// Service (project inventory) Configuration
export const SERVICE_CONFIG = {
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  URL_MAX_LENGTH: 2048,
  MAX_TAGS: 20,
  TAG_MAX_LENGTH: 40,
} as const;

// Organization invitations
export const INVITATION_CONFIG = {
  EXPIRY_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  EMAIL_MAX_LENGTH: 254,
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Authentication
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid username or password',
    SESSION_EXPIRED: 'Your session has expired. Please login again.',
    UNAUTHORIZED: 'You must be logged in to access this resource',
    INVALID_TOKEN: 'Invalid or expired token',
  },
  // Authorization
  PERMISSION: {
    DENIED: 'You do not have permission to perform this action',
    INSUFFICIENT_ROLE: 'Insufficient permissions for this operation',
  },
  // Validation
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Invalid email address',
    INVALID_USERNAME: 'Username can only contain letters, numbers, and underscores',
    PASSWORD_TOO_SHORT: `Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters`,
    PASSWORD_MISMATCH: 'Passwords do not match',
  },
  // Resources
  RESOURCE: {
    NOT_FOUND: 'Resource not found',
    ALREADY_EXISTS: 'Resource already exists',
    CONFLICT: 'Resource conflict',
  },
  // Generic
  GENERIC: {
    INTERNAL_ERROR: 'An internal error occurred. Please try again.',
    INVALID_INPUT: 'Invalid input data',
    OPERATION_FAILED: 'Operation failed',
  },
} as const;

// Regex Patterns
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME: /^[a-zA-Z0-9_]+$/,
  SLUG: /^[a-z0-9-]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
} as const;
