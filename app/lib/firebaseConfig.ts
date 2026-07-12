import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
  indexedDBLocalPersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyCuQ1ygY4iQ0cJvJXREqe9ijYjvPvcXhvY",
  authDomain: "phagescan-5c4eb.firebaseapp.com",
  projectId: "phagescan-5c4eb",
  storageBucket: "phagescan-5c4eb.firebasestorage.app",
  messagingSenderId: "254586623533",
  appId: "1:254586623533:web:6c94ccab9fc9f55dff8aa4",
  measurementId: "G-9B5NKL8KXQ",
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence:
    Platform.OS === "web"
      ? indexedDBLocalPersistence
      : getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
