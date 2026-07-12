import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Pressable, SafeAreaView, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { CustomModal } from './CustomModal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WellPlateCard } from './WellPlateCard';
import WellPlateDetailsModal from './WellPlateDetailsModal';
import { getWellPlatesForExperiment } from '../services/firebaseService';

interface HubExperimentDetailModalProps {
  visible: boolean;
  experiment: {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    imageUrl: string;
    date: string;
    userName: string;
  };
  onClose: () => void;
  formatDate: (date: string) => string;
}

interface WellPlate {
  id: string;
  name: string;
  description: string;
  date: string;
  status: string;
  wells: number;
  positiveWells: number;
}

export function HubExperimentDetailModal({
  visible,
  experiment,
  onClose,
  formatDate,
}: HubExperimentDetailModalProps) {
  const [wellPlates, setWellPlates] = useState<WellPlate[]>([]);
  const [selectedWellPlate, setSelectedWellPlate] = useState<WellPlate | null>(null);
  const [isWellPlateModalVisible, setIsWellPlateModalVisible] = useState(false);
  const [isLoadingWellPlates, setIsLoadingWellPlates] = useState(false);

  // Fetch well plates when the modal becomes visible
  useEffect(() => {
    if (visible && experiment.id) {
      fetchWellPlates();
    }
  }, [visible, experiment.id]);

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

  const handleWellPlatePress = (plate: WellPlate) => {
    setSelectedWellPlate(plate);
    setIsWellPlateModalVisible(true);
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
        <View style={{ width: 40 }}>
          <Text> </Text>
        </View>
      </View>

      {/* Main content in ScrollView */}
      <ScrollView style={styles.scrollView}>
        <Image source={{ uri: experiment.imageUrl }} style={styles.image} />
        <View style={styles.dateContainer}>
          <MaterialCommunityIcons name="calendar" size={16} color={Colors.primary} />
          <Text style={styles.date}>{formatDate(experiment.date)}</Text>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title}>{experiment.title}</Text>
          {experiment.subtitle && (
            <Text style={styles.subtitle}>{experiment.subtitle}</Text>
          )}
          
          {/* User Info Card */}
          <View style={styles.userInfoCard}>
            <MaterialCommunityIcons name="account" size={20} color="#FFFFFF" />
            <Text style={styles.userInfoText}>Shared by {experiment.userName}</Text>
          </View>
          
          {/* Description Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="text-box" size={24} color="#FFFFFF" />
              <Text style={styles.cardTitle}>Description</Text>
            </View>
            <Text style={styles.description}>{experiment.description}</Text>
          </View>

          {/* Well Plates Section */}
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
            wellPlates.map((plate) => (
              <WellPlateCard
                key={plate.id}
                plate={plate}
                formatDate={formatDate}
                onPress={() => handleWellPlatePress(plate)}
                onDelete={() => {}}
                hideDelete={true}
              />
            ))
          )}
          
          {/* Add some bottom padding */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Well Plate Details Modal */}
      {selectedWellPlate && (
        <WellPlateDetailsModal
          visible={isWellPlateModalVisible}
          plate={selectedWellPlate}
          onClose={() => setIsWellPlateModalVisible(false)}
          formatDate={formatDate}
        />
      )}
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
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  content: {
    padding: 20,
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
  stickyHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.primary,
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginLeft: 10,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: Colors.primary,
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
  userInfoCard: {
    backgroundColor: Colors.highlight,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
}); 