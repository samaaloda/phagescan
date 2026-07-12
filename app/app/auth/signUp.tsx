import { useState } from "react";  // React Hook for handling input
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from "react-native"; // UI components
import { createUserWithEmailAndPassword } from "firebase/auth"; // Firebase sign-up function
import { auth } from "../../lib/firebaseConfig";
import { useRouter } from "expo-router"; 
import { Colors } from "../../constants/Colors"; //Import the colours that are constantly used in the app
import { getFirestore, doc, setDoc } from "firebase/firestore"; // Import Firestore functions
const firestore = getFirestore(); // Initialize Firestore


// export makes the function available for import by other files 
export default function SignupScreen() { // function component 
    //create state variables with an empty string as the default value to store user's email, password and any error messages 
    //useState re-renders the component when state values change.
    const router = useRouter();
    const [name, setName] = useState("");
    const [lastName, setLastName] = useState("");
    const [role, setRole] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");

    const handleSignup = async () => { //handles asynchronous code (waiting for Firebase response)
        // check if all the required fields are filled
        if (!name || !lastName || !role) {
            setError("Please fill in all fields.");
            return;
          }
      
        // check if the passowrd in both fields match 
        if (password !== confirmPassword) {
            setError("Passwords do not match!");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password); //Firebase's createUserWithEmailAndPassword registers the email and password 
            const user = userCredential.user;
            const userDocRef = doc(firestore, "users", user.uid);
            await setDoc(userDocRef, {
                name,
                lastName,
                role,
                email, // Save email for reference
            });
            router.replace("/(tabs)/profile"); // Navigate to profile after sign-up

        } catch (err) {
            setError("Sign-up failed. Try again.");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Create an Account</Text>
            <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor={Colors.primary}
                onChangeText={setName}
                value={name}
            />

            <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor={Colors.primary}
                onChangeText={setLastName}
                value={lastName}
            />

            <TextInput
                style={styles.input}
                placeholder="Role"
                placeholderTextColor={Colors.primary}
                onChangeText={setRole}
                value={role}
            />

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
                placeholderTextColor={Colors.primary}
                secureTextEntry
                onChangeText={setPassword}
                value={password}
            />

            <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={Colors.primary}
                secureTextEntry
                onChangeText={setConfirmPassword}
                value={confirmPassword}
            />
            {/* set up a button that responds to user interaction
            and triggers the handleSignup function. Upon being pressed, 
            it navigates users to their profile. 
            */}
            <TouchableOpacity style={styles.signupButton} onPress={handleSignup}> 
                <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity onPress={() => router.push("/auth/login")}>
                <Text style={styles.link}>Already have an account? <Text style={styles.underline}></Text></Text>
            </TouchableOpacity>
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
    signupButton: {
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