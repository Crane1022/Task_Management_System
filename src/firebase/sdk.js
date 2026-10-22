// Firebase is loaded from Google's CDN instead of npm.
// To upgrade, change the version number in the four URLs below.
export { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'
export {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'
export {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch,
  onSnapshot, query, where, serverTimestamp, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'
