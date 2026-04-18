import { createContext, useContext, useEffect, useState } from \"react\";
import { onAuthStateChanged, signInWithPopup, signOut } from \"firebase/auth\";
import { doc, setDoc } from \"firebase/firestore\";
import { auth, db, googleProvider, ADMIN_UID } from \"../lib/firebase\";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Persist user profile for showing names on other pages
        try {
          await setDoc(
            doc(db, \"users\", u.uid),
            {
              uid: u.uid,
              displayName: u.displayName || u.email,
              email: u.email,
              photoURL: u.photoURL || null,
              lastSeen: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (e) {
          console.error(\"user profile save failed\", e);
        }
      }
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isAdmin = user?.uid === ADMIN_UID;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
