/**
 * Structured Logging Utility
 * Consistent logging format for both development and production.
 */

const logger = {
    info: (message, context = {}) => {
        log('INFO', message, context);
    },
    warn: (message, context = {}) => {
        log('WARN', message, context);
    },
    error: (message, context = {}) => {
        log('ERROR', message, context);
    },
    security: (message, context = {}) => {
        log('SECURITY', message, { ...context, securityEvent: true });
    }
};

function log(level, message, context) {
    const timestamp = new Date().toISOString();
    const env = process.env.NODE_ENV || 'development';

    // Simple format for dev, JSON for production
    if (env === 'production') {
        console.log(JSON.stringify({
            timestamp,
            level,
            message,
            ...context
        }));
    } else {
        const contextStr = Object.keys(context).length > 0 ? `| ${JSON.stringify(context)}` : '';
        console.log(`[${timestamp}] [${level}] ${message} ${contextStr}`);
    }
}

module.exports = logger;
