export class OnixError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'OnixError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, OnixError);
  }
}