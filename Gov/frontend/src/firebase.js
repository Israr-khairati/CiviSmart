import { initializeApp } from "firebase/app"; 
import { getAuth } from "firebase/auth"; 

const firebaseConfig = { 
  apiKey: "AIzaSyA1Qu6aB85KOCYiqirdR5ZjFStXHdHQR6I", 
  authDomain: "civismart-1835.firebaseapp.com", 
  projectId: "civismart-1835", 
  storageBucket: "civismart-1835.firebasestorage.app", 
  messagingSenderId: "130934413950", 
  appId: "1:130934413950:web:dcea6f7233a59a60c7d62f", 
}; 

const app = initializeApp(firebaseConfig); 
export const auth = getAuth(app);
