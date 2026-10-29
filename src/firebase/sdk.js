// Firebase is loaded from Google's CDN instead of npm.
// To upgrade, change the version number in the four URLs below.
export { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'
export {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithCustomToken, signOut,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'
// Desktop pop-ups (Firebase Cloud Messaging). Not Firebase Storage.
export { getMessaging, getToken, deleteToken, isSupported as isMessagingSupported } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js'
export {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, Timestamp, arrayUnion, arrayRemove, deleteField, runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'
