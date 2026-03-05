/**
 * Global Error Handling Middleware
 * Provides consistent JSON formatting for API errors.
 */

const errorHandler = (err, req, res, next) => {
    // Determine status code: prioritize error status, then response status, default to 500
    const statusCode = err.status || err.statusCode || res.statusCode !== 200 ? res.statusCode : 500;

    // Log error to console (or structured logger if available)
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, {
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
        userId: req.user?.uid || req.user?.id
    });

    res.status(statusCode).json({
        error: true,
        message: err.message || 'An unexpected error occurred',
        code: err.code || 'INTERNAL_ERROR',
        // Only include stack trace in development
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
};

module.exports = errorHandler;
