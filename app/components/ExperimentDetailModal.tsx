import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Pressable, Animated, SafeAreaView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Colors } from '../constants/Colors';
import { CustomModal } from './CustomModal';
import { CustomButton } from './CustomButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { WellPlateCard, WellPlate, getProgressColor } from './WellPlateCard';
import WellPlateDetailsModal from './WellPlateDetailsModal';
import { shareExperiment, isExperimentShared, makeExperimentPrivate, updateExperiment, getWellPlatesForExperiment, deleteWellPlate } from '../services/firebaseService';
import { ShareModal } from './ShareModal';

interface ExperimentDetailModalProps {
  visible: boolean;
  experiment: {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    imageUrl: string;
    date: string;
  };
  onClose: () => void;
  formatDate: (date: string) => string;
}

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export function ExperimentDetailModal({
  visible,
  experiment,
  onClose,
  formatDate,
}: ExperimentDetailModalProps) {
  const [wellPlates, setWellPlates] = useState<WellPlate[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [plateToDelete, setPlateToDelete] = useState<WellPlate | null>(null);
  const [selectedWellPlate, setSelectedWellPlate] = useState<WellPlate | null>(null);
  const [isWellPlateModalVisible, setIsWellPlateModalVisible] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMakingPrivate, setIsMakingPrivate] = useState(false);
  const [privateSuccess, setPrivateSuccess] = useState(false);
  
  // New state variables for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(experiment.title);
  const [editedSubtitle, setEditedSubtitle] = useState(experiment.subtitle);
  const [editedDescription, setEditedDescription] = useState(experiment.description);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoadingWellPlates, setIsLoadingWellPlates] = useState(false);

  // Add new state
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);

  // Update edited values when experiment changes
  useEffect(() => {
    setEditedTitle(experiment.title);
    setEditedSubtitle(experiment.subtitle);
    setEditedDescription(experiment.description);
  }, [experiment]);

  // Fetch well plates when the modal becomes visible
  useEffect(() => {
    if (visible && experiment.id) {
      fetchWellPlates();
      checkIfShared();
    }
  }, [visible, experiment.id]);

  // Function to fetch well plates
  const fetchWellPlates = async () => {
    setIsLoadingWellPlates(true);
    try {
      const plates = await getWellPlatesForExperiment(experiment.id);
      setWellPlates(plates);
    } catch (error) {
      console.error('Error fetching well plates:', error);
    } finally {
      setIsLoadingWellPlates(false);
    }
  };

  const handleDeletePlate = async (plate: WellPlate) => {
    setPlateToDelete(plate);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (plateToDelete) {
      try {
        const success = await deleteWellPlate(plateToDelete.id, experiment.id);
        if (success) {
          // Remove the plate from local state
          setWellPlates(currentPlates => 
            currentPlates.filter(plate => plate.id !== plateToDelete.id)
          );
          setShowDeleteModal(false);
          setPlateToDelete(null);
        } else {
          Alert.alert(
            "Error",
            "Failed to delete well plate. Please try again."
          );
        }
      } catch (error) {
        console.error('Error deleting well plate:', error);
        Alert.alert(
          "Error",
          "An error occurred while deleting the well plate."
        );
      }
    }
  };

  const handleWellPlatePress = (plate: WellPlate) => {
    setSelectedWellPlate(plate);
    setIsWellPlateModalVisible(true);
  };

  // Check if experiment is shared when modal opens
  const checkIfShared = async () => {
    setIsLoading(true);
    try {
      const shared = await isExperimentShared(experiment.id);
      setIsShared(shared);
    } catch (error) {
      console.error('Error checking if experiment is shared:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Modify handleShareExperiment to show modal instead
  const handleShareExperiment = () => {
    setIsShareModalVisible(true);
  };

  // Add new handlers
  const handleShareToHub = async () => {
    return await shareExperiment(experiment.id);
  };

  const handleShareWithUser = async (userId: string) => {
    return await shareExperiment(experiment.id, userId);
  };

  // Handle make private
  const handleMakePrivate = async () => {
    setIsMakingPrivate(true);
    try {
      const success = await makeExperimentPrivate(experiment.id);
      if (success) {
        setPrivateSuccess(true);
        setIsShared(false);
        // Reset success message after 2.5 seconds
        setTimeout(() => {
          setPrivateSuccess(false);
        }, 2500);
      }
    } catch (error) {
      console.error('Error making experiment private:', error);
    } finally {
      setIsMakingPrivate(false);
    }
  };

  // Handle save edits
  const handleSaveEdits = async () => {
    if (!editedTitle.trim()) {
      // Title is required
      return;
    }
    
    setIsSaving(true);
    try {
      const updates = {
        title: editedTitle.trim(),
        subtitle: editedSubtitle.trim(),
        description: editedDescription.trim()
      };
      
      const success = await updateExperiment(experiment.id, updates);
      
      if (success) {
        // Update local experiment data
        experiment.title = updates.title;
        experiment.subtitle = updates.subtitle;
        experiment.description = updates.description;
        
        setSaveSuccess(true);
        setIsEditing(false);
        
        // Reset success message after 2.5 seconds
        setTimeout(() => {
          setSaveSuccess(false);
        }, 2500);
      }
    } catch (error) {
      console.error('Error saving experiment edits:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditedTitle(experiment.title);
    setEditedSubtitle(experiment.subtitle);
    setEditedDescription(experiment.description);
    setIsEditing(false);
  };

  // Render sharing UI based on state
  const renderSharingUI = () => {
    if (isLoading) {
      return (
        <View style={styles.shareButtonContainer}>
          <Text style={styles.loadingText}>Checking sharing status...</Text>
        </View>
      );
    }

    if (isShared) {
      return (
        <View style={styles.sharedContainer}>
          <Text style={styles.sharedText}>
            This experiment has been shared to the hub.
          </Text>
          <TouchableOpacity onPress={handleMakePrivate}>
            <Text style={styles.makePrivateText}>
              {isMakingPrivate ? "Making Private..." : "Make Private"}
            </Text>
          </TouchableOpacity>
          
          {privateSuccess && (
            <View style={styles.successMessage}>
              <MaterialCommunityIcons name="check-circle" size={20} color={Colors.primary} />
              <Text style={styles.successText}>Experiment is now private</Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.shareButtonContainer}>
        {shareSuccess && (
          <View style={styles.successMessage}>
            <MaterialCommunityIcons name="check-circle" size={20} color={Colors.primary} />
            <Text style={styles.successText}>Experiment shared successfully!</Text>
          </View>
        )}
        
        <CustomButton
          title={isSharing ? "Sharing..." : "Share Experiment"}
          onPress={handleShareExperiment}
          style={styles.shareButton}
          textStyle={styles.shareButtonText}
        />
      </View>
    );
  };

  return (
    <CustomModal
      visible={visible}
      contentStyle={styles.modalContent}
      overlayStyle={styles.overlay}
    >
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </Pressable>
        <Text 
          style={styles.headerTitle}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {experiment.title}
        </Text>
        
        {/* Edit button */}
        {!isEditing && (
          <Pressable onPress={() => setIsEditing(true)} style={styles.editButton}>
            <MaterialCommunityIcons name="pencil" size={24} color={Colors.primary} />
          </Pressable>
        )}
      </View>

      {/* Main content in ScrollView */}
      <ScrollView style={styles.scrollView}>
        <Image source={{ uri: experiment.imageUrl }} style={styles.image} />
        <View style={styles.dateContainer}>
          <MaterialCommunityIcons name="calendar" size={16} color={Colors.primary} />
          <Text style={styles.date}>{formatDate(experiment.date)}</Text>
        </View>
        <View style={styles.content}>
          {isEditing ? (
            <View style={styles.editContainer}>
              <Text style={styles.editLabel}>Title</Text>
              <TextInput
                style={styles.editInput}
                value={editedTitle}
                onChangeText={setEditedTitle}
                placeholder="Experiment Title"
                placeholderTextColor="#999"
              />
              
              <Text style={styles.editLabel}>Subtitle</Text>
              <TextInput
                style={styles.editInput}
                value={editedSubtitle}
                onChangeText={setEditedSubtitle}
                placeholder="Experiment Subtitle (optional)"
                placeholderTextColor="#999"
              />
              
              <Text style={styles.editLabel}>Description</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Experiment Description"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              
              <View style={styles.editButtons}>
                <CustomButton
                  title="Cancel"
                  onPress={handleCancelEdit}
                  variant="secondary"
                  style={[styles.editButtonItem, { height: 40 }]}
                  textStyle={styles.editButtonText}
                />
                <CustomButton
                  title={isSaving ? "Saving..." : "Save Edits"}
                  onPress={handleSaveEdits}
                  style={[styles.saveButton, { height: 40 }]}
                  textStyle={styles.editButtonText}
                  disabled={isSaving || !editedTitle.trim()}
                />
              </View>
              
              {saveSuccess && (
                <View style={styles.successMessage}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={Colors.primary} />
                  <Text style={styles.successText}>Changes saved successfully!</Text>
                </View>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.title}>{experiment.title}</Text>
              <Text style={styles.subtitle}>{experiment.subtitle}</Text>
              
              {/* Description Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="text-box" size={24} color="#FFFFFF" />
                  <Text style={styles.cardTitle}>Description</Text>
                </View>
                <Text style={styles.description}>{experiment.description}</Text>
              </View>
            </>
          )}

          {/* Well Plates Section Header */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="dots-grid" size={24} color={Colors.primary} />
            <Text style={styles.sectionHeaderText}>Well Plates</Text>
          </View>

          {/* Well Plates Loading State */}
          {isLoadingWellPlates ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading well plates...</Text>
            </View>
          ) : wellPlates.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No well plates found for this experiment.</Text>
            </View>
          ) : (
            /* Well Plates Cards */
            wellPlates.map((plate) => (
              <WellPlateCard
                key={plate.id}
                plate={plate}
                formatDate={formatDate}
                onDelete={handleDeletePlate}
                onPress={handleWellPlatePress}
              />
            ))
          )}
          
          {/* Sharing UI (button or "make private" option) */}
          {!isEditing && renderSharingUI()}
          
          {/* Add some bottom padding */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Add Well Plate Details Modal */}
      {selectedWellPlate && (
        <WellPlateDetailsModal
          visible={isWellPlateModalVisible}
          plate={selectedWellPlate}
          onClose={() => setIsWellPlateModalVisible(false)}
          formatDate={formatDate}
        />
      )}

      {/* Delete Confirmation Modal */}
      <CustomModal
        visible={showDeleteModal}
        contentStyle={styles.deleteModalContent}
        overlayStyle={styles.deleteModalOverlay}
      >
        <View style={styles.deleteModalBody}>
          <MaterialCommunityIcons name="alert-circle" size={40} color={Colors.error} />
          <Text style={styles.deleteModalTitle}>Delete Well Plate?</Text>
          <Text style={styles.deleteModalText}>
            Are you sure you want to delete Plate {plateToDelete?.name}? This action cannot be undone.
          </Text>
          <View style={styles.deleteModalButtons}>
            <CustomButton
              title="Cancel"
              onPress={() => setShowDeleteModal(false)}
              variant="secondary"
              style={styles.deleteModalButton}
            />
            <CustomButton
              title="Delete"
              onPress={confirmDelete}
              variant="danger"
              style={styles.deleteModalButton}
            />
          </View>
        </View>
      </CustomModal>

      {/* Add ShareModal */}
      <ShareModal
        visible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        onShareToHub={handleShareToHub}
        onShareWithUser={handleShareWithUser}
        experimentTitle={experiment.title}
      />
    </CustomModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    margin: 0,
    padding: 0,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    marginTop: 0,
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: -20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  date: {
    marginLeft: 8,
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.secondary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  description: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  infoText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'transparent',
  },
  closeButton: {
    marginHorizontal: 20,
  },
  stickyHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    flex: 1,
    marginRight: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  sectionHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginLeft: 10,
  },
  wellPlateStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
  },
  wellPlateCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  wellPlateHeader: {
    borderBottomColor: Colors.secondary,
  },
  wellPlateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginLeft: 8,
  },
  wellPlateLabel: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  wellPlateValue: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  wellProgress: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(53, 95, 46, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  descriptionItem: {
    flex: 2,
    marginLeft: 16,
  },
  deletePlateButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  deleteModalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  deleteModalContent: {
    width: '90%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
  },
  deleteModalBody: {
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shareButtonContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 10,
  },
  shareButton: {
    backgroundColor: Colors.highlight,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    width: '70%',
    maxWidth: 300,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f7e6',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  successText: {
    color: Colors.primary,
    marginLeft: 5,
  },
  sharedContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#f8f8f9',
    borderRadius: 12,
    width: '90%',
    alignSelf: 'center',
  },
  sharedText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 12,
  },
  makePrivateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.error,
    textAlign: 'center',
    padding: 8,
    textDecorationLine: 'underline',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.primary,
  },
  editButton: {
    padding: 8,
    marginLeft: 'auto',
  },
  editContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
  },
  editLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  editTextArea: {
    minHeight: 100,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 24,
  },
  editButtonItem: {
    flex: 1,
    marginHorizontal: 8,
    height: 40,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginVertical: -2,
  },
  saveButton: {
    backgroundColor: Colors.highlight,
    flex: 1,
    marginLeft: 10,
    height: 40,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
}); 