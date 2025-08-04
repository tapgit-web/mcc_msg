// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCjMLuNoumOOQsVVS4tpAhaUQ40H4ukJj0",
  authDomain: "my-msg-a001c.firebaseapp.com",
  projectId: "my-msg-a001c",
  storageBucket: "my-msg-a001c.firebasestorage.app",
  messagingSenderId: "525659606418",
  appId: "1:525659606418:web:526eabcc2779d97ed2054b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };
