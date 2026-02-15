import type { Request, Response, NextFunction } from 'express';
import logger from './logger.ts';
import { AppError } from './utils.ts';

// Global error handler middleware
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error({ err, path: req.path, method: req.method }, 'HTTP request error');

  // Handle operational errors
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      status: err.statusCode,
    });
  }

  // Handle unexpected errors
  logger.fatal({ err, stack: err.stack, path: req.path, method: req.method }, 'Unexpected error');
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
