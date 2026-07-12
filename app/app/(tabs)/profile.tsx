import { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, Pressable, Animated } from "react-native";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../lib/firebaseConfig";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/Colors";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { uploadProfilePicture } from "../../services/firebaseService";

const DEFAULT_PROFILE_PICTURE = "https://firebasestorage.googleapis.com/v0/b/phagescan-5c4eb.firebasestorage.app/o/blank_profile_picture.webp?alt=media&token=107fe229-424c-495a-a5db-1e613b92e70f";

const firestore = getFirestore();

interface UserData {
  name: string;
  lastName: string;
  role: string;
  profilePictureUrl?: string;
}

export default function ProfileScreen() {
    const router = useRouter();
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipOpacity = new Animated.Value(0);

    useEffect(() => {
        const fetchUserData = async () => {
            const currentUser = auth.currentUser;
            if (currentUser) {
                const userDocRef = doc(firestore, "users", currentUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    setUserData(userDoc.data() as UserData);
                }
            }
            setLoading(false);
        };

        fetchUserData();
    }, []);

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
            });

            if (!result.canceled && result.assets[0].uri) {
                setUploadingImage(true);
                const downloadUrl = await uploadProfilePicture(result.assets[0].uri);
                
                if (downloadUrl) {
                    setUserData(prev => prev ? {...prev, profilePictureUrl: downloadUrl} : null);
                    Alert.alert("Success", "Profile picture updated successfully!");
                }
            }
        } catch (error) {
            console.error('Error updating profile picture:', error);
            Alert.alert("Error", "Failed to update profile picture");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        router.replace("/auth/login");
    };

    const handlePasswordReset = async () => {
        const user = auth.currentUser;
        if (user && user.email) {
            try {
                await sendPasswordResetEmail(auth, user.email);
                Alert.alert("Password Reset", "Check your email for a reset link.");
            } catch (error) {
                Alert.alert("Error", "Failed to send reset email. Try again.");
            }
        } else {
            Alert.alert("Error", "No email associated with this account.");
        }
    };

    // Function to handle tooltip animation
    const handlePressIn = () => {
        setShowTooltip(true);
        Animated.timing(tooltipOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();

        // Auto-hide tooltip after 2 seconds
        setTimeout(() => {
            Animated.timing(tooltipOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start(() => setShowTooltip(false));
        }, 2000);
    };

    // Add this function to handle profile picture removal
    const handleRemoveProfilePicture = async () => {
        Alert.alert(
            "Remove Profile Picture",
            "Are you sure you want to remove your profile picture?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const userRef = doc(firestore, "users", auth.currentUser?.uid || "");
                            await updateDoc(userRef, {
                                profilePictureUrl: DEFAULT_PROFILE_PICTURE
                            });
                            
                            setUserData(prev => prev ? {
                                ...prev,
                                profilePictureUrl: DEFAULT_PROFILE_PICTURE
                            } : null);
                            
                            Alert.alert("Success", "Profile picture removed successfully!");
                        } catch (error) {
                            console.error('Error removing profile picture:', error);
                            Alert.alert("Error", "Failed to remove profile picture");
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.profileImageContainer}>
                <Pressable 
                    onPress={pickImage}
                    onPressIn={handlePressIn}
                    onLongPress={handleRemoveProfilePicture}
                    delayLongPress={500}
                    style={styles.profileImageWrapper}
                >
                    <Image 
                        source={{ 
                            uri: userData?.profilePictureUrl || DEFAULT_PROFILE_PICTURE 
                        }}
                        style={styles.profileImage}
                    />
                    {showTooltip && (
                        <Animated.View 
                            style={[
                                styles.tooltip, 
                                { opacity: tooltipOpacity }
                            ]}
                        >
                            <View style={styles.tooltipArrow} />
                            <Text style={styles.tooltipText}>
                                Tap to change, hold to remove
                            </Text>
                        </Animated.View>
                    )}
                </Pressable>
            </View>

            <View style={styles.userInfoContainer}>
                <Text style={styles.userName}>
                    {loading ? "Loading..." : `${userData?.name || "N/A"} ${userData?.lastName || "N/A"}`}
                </Text>
                <Text style={styles.userRole}>
                    {loading ? "Loading..." : `${userData?.role || "N/A"}`}
                </Text>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.button} onPress={() => router.push("/editProfile")}>
                    <Text style={styles.buttonText}>Edit Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.button} onPress={handlePasswordReset}>
                    <Text style={styles.buttonText}>Reset Password</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.button} onPress={handleLogout}>
                    <Text style={styles.buttonText}>Logout</Text>
                </TouchableOpacity>
            </View>
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
    profileHeader: {
        fontSize: 28,
        fontWeight: "bold",
        color: Colors.primary,
        marginBottom: 30,
    },
    profileImageContainer: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 20,
    },
    profileImageWrapper: {
        position: 'relative',
        width: 150,
        height: 150,
        borderRadius: 75,
        overflow: 'visible',
        backgroundColor: '#f0f0f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    profileImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
        borderRadius: 75,
    },
    tooltip: {
        position: 'absolute',
        top: -50,
        left: -10,
        right: -10,
        backgroundColor: Colors.primary,
        padding: 8,
        borderRadius: 8,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    tooltipArrow: {
        position: 'absolute',
        bottom: -8,
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 8,
        borderStyle: 'solid',
        backgroundColor: 'transparent',
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: Colors.primary,
    },
    tooltipText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    userInfoContainer: {
        alignItems: "center",
        marginBottom: 50,
    },
    userName: {
        fontSize: 36,
        fontWeight: "bold",
        color: Colors.primary,
        textAlign: 'center',
    },
    userRole: {
        fontSize: 20,
        fontWeight: "600",
        color: Colors.primary,
        marginTop: 5,
        textAlign: 'center',
    },
    buttonContainer: {
        width: "100%",
        alignItems: "center",
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
    buttonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
    },
});
