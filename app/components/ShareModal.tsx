import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Colors } from '../constants/Colors';
import { CustomModal } from './CustomModal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getUserByEmail } from '../services/firebaseService';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  onShareToHub: () => Promise<void>;
  onShareWithUser: (userId: string) => Promise<void>;
  experimentTitle: string;
}

interface UserSearchResult {
  id: string;
  name: string;
  lastName: string;
  email: string;
}

export function ShareModal({ 
  visible, 
  onClose, 
  onShareToHub, 
  onShareWithUser,
  experimentTitle 
}: ShareModalProps) {
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<UserSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSearchEmail('');
      setSearchResult(null);
    }
  }, [visible]);

  const handleSearch = async (email: string) => {
    setSearchEmail(email);
    if (email.length < 3) {
      setSearchResult(null);
      return;
    }

    setIsSearching(true);
    try {
      const user = await getUserByEmail(email);
      setSearchResult(user);
    } catch (error) {
      console.error('Error searching for user:', error);
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleShareWithUser = async () => {
    if (!searchResult) return;
    
    setIsSharing(true);
    try {
      await onShareWithUser(searchResult.id);
      onClose();
    } catch (error) {
      console.error('Error sharing with user:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareToHub = async () => {
    setIsSharing(true);
    try {
      await onShareToHub();
      onClose();
    } catch (error) {
      console.error('Error sharing to hub:', error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <CustomModal
      visible={visible}
      contentStyle={styles.modalContent}
      overlayStyle={styles.overlay}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Share Experiment</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color={Colors.darkGrey} />
        </TouchableOpacity>
      </View>

      <Text style={styles.experimentTitle}>{experimentTitle}</Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity 
          style={styles.shareOption} 
          onPress={handleShareToHub}
          disabled={isSharing}
        >
          <MaterialCommunityIcons name="earth" size={32} color={Colors.primary} />
          <Text style={styles.optionTitle}>Share to Hub</Text>
          <Text style={styles.optionDescription}>
            Make this experiment visible to all users
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.shareWithUserSection}>
          <Text style={styles.optionTitle}>Share with User</Text>
          <TextInput
            style={styles.emailInput}
            placeholder="Enter user email"
            value={searchEmail}
            onChangeText={handleSearch}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {isSearching && (
            <ActivityIndicator style={styles.searchingIndicator} color={Colors.primary} />
          )}

          {searchResult && (
            <TouchableOpacity 
              style={styles.userCard}
              onPress={handleShareWithUser}
              disabled={isSharing}
            >
              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {searchResult.name} {searchResult.lastName}
                </Text>
                <Text style={styles.userEmail}>{searchResult.email}</Text>
              </View>
              {isSharing ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <MaterialCommunityIcons 
                  name="share" 
                  size={24} 
                  color={Colors.primary} 
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </CustomModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    width: '90%',
    height: Dimensions.get('window').height * 0.6,
    borderRadius: 12,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  closeButton: {
    padding: 8,
  },
  experimentTitle: {
    fontSize: 18,
    color: Colors.darkGrey,
    marginBottom: 24,
  },
  optionsContainer: {
    flex: 1,
  },
  shareOption: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    marginVertical: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.darkGrey,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 24,
  },
  shareWithUserSection: {
    flex: 1,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 8,
  },
  searchingIndicator: {
    marginTop: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginTop: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.darkGrey,
    marginTop: 4,
  },
}); 