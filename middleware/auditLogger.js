const auditService = require('../utils/AuditService');

const auditLogger = async (req, res, next) => {
    // Only log mutations (POST, PUT, DELETE)
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        // Record the original end function to capture status code
        const originalEnd = res.end;

        res.end = function (...args) {
            res.end = originalEnd;
            res.end.apply(res, args);

            // Log after the request is finished
            // Log successes (2xx) and security-relevant failures (401, 403, 400)
            const isRelevant = (res.statusCode >= 200 && res.statusCode < 300) ||
                [400, 401, 403].includes(res.statusCode);

            if (isRelevant) {
                const userId = req.user?.uid || req.user?.id;
                const userEmail = req.user?.email;
                const businessId = req.user?.businessId;

                if (userId) {
                    // Extract resource from path (e.g., /api/invoices/123 -> INVOICES)
                    const pathParts = req.path.split('/').filter(p => p !== '');
                    const resource = pathParts[1]?.toUpperCase() || 'SYSTEM';
                    const resourceId = pathParts[2] || null;

                    // Mask sensitive data in body
                    const sanitizedBody = { ...req.body };
                    ['password', 'token', 'secret', 'creditCard'].forEach(key => {
                        if (sanitizedBody[key]) sanitizedBody[key] = '********';
                    });

                    auditService.logEvent({
                        userId,
                        userEmail,
                        action: req.method,
                        resource,
                        resourceId,
                        businessId,
                        metadata: {
                            path: req.path,
                            method: req.method,
                            body: sanitizedBody,
                            ip: req.ip || req.headers['x-forwarded-for']
                        }
                    }).catch(err => console.error('Background Audit Log Error:', err));
                }
            }
        };
    }

    next();
};

module.exports = auditLogger;
