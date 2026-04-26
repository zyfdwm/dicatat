import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDnIzZQouW2ef4KMBMCfJ2-jeqZBn-htP0",
  authDomain: "dicatat-app.firebaseapp.com",
  projectId: "dicatat-app",
  storageBucket: "dicatat-app.firebasestorage.app",
  messagingSenderId: "986704563293",
  appId: "1:986704563293:web:27c0dd0d45a370581991b4",
  measurementId: "G-9MFP9XSDVN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
