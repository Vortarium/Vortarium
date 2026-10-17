// Optional (needs the Blaze plan): clears every DM at 12am Eastern, server side.
// Put this in functions/index.js, then run: firebase deploy --only functions
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();

exports.purgeDms = onSchedule({ schedule: '0 0 * * *', timeZone: 'America/New_York' }, async () => {
  const db = admin.firestore();
  await db.recursiveDelete(db.collection('dms'));
});
