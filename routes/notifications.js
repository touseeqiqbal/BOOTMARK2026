/**
 * Notifications API Routes
 * Handles notification delivery and preferences
 */

const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { getCollectionRef, getDoc, setDoc, addDoc, query, where, orderBy, limit } = require('../utils/db');
const { sendBusinessNotification, sendUserNotification } = require('../utils/socketServer');
const { sendEmail } = require('../utils/emailService');
const { validateRequest, notificationSendSchema, notificationPreferencesSchema } = require('../utils/validation');

// SECURITY: HTML escape helper to prevent XSS in email templates
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * POST /api/notifications/send
 * Send a notification (handles in-app, email, push)
 */
router.post('/send', authorize(['staff']), validateRequest(notificationSendSchema), async (req, res) => {
  try {
    const {
      type = 'info',
      priority = 'medium',
      category,
      title,
      message,
      actionUrl,
      actionLabel,
      metadata = {},
      userIds = [],
      businessId,
      channels = ['in_app']
    } = req.body;

    const user = req.user;
    const notification = {
      type,
      priority,
      category,
      title,
      message,
      actionUrl,
      actionLabel,
      metadata,
      userIds,
      businessId: businessId || user.businessId,
      channels,
      timestamp: new Date().toISOString(),
      sentBy: user.uid
    };

    // Send in-app notifications via Socket.IO
    if (channels.includes('in_app')) {
      // Send to specific users
      if (userIds.length > 0) {
        userIds.forEach(userId => {
          sendUserNotification(userId, {
            type,
            title,
            message,
            actionUrl,
            actionLabel,
            timestamp: notification.timestamp
          });
        });
      }

      // Send to business (all members)
      if (notification.businessId) {
        sendBusinessNotification(notification.businessId, {
          type,
          title,
          message,
          actionUrl,
          actionLabel,
          timestamp: notification.timestamp
        });
      }
    }

    // Send email notifications
    if (channels.includes('email')) {
      // Get user email addresses
      const emailRecipients = [];

      if (userIds.length > 0) {
        for (const userId of userIds) {
          try {
            const userDoc = await getDoc('users', userId);
            if (userDoc && userDoc.email) {
              emailRecipients.push(userDoc.email);
            }
          } catch (err) {
            console.error(`Failed to fetch user ${userId} for email notification:`, err);
          }
        }
      }

      // Send emails
      for (const email of emailRecipients) {
        try {
          await sendEmail({
            to: email,
            subject: title,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1f2937;">${escapeHtml(title)}</h2>
                <p style="color: #4b5563; line-height: 1.6;">${escapeHtml(message)}</p>
                ${actionUrl ? `
                  <div style="margin-top: 24px;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}${actionUrl}" 
                       style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">
                      ${actionLabel || 'View Details'}
                    </a>
                  </div>
                ` : ''}
                <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 12px;">
                  This is an automated notification from BOOTMARK.
                </p>
              </div>
            `
          });
        } catch (err) {
          console.error(`Failed to send email to ${email}:`, err);
        }
      }
    }

    // Store notification in database
    try {
      await addDoc('notifications', {
        ...notification,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to store notification:', err);
      // Don't fail the request if storage fails
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * GET /api/notifications
 * Get user's notifications
 */
router.get('/', authRequired, async (req, res) => {
  try {
    const user = req.user;
    const {
      limit: limitParam = 50,
      unreadOnly = false,
      category,
      search
    } = req.query;

    const baseRef = getCollectionRef('notifications');
    const limitVal = parseInt(limitParam);

    // Fetch user-specific notifications
    let userQuery = query(
      baseRef,
      where('userIds', 'array-contains', user.uid),
      orderBy('timestamp', 'desc'),
      limit(limitVal)
    );

    // Fetch business notifications if applicable
    let businessQuery = null;
    if (user.businessId) {
      businessQuery = query(
        baseRef,
        where('businessId', '==', user.businessId),
        orderBy('timestamp', 'desc'),
        limit(limitVal)
      );
    }

    const [userSnap, businessSnap] = await Promise.all([
      userQuery.get(),
      businessQuery ? businessQuery.get() : Promise.resolve({ docs: [] })
    ]);

    // Merge and deduplicate
    const seenIds = new Set();
    let allNotifications = [];

    const processDoc = (doc) => {
      if (seenIds.has(doc.id)) return;
      seenIds.add(doc.id);
      const data = doc.data();

      // Filter by unread if requested
      const isRead = data.readBy?.includes(user.uid) || data.read === true;
      if (unreadOnly && isRead) return;

      // Filter by category
      if (category && data.category !== category) return;

      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase();
        const titleMatch = data.title?.toLowerCase().includes(searchLower);
        const messageMatch = data.message?.toLowerCase().includes(searchLower);
        if (!titleMatch && !messageMatch) return;
      }

      allNotifications.push({
        id: doc.id,
        ...data,
        isRead
      });
    };

    userSnap.docs.forEach(processDoc);
    businessSnap.docs.forEach(processDoc);

    // Re-sort after merge and apply final limit
    allNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    allNotifications = allNotifications.slice(0, limitVal);

    res.json({ notifications: allNotifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const notification = await getDoc('notifications', id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Update read status
    const readBy = notification.readBy || [];
    if (!readBy.includes(user.uid)) {
      readBy.push(user.uid);
    }

    await setDoc('notifications', id, {
      ...notification,
      readBy,
      read: readBy.length > 0
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authRequired, async (req, res) => {
  try {
    const user = req.user;

    // Get all unread notifications for user
    const notificationsQuery = query(
      getCollectionRef('notifications'),
      where('userIds', 'array-contains', user.uid),
      where('read', '==', false)
    );

    const snapshot = await notificationsQuery.get();
    const updates = snapshot.docs.map(doc => {
      const notification = doc.data();
      const readBy = notification.readBy || [];
      if (!readBy.includes(user.uid)) {
        readBy.push(user.uid);
      }
      return setDoc('notifications', doc.id, {
        ...notification,
        readBy,
        read: readBy.length > 0
      });
    });

    await Promise.all(updates);

    res.json({ success: true, count: updates.length });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
router.get('/preferences', authRequired, async (req, res) => {
  try {
    const user = req.user;

    const preferences = await getDoc('notificationPreferences', user.uid);

    if (!preferences) {
      // Return default preferences
      const defaultPreferences = {
        channels: {
          inApp: true,
          email: true,
          push: false,
          sms: false
        },
        frequency: 'realtime',
        digestSchedule: null,
        categories: {
          workOrders: { inApp: true, email: true },
          invoices: { inApp: true, email: true },
          contracts: { inApp: true, email: true },
          forms: { inApp: true, email: true },
          team: { inApp: true, email: true },
          security: { inApp: true, email: true },
          system: { inApp: true, email: false }
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        }
      };

      res.json({ preferences: defaultPreferences });
      return;
    }

    res.json({ preferences });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
router.put('/preferences', authRequired, validateRequest(notificationPreferencesSchema), async (req, res) => {
  try {
    const user = req.user;
    const preferences = req.body;

    await setDoc('notificationPreferences', user.uid, {
      ...preferences,
      userId: user.uid,
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

module.exports = router;

