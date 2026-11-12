import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBs0QXdZKYUYO8RwyXsnCw1haGpDTlAh5Q',
  authDomain: 'palle-nestham.firebaseapp.com',
  projectId: 'palle-nestham',
  storageBucket: 'palle-nestham.firebasestorage.app',
  messagingSenderId: '697505977856',
  appId: '1:697505977856:web:06ad118ae26a123b152ae5',
  measurementId: 'G-Z791V99QL7',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult };
