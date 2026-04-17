import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_P3DZ33eURsr-kBDLWm4Wtocj4atvPl4",
  authDomain: "cmps-project-2.firebaseapp.com",
  projectId: "cmps-project-2",
  storageBucket: "cmps-project-2.firebasestorage.app",
  messagingSenderId: "962699118056",
  appId: "1:962699118056:web:1ef72e1b4e2f7e0144905d",
  measurementId: "G-7G854X37S4",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { app as firebaseApp };
