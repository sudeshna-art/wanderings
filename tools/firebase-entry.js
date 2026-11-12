export { initializeApp } from 'firebase/app';
export { getAuth, onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from 'firebase/auth';
export { initializeFirestore, persistentLocalCache, persistentSingleTabManager, doc, collection, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
