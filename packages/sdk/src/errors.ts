// Error classes for DGOS SDK

export class DGOSSDKError extends Error {
  code: string;
  statusCode?: number;
  details?: any;

  constructor(message: string, code: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'DGOSSDKError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NetworkError extends DGOSSDKError {
  constructor(message: string, details?: any) {
    super(message, 'network_error', undefined, details);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends DGOSSDKError {
  constructor(message: string, statusCode: number = 401, details?: any) {
    super(message, 'authentication_error', statusCode, details);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends DGOSSDKError {
  constructor(message: string, details?: any) {
    super(message, 'validation_error', 400, details);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends DGOSSDKError {
  retryAfter?: number;

  constructor(message: string, retryAfter?: number, details?: any) {
    super(message, 'rate_limit_error', 429, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class NotFoundError extends DGOSSDKError {
  constructor(message: string, details?: any) {
    super(message, 'not_found', 404, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DGOSSDKError {
  constructor(message: string, details?: any) {
    super(message, 'conflict', 409, details);
    this.name = 'ConflictError';
  }
}

export class PermissionError extends DGOSSDKError {
  constructor(message: string, details?: any) {
    super(message, 'permission_denied', 403, details);
    this.name = 'PermissionError';
  }
}

export class ServerError extends DGOSSDKError {
  retryable: boolean;

  constructor(message: string, statusCode: number = 500, retryable: boolean = true, details?: any) {
    super(message, 'server_error', statusCode, details);
    this.name = 'ServerError';
    this.retryable = retryable;
  }
}

export class TimeoutError extends DGOSSDKError {
  constructor(message: string = 'Request timed out', details?: any) {
    super(message, 'timeout', undefined, details);
    this.name = 'TimeoutError';
  }
}

export function createErrorFromResponse(response: any, statusCode: number): DGOSSDKError {
  const message = response?.message || 'Request failed';
  const errorKey = response?.errorKey || 'unknown_error';
  const details = response?.details;

  switch (statusCode) {
    case 400:
      return new ValidationError(message, details);
    case 401:
      return new AuthenticationError(message, statusCode, details);
    case 403:
      return new PermissionError(message, details);
    case 404:
      return new NotFoundError(message, details);
    case 409:
      return new ConflictError(message, details);
    case 429:
      return new RateLimitError(message, response?.retryAfter, details);
    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, statusCode, response?.retryable !== false, details);
    default:
      return new DGOSSDKError(message, errorKey, statusCode, details);
  }
}
