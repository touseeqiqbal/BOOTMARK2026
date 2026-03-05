import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as dbUtils from '../utils/db';

// Mock DB utilities
vi.mock('../utils/db', () => ({
    getCollectionRef: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    admin: {
        auth: () => ({
            verifyIdToken: vi.fn()
        })
    }
}));

// Pre-import routes to avoid dynamic import issues in loop
import invoicesRoute from '../routes/invoices.js';
import servicesRoute from '../routes/services.js';
import clientsRoute from '../routes/clients.js';

describe('Security & Tenant Isolation Regression Suite', () => {
    let app;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Setup a test Express app
        app = express();
        app.use(express.json());

        // Simple auth middleware mock for testing
        app.use((req, res, next) => {
            if (req.headers['x-test-user']) {
                req.user = JSON.parse(req.headers['x-test-user']);
            }
            next();
        });
    });

    describe('Cross-Tenant Data Isolation (IDOR)', () => {
        it('should prevent access to objects belonging to another businessId', async () => {
            // Import a route that uses getDoc check (e.g., invoices)
            app.use('/api/invoices', invoicesRoute);

            // Mock invoice belonging to 'business_A'
            dbUtils.getDoc.mockResolvedValue({
                id: 'inv_123',
                businessId: 'business_A',
                amount: 100
            });

            // Attempt access as 'business_B'
            const res = await request(app)
                .get('/api/invoices/inv_123')
                .set('x-test-user', JSON.stringify({ businessId: 'business_B', uid: 'user_B' }));

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/Access denied/i);
        });

        it('should block requests where businessId is provided in body but session businessId is different', async () => {
            // Import a route that creates data (e.g., services)
            app.use('/api/services', servicesRoute);

            // POST with a mismatching businessId in body
            const res = await request(app)
                .post('/api/services')
                .set('x-test-user', JSON.stringify({ businessId: 'real_biz', uid: 'user_1' }))
                .send({
                    name: 'Hacker Service',
                    businessId: 'victim_biz', // Attempted override
                    price: 1000
                });

            // The code should have been updated to ignore req.body.businessId
            // and use req.user.businessId instead.
            expect(res.status).toBe(201);
            expect(res.body.businessId).toBe('real_biz');
        });
    });

    describe('Client Portal Data Leakage', () => {
        it('should strip internal fields using sanitizeForClient', async () => {
            app.use('/api/clients', clientsRoute);

            // Mock customer profile with internal fields
            dbUtils.getCollectionRef.mockReturnValue({
                where: vi.fn().mockReturnThis(),
                get: vi.fn().mockResolvedValue({
                    empty: false,
                    docs: [{
                        id: 'cust_1',
                        data: () => ({
                            name: 'John Client',
                            email: 'john@example.com',
                            businessId: 'biz_1',
                            internalNotes: 'SECRET NOTE',
                            profit: 500
                        })
                    }]
                })
            });

            const res = await request(app)
                .get('/api/clients/profile')
                .set('x-test-user', JSON.stringify({ email: 'john@example.com', role: 'client' }));

            expect(res.status).toBe(200);
            expect(res.body.internalNotes).toBeUndefined();
            expect(res.body.profit).toBeUndefined();
            expect(res.body.name).toBe('John Client');
        });
    });
});
