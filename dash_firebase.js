// dash_firebase.js - Firebase setup for DASH
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAlQ0fG9UUgyFFdwlKlTb0p2nbeoJkc3ig",
  authDomain: "dash-da809.firebaseapp.com",
  projectId: "dash-da809",
  storageBucket: "dash-da809.firebasestorage.app",
  messagingSenderId: "463073446480",
  appId: "1:463073446480:web:d939f6448a8391dcfa9f55",
  measurementId: "G-G3D6GQ09CJ"
};

export const app = initializeApp(firebaseConfig);
isSupported().then(ok => { if (ok) getAnalytics(app); }).catch(() => {});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
