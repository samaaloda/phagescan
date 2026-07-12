import { useState, useEffect } from "react";
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { auth } from "../lib/firebaseConfig";
import { useRouter } from "expo-router";
import { getFirestore, doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { Colors } from "../constants/Colors";

const firestore = getFirestore();

export default function EditProfileScreen() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [lastName, setLastName] = useState("");
    const [role, setRole] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("Current User in useEffect:", auth.currentUser);
        const fetchUserData = async () => {
            const currentUser = auth.currentUser;
            if (currentUser) {
                const userDocRef = doc(firestore, "users", currentUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setName(userData.name || "");
                    setLastName(userData.lastName || "");
                    setRole(userData.role || "");
                }
            }
            setLoading(false);
        };

        fetchUserData();
    }, []);

    const handleUpdateProfile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        Alert.alert("Error", "No authenticated user found.");
        return;
    }

    try {
        const userDocRef = doc(firestore, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            // Create the doc if it doesn’t exist
            await setDoc(userDocRef, { name, lastName, role });
        } else {
            // Update existing doc
            await updateDoc(userDocRef, { name, lastName, role });
        }

        Alert.alert("Success", "Profile updated successfully!");
        router.replace("/(tabs)/profile");
    } catch (error) {
        console.log("Update failed:", error);
        Alert.alert("Error", "Failed to update profile. Try again.");
    }
};


    return (
        <View style={styles.container}>
            <Text style={styles.header}>Edit Profile</Text>

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

            <TouchableOpacity style={styles.button} onPress={handleUpdateProfile}>
                <Text style={styles.buttonText}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => router.replace("/(tabs)/profile")}>
                <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        paddingHorizontal: 30,
        paddingTop: 50,
        alignItems: "center",
    },
    header: {
        fontSize: 26,
        fontWeight: "bold",
        color: Colors.primary,
        marginBottom: 30,
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
        fontSize: 16,
    },
    button: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 60,
        borderRadius: 12,
        alignItems: "center",
        width: "100%",
        marginBottom: 15,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowOffset: { width: 2, height: 2 },
        shadowRadius: 5,
        elevation: 5,
    },
    cancelButton: {
        backgroundColor: "grey",
        paddingVertical: 14,
        paddingHorizontal: 60,
        borderRadius: 12,
        alignItems: "center",
        width: "100%",
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowOffset: { width: 2, height: 2 },
        shadowRadius: 5,
        elevation: 5,
    },
    buttonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
    },
});

