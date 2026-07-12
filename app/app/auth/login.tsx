import { useState } from "react";  // React Hook for handling input
import { View, TextInput, Button, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";// UI components
import { signInWithEmailAndPassword } from "firebase/auth"; //Firebase function for login
import { auth } from "../../lib/firebaseConfig";
import { useRouter } from "expo-router"; 
import { Colors } from "../../constants/Colors"; //Import the colours that are constantly used in the app


// export makes the function available for import by other files 
export default function LoginScreen(){ // function component 
    //create state variables with an empty string as the default value to store user's email, password and any error messages 
    //useState re-renders the component when state values change.
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(""); 

    const handleLogin = async () => { //handles asynchronous code (waiting for Firebase response)
        if (!email || !password) {
          setError("Please fill in all fields");
          Alert.alert("Error", "Please fill in all fields");
          return;
        }
        setError("");
        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            if (userCredential.user) {
                router.replace("/(tabs)/lab-work");
            }
        } catch (error: any) {
            Alert.alert("Login Failed", error.message || "Please check your credentials and try again");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome Back!</Text>

            <TextInput //User input field for entering email/password
            style={styles.input} 
                placeholder="Email" //text inside the input field when it's empty 
                placeholderTextColor={Colors.primary} // Makes the placeholder match the theme color 
                onChangeText={setEmail} //Updates state (email) when text changes 
                value={email} //keeps the input controlled by the component state 
                autoCapitalize="none"
                keyboardType="email-address"
            />

            <TextInput //same idea as above but for the password field 
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.primary} // Use primary color
                secureTextEntry
                onChangeText={setPassword}
                value={password}
            />
            {/* set up a button that responds to user interaction
            and triggers the handleLogin function. Upon being pressed, 
            it navigates users to their profile. 
            */}
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}> 
                <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>

            {error && <Text testID="error-msg" style={styles.errorText}>{error}</Text>}

            <TouchableOpacity onPress={() => router.push("/auth/signUp")}>
              <Text style={styles.link}>Don't have an account? <Text style={styles.underline}>Sign up</Text></Text>
            </TouchableOpacity>

            {loading && <ActivityIndicator size="large" color={Colors.primary} />}
        </View>
        );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 30,
    },
    title: {
      fontSize: 26,
      fontWeight: "bold",
      marginBottom: 20,
      color: Colors.primary,
    },
    input: {
      width: "100%",
      height: 50,
      backgroundColor: Colors.secondary,
      borderRadius: 8,
      paddingHorizontal: 15,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: Colors.primary,
    },
    loginButton: {
      backgroundColor: Colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 50,
      borderRadius: 8,
      alignItems: "center",
      width: "100%",
    },
    buttonText: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "bold",
    },
    errorText: {
      color: Colors.error,
      marginTop: 10,
    },
    link: {
      color: Colors.primary,
      marginTop: 15,
      fontSize: 16,
    },
    underline: {
      textDecorationLine: "underline", // Underline text
      color: Colors.primary,  // Use theme color
      fontWeight: "bold",     // Make it stand out
  },
});
