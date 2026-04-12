import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBfkqkhk0z8xuritMgzf4Bhf_N2Na-Co-Y",
  authDomain: "stream-2o.firebaseapp.com",
  projectId: "stream-2o",
  storageBucket: "stream-2o.firebasestorage.app",
  messagingSenderId: "6845983758",
  appId: "1:6845983758:web:f0016e044e8aadb192e05f",
  measurementId: "G-EZSCM2ZX7W"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
