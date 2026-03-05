const { authenticator } = require('otplib');
const qrcode = require('qrcode');

/**
 * MFA Service
 * Handles TOTP secret generation, QR code creation, and verification.
 */
class MFAService {
    /**
     * Generate a new TOTP secret for a user
     * @param {string} userEmail 
     * @returns {Object} { secret, otpauthUrl }
     */
    generateSecret(userEmail) {
        // Ensure userEmail is a valid string for keyuri, fallback to a default if missing
        const safeEmail = (userEmail && typeof userEmail === 'string') ? userEmail : 'user@bootmark.app';

        const secret = authenticator.generateSecret();
        const otpauthUrl = authenticator.keyuri(safeEmail, 'BOOTMARK', secret);
        return { secret, otpauthUrl };
    }

    /**
     * Generate a QR code Data URI from an otpauth URL
     * @param {string} otpauthUrl 
     * @returns {Promise<string>} QR Data URI
     */
    async generateQRCode(otpauthUrl) {
        try {
            return await qrcode.toDataURL(otpauthUrl);
        } catch (error) {
            console.error('QR Code Generation Error:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    /**
     * Verify a TOTP token against a secret
     * @param {string} token 6-digit code
     * @param {string} secret stored user secret
     * @returns {boolean}
     */
    verifyToken(token, secret) {
        return authenticator.check(token, secret);
    }
}

module.exports = new MFAService();
