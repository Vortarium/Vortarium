// dash_functions.js - OPTIONAL Cloud Function (deploy with `firebase init functions`, put this in functions/index.js)
// Truly deletes every DM at 12am Eastern, even if nobody has the game open. Needs the Blaze plan.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp();

exports.dashClearDMs = onSchedule({ schedule: '0 0 * * *', timeZone: 'America/New_York' }, async () => {
  const db = getFirestore();
  const snap = await db.collectionGroup('messages').get();
  let batch = db.batch(), n = 0;
  for (const d of snap.docs) {
    if (!d.ref.path.startsWith('dms/')) continue;
    batch.delete(d.ref);
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
});
