/**
 * Request ID Middleware
 * Generates a unique ID per request for tracing across logs.
 * Attaches to req.id and X-Request-ID response header.
 */
const crypto = require('crypto');

const requestId = (req, res, next) => {
    const id = req.headers['x-request-id'] || crypto.randomUUID();
    req.id = id;
    res.setHeader('X-Request-ID', id);
    next();
};

module.exports = requestId;
