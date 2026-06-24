/*
 * One-time operational script. Run with Application Default Credentials:
 *   set ADMIN_UID=<Firebase Auth UID>
 *   node scripts/set-admin-claim.js
 *
 * Do not put an e-mail address or a service-account key in this repository.
 */
const admin = require('firebase-admin');

const uid = process.env.ADMIN_UID;
if (!uid) {
  throw new Error('ADMIN_UID is required. Set it to the Firebase Auth UID to promote.');
}

admin.initializeApp();

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => console.log('Admin claim granted. The user must sign in again.'))
  .catch((error) => {
    console.error('Could not grant admin claim:', error.message);
    process.exitCode = 1;
  });
