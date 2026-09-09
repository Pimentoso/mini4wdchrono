'use strict';

const configuration = require('./configuration');
const log = require('./logger');

// Renderer-side authentication against Mini4WD Companion.
// The login flow opens the Companion auth page in the system browser, which
// calls back into the app through the mini4wdchrono:// custom protocol. The
// main process forwards the token here over IPC.

const BASE_URL = 'https://mini4wd-companion.com';

// Only these Companion roles are allowed to operate the chrono.
const ALLOWED_ROLES = ['organizer', 'admin', 'superadmin'];

let currentToken = null;
let currentUser = null;
let pendingCallbacks = null;

// Reads the persisted user, tolerating both object and legacy JSON string values.
const parseStoredUser = (storedUser) => {
    if (!storedUser) return null;
    if (typeof storedUser !== 'string') return storedUser;
    try {
        return JSON.parse(storedUser);
    } catch (error) {
        log.warn('[Companion] Could not parse stored user:', error);
        return null;
    }
};

// Persists the token and user profile of an authenticated session.
const saveCredentials = (token, user) => {
    currentToken = token;
    currentUser = user;
    configuration.set('companionToken', currentToken);
    configuration.set('companionUser', currentUser);
};

// Clears the local session and its persisted credentials.
const logout = () => {
    currentToken = null;
    currentUser = null;
    configuration.del('companionToken');
    configuration.del('companionUser');
};

// Reports whether a Companion session is currently active.
const isLoggedIn = () => {
    return currentToken !== null && currentUser !== null;
};

// Returns the bearer token of the active session, or null.
const getToken = () => {
    return currentToken;
};

// Returns the profile of the logged in user, or null.
const getUser = () => {
    return currentUser;
};

// Fetches the Companion profile associated with a bearer token.
const fetchUserInfo = (token, onSuccess, onError) => {
    $.ajax({
        url: `${BASE_URL}/api/v1/users/me`,
        type: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        success: (response) => {
            // Response format: { success: true, data: { user: { ... } } }
            const user = (response.data && response.data.user) || response.data || response;
            if (onSuccess) onSuccess(user);
        },
        error: (xhr, status, error) => {
            log.error('[Companion] Failed to fetch user info', { status: status, error: error });
            if (onError) onError(error);
        }
    });
};

// Completes a login attempt once the custom protocol callback delivers a token.
const handleAuthToken = (token) => {
    if (!token) return;

    fetchUserInfo(token, (user) => {
        const role = user.role || '';
        if (!ALLOWED_ROLES.includes(role)) {
            log.error('[Companion] User role not authorized for chrono', { role: role });
            if (pendingCallbacks && pendingCallbacks.onError) {
                pendingCallbacks.onError('unauthorized');
            }
            pendingCallbacks = null;
            return;
        }

        saveCredentials(token, user);
        log.info('[Companion] Login completed', { role: role });
        if (pendingCallbacks && pendingCallbacks.onSuccess) {
            pendingCallbacks.onSuccess(user);
        }
        pendingCallbacks = null;
    }, (error) => {
        if (pendingCallbacks && pendingCallbacks.onError) {
            pendingCallbacks.onError(error);
        }
        pendingCallbacks = null;
    });
};

// Restores a persisted session and subscribes to auth callbacks from the main process.
const init = () => {
    currentToken = configuration.get('companionToken') || null;
    currentUser = parseStoredUser(configuration.get('companionUser'));

    if (!currentToken || !currentUser) {
        // A half-written session is unusable; drop both halves.
        currentToken = null;
        currentUser = null;
    }

    window.electronAPI.onCompanionAuthCallback((_event, token) => {
        handleAuthToken(token);
    });
};

// Opens the Companion login page in the system browser.
const loginWithBrowser = (onSuccess, onError) => {
    pendingCallbacks = { onSuccess: onSuccess, onError: onError };
    log.info('[Companion] Opening browser login');
    window.electronAPI.openExternal(`${BASE_URL}/chrono-auth`);
};

// Re-checks the stored token against the server, logging out when it is rejected.
const validate = (onSuccess, onFailure) => {
    if (!currentToken) {
        if (onFailure) onFailure();
        return;
    }

    fetchUserInfo(currentToken, (user) => {
        currentUser = user;
        configuration.set('companionUser', currentUser);
        if (onSuccess) onSuccess(user);
    }, () => {
        logout();
        if (onFailure) onFailure();
    });
};

module.exports = {
    init: init,
    loginWithBrowser: loginWithBrowser,
    validate: validate,
    logout: logout,
    isLoggedIn: isLoggedIn,
    getToken: getToken,
    getUser: getUser
};
