import { StyleSheet, View, ScrollView, Image, Dimensions, SafeAreaView, Pressable, Modal, TextInput, Alert } from 'react-native';
import { Text } from 'react-native';
import { Colors } from '../../constants/Colors';
import { mockLabWork, LabWork } from '../../constants/MockData';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import { ExperimentCard } from '../../components/ExperimentCard';
import { CustomModal } from '../../components/CustomModal';
import { CustomButton } from '../../components/CustomButton';
import { ExperimentDetailModal } from '../../components/ExperimentDetailModal';
import { getExperiments, createExperiment, deleteExperiment, updateExperiment } from '../../services/firebaseService';
import * as ImagePicker from 'expo-image-picker';
import { uploadExperimentImage } from '../../services/firebaseService';

export default function LabWorkScreen() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [labWorks, setLabWorks] = useState<LabWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabWork, setNewLabWork] = useState({
    title: '',
    subtitle: '',
    description: '',
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [deletedExperimentName, setDeletedExperimentName] = useState('');
  const [selectedExperiment, setSelectedExperiment] = useState<LabWork | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchExperiments = async () => {
      setLoading(true);
      try {
        const experiments = await getExperiments();
        if (!experiments || experiments.length === 0) {
          setLabWorks([]);
        } 
        else {
          setLabWorks(experiments);
        }
      } catch (error) {
        console.error('Error fetching experiments 1:', error);
        setLabWorks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExperiments();
  }, []);

  // Memoize the sorted lab works to prevent unnecessary re-renders
  const sortedLabWorks = useMemo(() => {
    return [...labWorks].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [labWorks]);

  const generateUniqueId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSubmit = async () => {
    if (!newLabWork.title || !newLabWork.description) {
      Alert.alert('Required Fields', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      const experimentId = await createExperiment({
        title: newLabWork.title,
        subtitle: newLabWork.subtitle,
        description: newLabWork.description,
      });
      
      if (experimentId) {
        // Upload image if one was selected
        if (selectedImage) {
          const imageURL = await uploadExperimentImage(selectedImage, experimentId);
          if (imageURL) {
            // Update the experiment with the image URL
            await updateExperiment(experimentId, { imageURL });
          }
        }
        
        // Refresh the experiments list
        const experiments = await getExperiments();
        setLabWorks(experiments);
        
        // Reset form and close modal
        setNewLabWork({ title: '', subtitle: '', description: '' });
        setSelectedImage(null);
        setIsModalVisible(false);
      }
    } catch (error) {
      console.error('Error submitting experiment:', error);
      Alert.alert('Error', 'Failed to create experiment');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleDelete = (id: string) => {
    setSelectedLabId(id);
    setIsDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (selectedLabId) {
      setLoading(true);
      
      try {
        const experimentToDelete = labWorks.find(lab => lab.id === selectedLabId);
        setDeletedExperimentName(experimentToDelete?.title || '');
        
        // Delete from Firebase
        const success = await deleteExperiment(selectedLabId);
        
        if (success) {
          // Update local state
          setLabWorks(labWorks.filter(lab => lab.id !== selectedLabId));
          
          // Show success modal
          setShowSuccessModal(true);
          
          // Hide success modal after 2.5 seconds
          setTimeout(() => {
            setShowSuccessModal(false);
          }, 2500);
        }
      } catch (error) {
        // Handle error
      } finally {
        setIsDeleteModalVisible(false);
        setSelectedLabId(null);
        setLoading(false);
      }
    }
  };

  const handleExperimentPress = (experiment: LabWork) => {
    setSelectedExperiment(experiment);
    setIsDetailModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading experiments...</Text>
        </View>
      ) : (
        <>
          {labWorks.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <MaterialCommunityIcons 
                name="flask-empty-outline" 
                size={80} 
                color={Colors.primary} 
              />
              <Text style={styles.emptyStateTitle}>No Experiments Yet</Text>
              <Text style={styles.emptyStateText}>
                Start by adding your first experiment using the button below
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {sortedLabWorks.map((lab: LabWork) => (
                <ExperimentCard
                  key={lab.id}
                  id={lab.id}
                  title={lab.title}
                  subtitle={lab.subtitle}
                  description={lab.description}
                  imageUrl={lab.imageUrl}
                  date={lab.date}
                  onDelete={handleDelete}
                  formatDate={formatDate}
                  onPress={() => handleExperimentPress(lab)}
                />
              ))}
            </ScrollView>
          )}
          
          {/* Add New Button */}
          <Pressable 
            style={styles.addButton}
            onPress={() => setIsModalVisible(true)}
          >
            <MaterialCommunityIcons name="plus" size={24} color="white" />
            <Text style={styles.addButtonText}>Add New</Text>
          </Pressable>

          {/* New Experiment Modal */}
          <CustomModal
            visible={isModalVisible}
            animationType="slide"
            onRequestClose={() => setIsModalVisible(false)}
          >
            <Text style={styles.modalTitle}>New Experiment</Text>
            
            {/* Image Upload Section */}
            <Pressable 
              style={styles.imageUploadContainer} 
              onPress={pickImage}
            >
              {selectedImage ? (
                <>
                  <Image 
                    source={{ uri: selectedImage }} 
                    style={styles.imagePreview} 
                  />
                  <View style={styles.imageOverlay}>
                    <Text style={styles.changeImageText}>Tap to change image</Text>
                  </View>
                </>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <MaterialCommunityIcons 
                    name="image-plus" 
                    size={40} 
                    color={Colors.primary} 
                  />
                  <Text style={styles.uploadText}>Add Cover Image</Text>
                  <Text style={styles.uploadSubText}>(Optional)</Text>
                </View>
              )}
            </Pressable>

            <TextInput
              style={styles.input}
              placeholder="Title *"
              placeholderTextColor="#666"
              value={newLabWork.title}
              onChangeText={(text) => setNewLabWork({...newLabWork, title: text})}
            />
            <TextInput
              style={styles.input}
              placeholder="Subtitle (optional)"
              placeholderTextColor="#666"
              value={newLabWork.subtitle}
              onChangeText={(text) => setNewLabWork({...newLabWork, subtitle: text})}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description *"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              value={newLabWork.description}
              onChangeText={(text) => setNewLabWork({...newLabWork, description: text})}
            />
            <View style={styles.modalButtons}>
              <CustomButton
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setIsModalVisible(false);
                  setSelectedImage(null);
                  setNewLabWork({ title: '', subtitle: '', description: '' });
                }}
                style={styles.modalButton}
              />
              <CustomButton
                title="Submit"
                onPress={handleSubmit}
                style={styles.modalButton}
              />
            </View>
          </CustomModal>

          {/* Delete Confirmation Modal */}
          <CustomModal
            visible={isDeleteModalVisible}
            contentStyle={styles.deleteModalContent}
          >
            <Text style={styles.deleteModalTitle}>Delete Experiment</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this experiment? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <CustomButton
                title="Cancel"
                variant="secondary"
                onPress={() => setIsDeleteModalVisible(false)}
                style={styles.modalButton}
              />
              <CustomButton
                title="Delete"
                variant="danger"
                onPress={confirmDelete}
                style={styles.modalButton}
              />
            </View>
          </CustomModal>

          {/* Success Notification Modal */}
          <CustomModal
            visible={showSuccessModal}
            overlayStyle={styles.successModalOverlay}
            contentStyle={styles.successModalContent}
          >
            <MaterialCommunityIcons name="check-circle" size={24} color={Colors.primary} />
            <Text style={styles.successModalText}>
              Experiment "{deletedExperimentName}" deleted
            </Text>
          </CustomModal>

          {/* Add the detail modal */}
          {selectedExperiment && (
            <ExperimentDetailModal
              visible={isDetailModalVisible}
              experiment={selectedExperiment}
              onClose={() => setIsDetailModalVisible(false)}
              formatDate={formatDate}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100, // Make room for floating button
    alignItems: 'center',
  },
  card: {
    width: Dimensions.get('window').width - 32,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    // Android shadow
    elevation: 4,
  },
  cardImage: {
    width: '100%',
    height: 200,
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: Colors.secondary,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#555',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: Colors.highlight,
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.secondary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  submitButton: {
    backgroundColor: Colors.accent,
  },
  cancelButtonText: {
    color: Colors.accent,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dateContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deleteModalContent: {
    width: '80%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.error,
    marginBottom: 15,
  },
  deleteModalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  deleteButton2: {
    backgroundColor: Colors.error,
    flex: 1,
    marginLeft: 10,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  successModalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxWidth: '80%',
  },
  successModalText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.primary,
  },
  imageUploadContainer: {
    width: '100%',
    height: 200,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  uploadText: {
    marginTop: 12,
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  uploadSubText: {
    marginTop: 4,
    color: Colors.secondary,
    fontSize: 14,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.darkGrey,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 24,
  },
});


   