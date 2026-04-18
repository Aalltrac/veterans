import { initializeApp } from \"firebase/app\";
import { getAuth, GoogleAuthProvider } from \"firebase/auth\";
import { getFirestore } from \"firebase/firestore\";

const firebaseConfig = {
  apiKey: \"AIzaSyDocBp3vKx0g2Fpt-aly5ooV1wtD1PlsKc\",
  authDomain: \"veterans-cb03d.firebaseapp.com\",
  projectId: \"veterans-cb03d\",
  storageBucket: \"veterans-cb03d.firebasestorage.app\",
  messagingSenderId: \"343418942781\",
  appId: \"1:343418942781:web:6fed8d582294dfa41ec154\",
  measurementId: \"G-MRR2JJH3B2\",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_UID = \"2JLVZ0oNtRQiezaICYxVkM0gpiG2\";
