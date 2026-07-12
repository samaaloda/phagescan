import { useRouter } from 'expo-router'; // Redirect users based on login status & allow navigation
import { useEffect, useState } from 'react'; // Manage state and lifecycle
import { onAuthStateChanged, User } from 'firebase/auth'; // Listen for authentication changes
import { auth } from "../lib/firebaseConfig";

export default function Index() {
  // Store user authentication state
  const [user, setUser] = useState<User | null>(null);  
  const [loading, setLoading] = useState(true); // Track if authentication is still being checked
  const router = useRouter(); // Allow navigation

  useEffect(() => {
    // Listen for authentication changes
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);// Update user state
      setLoading(false); // Stop loading once we have authentication info
    });

    return () => unsubscribe(); // Cleanup listener when component unmounts
  }, []);


  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/(tabs)/profile"); // Always navigate to profile after login
      } else {
        router.replace("/auth/login"); // Always navigate to login if no user
      }
    }
  }, [loading, user]);

  return null; // Prevents flickering while checking authentication
}
