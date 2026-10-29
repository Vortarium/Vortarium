// Copy to functions/index.js in your Firebase project (needs the Blaze plan).
// Setup:  cd functions && npm i firebase-admin firebase-functions
//         firebase functions:secrets:set GEMINI_KEY      (paste the NEW, rotated key when prompted)
//         firebase deploy --only functions
// Then set AI_ENDPOINT in earth_app.js to the function URL it prints.
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin"); admin.initializeApp();
const KEY = defineSecret("GEMINI_KEY");
const MODEL = "gemini-3.5-flash-lite"; // confirm the exact model ID in Google AI Studio
const last = new Map();
exports.earthAdvisor = onRequest({ secrets: [KEY], cors: true }, async (req, res) => {
  try {
    const { uid } = await admin.auth().verifyIdToken((req.get("Authorization") || "").replace("Bearer ", "")); // signed-in players only
    if (Date.now() - (last.get(uid) || 0) < 10000) return res.status(429).json({ text: null }); // 1 call / 10 s / player
    last.set(uid, Date.now());
    const prompt = String(req.body.prompt || "").slice(0, 1000);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY.value() },
      body: JSON.stringify({ contents: [{ parts: [{ text: "You advise a leader in a geopolitical strategy game. Reply in under 60 words. " + prompt }] }] }) });
    const j = await r.json();
    res.json({ text: j.candidates?.[0]?.content?.parts?.[0]?.text || null });
  } catch { res.status(401).json({ text: null }); }
});
