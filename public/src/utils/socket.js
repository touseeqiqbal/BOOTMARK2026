import io from 'socket.io-client';
import { auth } from './firebase';

let socket = null;
let socketPromise = null;

/**
 * Initialize Socket.IO client connection with authentication
 * Automatically grabs Firebase ID token for the backend auth middleware
 */
export async function initializeSocket() {
    if (socket?.connected) return socket;
    if (socketPromise) return socketPromise;

    socketPromise = (async () => {
        try {
            // Get Firebase ID token for authentication
            const currentUser = auth.currentUser;
            if (!currentUser) {
                console.warn('[Socket.IO] No authenticated user — skipping connection');
                socketPromise = null;
                return null;
            }

            const token = await currentUser.getIdToken();

            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
            let serverUrl = apiUrl;

            try {
                if (apiUrl.startsWith('http')) {
                    const urlObj = new URL(apiUrl);
                    serverUrl = urlObj.origin;
                }
            } catch (e) {
                console.warn('Failed to parse API URL for socket connection:', e);
            }

            // Disconnect old socket if any
            if (socket) {
                socket.disconnect();
                socket = null;
            }

            socket = io(serverUrl, {
                withCredentials: true,
                transports: ['websocket', 'polling'],
                path: '/socket.io/',
                auth: { token } // SECURITY: Pass Firebase token for backend verification
            });

            socket.on('connect', () => {
                console.log('[Socket.IO] Authenticated & connected to server');
            });

            socket.on('disconnect', () => {
                console.log('[Socket.IO] Disconnected from server');
            });

            socket.on('connect_error', (error) => {
                console.error('[Socket.IO] Connection error:', error.message);
            });

            socketPromise = null;
            return socket;
        } catch (e) {
            console.error('[Socket.IO] Failed to initialize:', e);
            socketPromise = null;
            return null;
        }
    })();

    return socketPromise;
}

/**
 * Get the current socket, initializing if needed
 */
async function getSocket() {
    if (socket?.connected) return socket;
    return initializeSocket();
}

/**
 * Join business room for multi-tenant notifications
 */
export async function joinBusiness(businessId) {
    const s = await getSocket();
    if (s && businessId) {
        s.emit('join-business', businessId);
        console.log(`[Socket.IO] Joined business room: ${businessId}`);
    }
}

/**
 * Join user room for personal notifications
 */
export async function joinUser(userId) {
    const s = await getSocket();
    if (s && userId) {
        s.emit('join-user', userId);
        console.log(`[Socket.IO] Joined user room: ${userId}`);
    }
}

/**
 * Join work order room for crew tracking
 */
export async function joinWorkOrder(workOrderId) {
    const s = await getSocket();
    if (s && workOrderId) {
        s.emit('join-work-order', workOrderId);
        console.log(`[Socket.IO] Joined work order room: ${workOrderId}`);
    }
}

/**
 * Join chat room for specific business/client
 */
export async function joinChat(chatId) {
    const s = await getSocket();
    if (s && chatId) {
        s.emit('join-chat', chatId);
        console.log(`[Socket.IO] Joined chat room: ${chatId}`);
    }
}

/**
 * Send a chat message
 */
export async function sendChatMessage(chatId, message) {
    const s = await getSocket();
    if (s && chatId && message) {
        s.emit('send-message', { chatId, ...message });
    }
}

/**
 * Listen for chat messages
 */
export async function onMessage(callback) {
    const s = await getSocket();
    if (s) s.on('receive-message', callback);
}

/**
 * Remove chat message listener
 */
export function offMessage(callback) {
    if (socket) {
        socket.off('receive-message', callback);
    }
}

/**
 * Listen for notifications
 */
export async function onNotification(callback) {
    const s = await getSocket();
    if (s) s.on('notification', callback);
}

/**
 * Listen for live updates
 */
export async function onLiveUpdate(callback) {
    const s = await getSocket();
    if (s) s.on('live-update', callback);
}

/**
 * Remove notification listener
 */
export function offNotification(callback) {
    if (socket) {
        socket.off('notification', callback);
    }
}

/**
 * Remove live update listener
 */
export function offLiveUpdate(callback) {
    if (socket) {
        socket.off('live-update', callback);
    }
}

/**
 * Send notification to specific user or business
 */
export async function sendNotification(targetId, notification) {
    const s = await getSocket();
    if (!s) return;

    // Determine if target is user or business
    if (targetId.startsWith('user-')) {
        s.emit('notification', { userId: targetId.replace('user-', ''), notification });
    } else if (targetId.startsWith('business-')) {
        s.emit('notification', { businessId: targetId.replace('business-', ''), notification });
    } else {
        // Assume it's a user ID
        s.emit('notification', { userId: targetId, notification });
    }
}

/**
 * Disconnect socket
 */
export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

export default {
    initializeSocket,
    joinBusiness,
    joinUser,
    joinWorkOrder,
    joinChat,
    sendChatMessage,
    onMessage,
    offMessage,
    onNotification,
    onLiveUpdate,
    offNotification,
    offLiveUpdate,
    sendNotification,
    disconnectSocket
};

