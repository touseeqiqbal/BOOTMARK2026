const socketIO = require('socket.io');

let io = null;

/**
 * Verify a socket authentication token
 * Returns { uid, email, businessId } or null
 */
async function verifySocketToken(token) {
    if (!token) return null;

    // Try Firebase Admin verification first
    try {
        const { admin } = require('./db');
        if (admin && admin.apps && admin.apps.length > 0) {
            const decoded = await admin.auth().verifyIdToken(token);
            const uid = decoded.uid;

            // Look up user's businessId from Firestore
            const db = admin.firestore();
            const userDoc = await db.collection('users').doc(uid).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            return {
                uid,
                email: decoded.email,
                businessId: userData.businessId || null
            };
        }
    } catch (e) {
        // Firebase verification failed, try JWT fallback
    }

    // JWT fallback
    try {
        const jwt = require('jsonwebtoken');
        const config = require('../config');
        const decoded = jwt.verify(token, config.jwtSecret);
        return {
            uid: decoded.userId || decoded.uid || decoded.sub,
            email: decoded.email,
            businessId: decoded.businessId || null
        };
    } catch (e) {
        return null;
    }
}

/**
 * Initialize Socket.IO server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.IO instance
 */
function initializeSocket(server) {
    io = socketIO(server, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // SECURITY: Authentication middleware — verify token on connection
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        const user = await verifySocketToken(token);
        if (!user) {
            return next(new Error('Invalid authentication token'));
        }

        // Attach verified user to socket
        socket.user = user;
        next();
    });

    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Authenticated client connected: ${socket.id} (uid: ${socket.user.uid})`);

        // SECURITY: Verify user belongs to the requested business before joining
        socket.on('join-business', (businessId) => {
            if (!businessId) return;

            if (socket.user.businessId !== businessId) {
                console.warn(`[Socket.IO] DENIED: User ${socket.user.uid} tried to join business-${businessId} but belongs to ${socket.user.businessId}`);
                socket.emit('error', { message: 'Access denied: not a member of this business' });
                return;
            }

            socket.join(`business-${businessId}`);
            console.log(`[Socket.IO] Client ${socket.id} joined business-${businessId}`);
        });

        // SECURITY: Verify socket user matches the requested userId
        socket.on('join-user', (userId) => {
            if (!userId) return;

            if (socket.user.uid !== userId) {
                console.warn(`[Socket.IO] DENIED: User ${socket.user.uid} tried to join user-${userId}`);
                socket.emit('error', { message: 'Access denied: cannot join another user\'s channel' });
                return;
            }

            socket.join(`user-${userId}`);
            console.log(`[Socket.IO] Client ${socket.id} joined user-${userId}`);
        });

        // Join work order room for crew tracking (verified user only)
        socket.on('join-work-order', (workOrderId) => {
            if (workOrderId) {
                socket.join(`work-order-${workOrderId}`);
                console.log(`[Socket.IO] Client ${socket.id} joined work-order-${workOrderId}`);
            }
        });

        // Join chat room for specific business/client (verified user only)
        socket.on('join-chat', (chatId) => {
            if (chatId) {
                socket.join(`chat-${chatId}`);
                console.log(`[Socket.IO] Client ${socket.id} joined chat-${chatId}`);
            }
        });

        // Handle sending messages
        socket.on('send-message', (data) => {
            const { chatId, message, fromClient } = data;
            if (!chatId || !message) return;

            // Broadcast to the chat room
            io.to(`chat-${chatId}`).emit('receive-message', {
                chatId,
                message,
                fromClient,
                senderId: socket.user.uid,
                timestamp: new Date().toISOString()
            });

            console.log(`[Socket.IO] Message sent in chat-${chatId} by ${socket.user.uid}`);
        });

        socket.on('disconnect', () => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
        });
    });

    console.log('✅ Socket.IO server initialized (with authentication)');
    return io;
}

/**
 * Get Socket.IO instance
 */
function getIO() {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocket first.');
    }
    return io;
}

/**
 * Send notification to specific business
 */
function sendBusinessNotification(businessId, notification) {
    if (!io) return;

    io.to(`business-${businessId}`).emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
    });

    console.log(`[Socket.IO] Sent notification to business-${businessId}:`, notification.type);
}

/**
 * Send notification to specific user
 */
function sendUserNotification(userId, notification) {
    if (!io) return;

    io.to(`user-${userId}`).emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
    });

    console.log(`[Socket.IO] Sent notification to user-${userId}:`, notification.type);
}

/**
 * Broadcast live update to business
 */
function broadcastUpdate(businessId, updateType, data) {
    if (!io) return;

    io.to(`business-${businessId}`).emit('live-update', {
        type: updateType,
        data,
        timestamp: new Date().toISOString()
    });

    console.log(`[Socket.IO] Broadcast ${updateType} to business-${businessId}`);
}

/**
 * Emit GPS location update
 */
function emitGPSUpdate(businessId, locationData) {
    if (!io) return;

    io.to(`business-${businessId}`).emit('gps:location-update', {
        ...locationData,
        timestamp: new Date().toISOString()
    });

    console.log(`[Socket.IO] GPS update for employee ${locationData.employeeId}`);
}

/**
 * Emit geofence event
 */
function emitGeofenceEvent(businessId, eventData) {
    if (!io) return;

    io.to(`business-${businessId}`).emit('gps:geofence-event', {
        ...eventData,
        timestamp: new Date().toISOString()
    });

    console.log(`[Socket.IO] Geofence ${eventData.type} for ${eventData.employeeName}`);
}

/**
 * Emit crew arrival notification to client
 */
function notifyClientCrewArrival(workOrderId, crewData) {
    if (!io) return;

    io.to(`work-order-${workOrderId}`).emit('client:crew-arrived', {
        ...crewData,
        timestamp: new Date().toISOString()
    });

    console.log(`[Socket.IO] Crew arrival notification for work order ${workOrderId}`);
}

/**
 * Emit crew approaching notification to client
 */
function notifyClientCrewApproaching(workOrderId, etaData) {
    if (!io) return;

    io.to(`work-order-${workOrderId}`).emit('client:crew-approaching', {
        ...etaData,
        timestamp: new Date().toISOString()
    });

    console.log(`[Socket.IO] Crew approaching notification for work order ${workOrderId}`);
}

/**
 * Emit invoice update to client
 */
function notifyClientInvoiceUpdate(userId, invoiceData) {
    if (!io) return;

    io.to(`user-${userId}`).emit('client:invoice-update', {
        ...invoiceData,
        timestamp: new Date().toISOString()
    });

    console.log(`[Socket.IO] Invoice update notification for user ${userId}`);
}

/**
 * Emit appointment reminder to client
 */
function notifyClientAppointmentReminder(userId, appointmentData) {
    if (!io) return;

    io.to(`user-${userId}`).emit('client:appointment-reminder', {
        ...appointmentData,
        timestamp: new Date().toISOString()
    });

    console.log(`[Socket.IO] Appointment reminder for user ${userId}`);
}

/**
 * Emit new message notification
 */
function notifyNewMessage(userId, messageData) {
    if (!io) return;

    io.to(`user-${userId}`).emit('client:message', {
        ...messageData,
        timestamp: new Date().toISOString()
    });

    console.log(`[Socket.IO] New message notification for user ${userId}`);
}

module.exports = {
    initializeSocket,
    getIO,
    sendBusinessNotification,
    sendUserNotification,
    broadcastUpdate,
    emitGPSUpdate,
    emitGeofenceEvent,
    notifyClientCrewArrival,
    notifyClientCrewApproaching,
    notifyClientInvoiceUpdate,
    notifyClientAppointmentReminder,
    notifyNewMessage
};

