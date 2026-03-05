# BOOTMARK Super Admin Security Architecture

This document outlines the enterprise-grade security controls implemented for the BOOTMARK Super Admin panel.

## 1. Multi-Admin Enforcement
- **Limit**: The platform strictly enforces a maximum of **two (2) Super Admin accounts**.
- **Enforcement**: This is checked both at the application level (`PlatformService.js`) and in the `platform/config` document in Firestore.
- **Why**: Minimizing the number of high-privileged accounts reduces the overall attack surface and ensures clear accountability.

## 2. Multi-Factor Authentication (MFA)
- **Mechanism**: Time-based One-Time Password (TOTP) following the RFC 6238 standard.
- **Provider**: Handled via `otplib` and `qrcode` for setup.
- **Enforcement**: Any user with `isSuperAdmin: true` is required to enroll in MFA and provide a valid token upon login.
- **Storage**: MFA secrets are stored in a dedicated `mfaSecrets` collection, which is restricted to backend-only access (denied to all users via Firestore rules).

## 3. Step-up Re-authentication
- **Concept**: For highly sensitive "write" operations, a fresh MFA verification is required if the last verification was more than 5 minutes ago.
- **Sensitive Operations**:
    - Changing a tenant's subscription plan.
    - Initiating user impersonation.
    - Manually suspending/approving businesses.
- **Implementation**: The `stepUpRequired` middleware in `authorize.js` intercepts these requests and prompts the user for a fresh TOTP if the session marker is expired.

## 4. User Impersonation Security
- **Auditing**: Every impersonation session initiation is logged in `platformAuditLogs` with the acting admin's ID and the target user.
- **MFA Flow**: Impersonation is only possible AFTER the admin has successfully passed a "Step-up" MFA check.
- **Visual Indicator**: A permanent `ImpersonationBar` is displayed at the top of the screen during an active session, preventing unintended actions or session leaks.
- **Session Control**: Admins can exit the session at any time, which immediately clears the impersonation session variables on the server.

## 5. Firestore Rule Hierarchy
The security of the Super Admin data is enforced by several layers of rules:
- `isSuperAdmin()` function: Checks both custom claims and the user document for the `isSuperAdmin` flag.
- `platformAuditLogs`: Immutable and restricted to Super Admin `read` only.
- `webhooks` / `paymentAttempts`: Backend-only isolation (all client reads/writes denied).
- `platform/config`: Strictly Super Admin only.
