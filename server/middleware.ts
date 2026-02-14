import type { Request, Response, NextFunction } from 'express';
import { AppError } from './utils.ts';

// Global error handler middleware
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('[Error]', err);

  // Handle operational errors
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      status: err.statusCode,
    });
  }

  // Handle unexpected errors
  console.error('[FATAL] Unexpected error:', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    status: 500,
  });
}

// 404 handler for unmatched routes
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Route not found',
    status: 404,
    path: req.path,
  });
}
