// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB1Dt1B2Rtus0aE8vSJI3mv3wZjDzy5WA4",
    authDomain: "quan-ly-kho-870d4.firebaseapp.com",
    projectId: "quan-ly-kho-870d4",
    storageBucket: "quan-ly-kho-870d4.firebasestorage.app",
    messagingSenderId: "390275074726",
    appId: "1:390275074726:web:bc96fcad441849ced5c267"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
