// src/firebaseConfig.js

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// !! IMPORTANT !!: Replace with YOUR specific Firebase config from console
const firebaseConfig = {
  apiKey: "AIzaSyDA2Hez0yO130taFt6jDAuTJsIJCbiMs6g",
  authDomain: "samuhiksaudahackathon.firebaseapp.com",
  projectId: "samuhiksaudahackathon",
  storageBucket: "samuhiksaudahackathon.firebasestorage.app",
  messagingSenderId: "342287718641",
  appId: "1:342287718641:web:ce949400e37ca396573150"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;