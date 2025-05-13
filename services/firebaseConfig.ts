// src/firebase.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCNLDlGGnF5aWOuqCs3DvvP0Z718VeAh5A",
  authDomain: "seguranca-patrimonial-385514.firebaseapp.com",
  databaseURL: "https://seguranca-patrimonial-385514-default-rtdb.firebaseio.com",
  projectId: "seguranca-patrimonial-385514",
  storageBucket: "seguranca-patrimonial-385514.appspot.com",
  messagingSenderId: "554015247688",
  appId: "1:554015247688:web:d5027e4c3a869cffbdf77d",
  measurementId: "G-C15XLCYDPP"
};

// Inicializa o app Firebase
const app = firebase.initializeApp(firebaseConfig);

// Firestore padrão (compatível)
const db = firebase.firestore();

// Firestore para a ronda digital (modular)
const otherDb = getFirestore(app, 'ronda-digital');

// Storage (modular - recomendado para novas implementações)
const storage = getStorage(app);

export { firebase, db, otherDb, storage };
