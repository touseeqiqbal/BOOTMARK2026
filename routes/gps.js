const express = require('express');
const router = express.Router();
const gpsService = require('../utils/GPSService');
const { getDoc, getCollectionRef, deleteDoc, setDoc } = require('../utils/db');
const { authorize, requireAdmin } = require('../middleware/authorize');
const { validateRequest, gpsLocationSchema, geofenceSchema } = require('../utils/validation');

router.post('/:employeeId/location', authorize(['staff']), validateRequest(gpsLocationSchema), async (req, res) => {
    try {
        const userId = req.user?.uid;
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        const location = await gpsService.updateLocation(req.params.employeeId, businessId, userId, req.body);
        res.json({ success: true, location });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:employeeId/location', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        const employee = await getDoc('employees', req.params.employeeId);

        if (employee && employee.businessId !== businessId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(employee?.currentLocation || null);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get location' });
    }
});

router.get('/locations/all', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        const snap = await getCollectionRef('employees').where('businessId', '==', businessId).get();
        const locations = [];
        snap.forEach(doc => {
            const emp = doc.data();
            if (emp.currentLocation) locations.push({ id: doc.id, name: emp.name, ...emp.currentLocation });
        });
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.post('/geofences', requireAdmin, validateRequest(geofenceSchema), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        const id = `geofence-${Date.now()}`;
        const geofence = { ...req.body, id, businessId, createdAt: new Date().toISOString() };
        await setDoc('geofences', id, geofence);
        res.json({ success: true, geofence });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

module.exports = router;
