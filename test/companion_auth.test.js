'use strict';

const { afterEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');

const MODULES = ['../js/configuration', '../js/companion_auth'];

// Lets fire-and-forget configuration writes finish in the mock IPC backend.
const flushAsyncWork = () => new Promise((resolve) => setImmediate(resolve));

// Creates a jQuery stub answering /users/me with a queued profile or an error.
const createAjaxStub = (responses = []) => {
    const queue = [...responses];
    const requests = [];

    return {
        requests: requests,
        jquery: {
            ajax: (options) => {
                requests.push(options);
                const next = queue.shift();
                if (!next || next.fail) {
                    if (options.error) options.error({}, 'error', 'Unauthorized');
                    return;
                }
                if (options.success) options.success({ success: true, data: { user: next } });
            }
        }
    };
};

// Creates an in-memory IPC backend recording the auth callback subscription.
const createElectronApi = (settings = {}) => {
    const persistedSettings = { ...settings };
    const opened = [];
    let authCallback = null;

    return {
        settings: persistedSettings,
        opened: opened,
        // Simulates the main process delivering a token from the custom protocol.
        deliverToken: (token) => authCallback(null, token),
        api: {
            configInit: async () => {},
            configGet: async (key) => persistedSettings[key],
            configSet: async (key, value) => {
                persistedSettings[key] = value;
            },
            configDel: async (key) => {
                delete persistedSettings[key];
            },
            openExternal: async (url) => opened.push(url),
            onCompanionAuthCallback: (callback) => {
                authCallback = callback;
            }
        }
    };
};

// Loads fresh auth modules against the supplied IPC backend and jQuery stub.
const loadAuth = async (backend, jquery) => {
    global.window = { electronAPI: backend.api, addEventListener: () => {} };
    global.$ = jquery;
    MODULES.forEach((name) => delete require.cache[require.resolve(name)]);

    const configuration = require('../js/configuration');
    const auth = require('../js/companion_auth');
    await configuration.initAsync();
    auth.init();

    return { configuration: configuration, auth: auth };
};

// Clears renderer globals and module state after every test.
afterEach(() => {
    delete global.window;
    delete global.$;
    MODULES.forEach((name) => delete require.cache[require.resolve(name)]);
});

const organizer = { id: 7, email: 'ada@example.com', display_name: 'Ada', role: 'organizer' };

describe('companion stored session', () => {
    test('restores a persisted session', async () => {
        const backend = createElectronApi({ companionToken: 'token-1', companionUser: organizer });
        const { auth } = await loadAuth(backend, createAjaxStub().jquery);

        assert.equal(auth.isLoggedIn(), true);
        assert.equal(auth.getToken(), 'token-1');
        assert.equal(auth.getUser().display_name, 'Ada');
    });

    test('parses a user persisted as a JSON string by an older version', async () => {
        const backend = createElectronApi({ companionToken: 'token-1', companionUser: JSON.stringify(organizer) });
        const { auth } = await loadAuth(backend, createAjaxStub().jquery);

        assert.equal(auth.isLoggedIn(), true);
        assert.equal(auth.getUser().role, 'organizer');
    });

    test('ignores a half-written session that has a token but no user', async () => {
        const backend = createElectronApi({ companionToken: 'token-1' });
        const { auth } = await loadAuth(backend, createAjaxStub().jquery);

        assert.equal(auth.isLoggedIn(), false);
        assert.equal(auth.getToken(), null);
    });

    test('starts logged out with no stored credentials', async () => {
        const backend = createElectronApi();
        const { auth } = await loadAuth(backend, createAjaxStub().jquery);

        assert.equal(auth.isLoggedIn(), false);
    });
});

describe('companion browser login', () => {
    test('opens the auth page and stores the session an accepted token resolves to', async () => {
        const backend = createElectronApi();
        const { auth } = await loadAuth(backend, createAjaxStub([organizer]).jquery);

        let loggedIn = null;
        auth.loginWithBrowser((user) => { loggedIn = user; }, () => {});
        assert.deepEqual(backend.opened, ['https://mini4wd-companion.com/chrono-auth']);

        backend.deliverToken('fresh-token');
        await flushAsyncWork();

        assert.equal(loggedIn.display_name, 'Ada');
        assert.equal(auth.isLoggedIn(), true);
        assert.equal(backend.settings.companionToken, 'fresh-token');
        assert.equal(backend.settings.companionUser.role, 'organizer');
    });

    test('accepts admin and superadmin accounts', async () => {
        for (const role of ['admin', 'superadmin']) {
            const backend = createElectronApi();
            const { auth } = await loadAuth(backend, createAjaxStub([{ ...organizer, role: role }]).jquery);

            auth.loginWithBrowser(() => {}, () => {});
            backend.deliverToken('fresh-token');
            await flushAsyncWork();

            assert.equal(auth.isLoggedIn(), true, `${role} should be allowed`);
        }
    });

    test('refuses an account without an organizer role and stores nothing', async () => {
        const backend = createElectronApi();
        const { auth } = await loadAuth(backend, createAjaxStub([{ ...organizer, role: 'racer' }]).jquery);

        let failure = null;
        auth.loginWithBrowser(() => {}, (error) => { failure = error; });
        backend.deliverToken('fresh-token');
        await flushAsyncWork();

        assert.equal(failure, 'unauthorized');
        assert.equal(auth.isLoggedIn(), false);
        assert.equal(backend.settings.companionToken, undefined);
    });

    test('reports failure when the profile cannot be fetched', async () => {
        const backend = createElectronApi();
        const { auth } = await loadAuth(backend, createAjaxStub([{ fail: true }]).jquery);

        let failed = false;
        auth.loginWithBrowser(() => {}, () => { failed = true; });
        backend.deliverToken('fresh-token');
        await flushAsyncWork();

        assert.equal(failed, true);
        assert.equal(auth.isLoggedIn(), false);
    });

    test('ignores an auth callback carrying no token', async () => {
        const backend = createElectronApi();
        const ajax = createAjaxStub([organizer]);
        const { auth } = await loadAuth(backend, ajax.jquery);

        backend.deliverToken('');
        await flushAsyncWork();

        assert.equal(ajax.requests.length, 0);
        assert.equal(auth.isLoggedIn(), false);
    });
});

describe('companion session validation', () => {
    test('refreshes the stored profile when the token is still good', async () => {
        const backend = createElectronApi({ companionToken: 'token-1', companionUser: organizer });
        const renamed = { ...organizer, display_name: 'Ada Lovelace' };
        const { auth } = await loadAuth(backend, createAjaxStub([renamed]).jquery);

        let refreshed = null;
        auth.validate((user) => { refreshed = user; }, () => {});
        await flushAsyncWork();

        assert.equal(refreshed.display_name, 'Ada Lovelace');
        assert.equal(backend.settings.companionUser.display_name, 'Ada Lovelace');
    });

    test('logs out and clears credentials when the token is rejected', async () => {
        const backend = createElectronApi({ companionToken: 'stale', companionUser: organizer });
        const { auth } = await loadAuth(backend, createAjaxStub([{ fail: true }]).jquery);

        let failed = false;
        auth.validate(() => {}, () => { failed = true; });
        await flushAsyncWork();

        assert.equal(failed, true);
        assert.equal(auth.isLoggedIn(), false);
        assert.equal(backend.settings.companionToken, undefined);
        assert.equal(backend.settings.companionUser, undefined);
    });

    test('fails immediately when there is no stored token', async () => {
        const backend = createElectronApi();
        const ajax = createAjaxStub([organizer]);
        const { auth } = await loadAuth(backend, ajax.jquery);

        let failed = false;
        auth.validate(() => {}, () => { failed = true; });

        assert.equal(failed, true);
        assert.equal(ajax.requests.length, 0);
    });
});

describe('companion logout', () => {
    test('clears the session and its persisted credentials', async () => {
        const backend = createElectronApi({ companionToken: 'token-1', companionUser: organizer });
        const { auth } = await loadAuth(backend, createAjaxStub().jquery);

        auth.logout();
        await flushAsyncWork();

        assert.equal(auth.isLoggedIn(), false);
        assert.equal(auth.getToken(), null);
        assert.equal(auth.getUser(), null);
        assert.equal(backend.settings.companionToken, undefined);
        assert.equal(backend.settings.companionUser, undefined);
    });
});
