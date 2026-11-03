/**
 * Operational error classes.
 * Route handlers throw these and `handleRouteError` (lib/middleware.ts) maps them
 * to `{ success: false, error }` responses with the matching HTTP status.
 */

import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/config/constants';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

export class ValidationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.GENERIC.INVALID_INPUT) {
    super(message, HTTP_STATUS.BAD_REQUEST);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.AUTH.UNAUTHORIZED) {
    super(message, HTTP_STATUS.UNAUTHORIZED);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.PERMISSION.DENIED) {
    super(message, HTTP_STATUS.FORBIDDEN);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = ERROR_MESSAGES.RESOURCE.ALREADY_EXISTS) {
    super(message, HTTP_STATUS.CONFLICT);
    this.name = 'ConflictError';
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(maxBytes: number) {
    super(`Request body must not exceed ${Math.round(maxBytes / 1024)} KB`, HTTP_STATUS.PAYLOAD_TOO_LARGE);
    this.name = 'PayloadTooLargeError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
