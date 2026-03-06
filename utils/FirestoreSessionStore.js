/**
 * FirestoreSessionStore
 *
 * A production-ready session store for express-session that persists
 * sessions in Firestore. No extra npm packages required — uses the
 * existing db.js Firestore connection.
 *
 * Usage in server.js:
 *   const FirestoreSessionStore = require('./utils/FirestoreSessionStore');
 *   app.use(session({ store: new FirestoreSessionStore(session), ... }));
 */

const COLLECTION = 'sessions';

class FirestoreSessionStore {
    constructor(session) {
        const Store = session.Store;
        // Inherit from express-session Store so it gets the right prototype
        class FSStore extends Store {
            constructor() {
                super();
                // Lazy-load db to avoid circular dependency issues on startup
                this._db = null;
            }

            _getDb() {
                if (!this._db) {
                    this._db = require('./db');
                }
                return this._db;
            }

            /** Retrieve a session by sid */
            get(sid, callback) {
                const { getCollectionRef } = this._getDb();
                getCollectionRef(COLLECTION)
                    .doc(sid)
                    .get()
                    .then(doc => {
                        if (!doc.exists) return callback(null, null);
                        const data = doc.data();
                        // Check expiry
                        if (data.expires && Date.now() > data.expires) {
                            this.destroy(sid, () => { });
                            return callback(null, null);
                        }
                        callback(null, data.session);
                    })
                    .catch(err => callback(err));
            }

            /** Save / update a session */
            set(sid, session, callback) {
                const { getCollectionRef } = this._getDb();
                const expires = session.cookie?.expires
                    ? new Date(session.cookie.expires).getTime()
                    : Date.now() + 60 * 24 * 60 * 60 * 1000; // 60 days default

                getCollectionRef(COLLECTION)
                    .doc(sid)
                    .set({ session, expires, updatedAt: Date.now() })
                    .then(() => callback(null))
                    .catch(err => callback(err));
            }

            /** Destroy a session */
            destroy(sid, callback) {
                const { getCollectionRef } = this._getDb();
                getCollectionRef(COLLECTION)
                    .doc(sid)
                    .delete()
                    .then(() => callback(null))
                    .catch(err => callback(err));
            }

            /** Touch (refresh expiry) */
            touch(sid, session, callback) {
                this.set(sid, session, callback);
            }
        }

        return FSStore;
    }
}

module.exports = FirestoreSessionStore;
