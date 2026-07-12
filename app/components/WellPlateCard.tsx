import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useRef } from 'react';

export interface WellPlate {
  id: string;
  name: string;
  status: string;
  date: string;
  wells: number;
  positiveWells: number;
  description: string;
}

interface WellPlateCardProps {
  plate: WellPlate;
  formatDate: (date: string) => string;
  onDelete: (plate: WellPlate) => void;
  onPress: (plate: WellPlate) => void;
  hideDelete?: boolean;
}

export function getProgressColor(effectiveWells: number) {
  if (effectiveWells >= 45) return '#2ECC71'; // Brighter green
  if (effectiveWells >= 10) return '#FFC107'; // Yellow
  return Colors.error; // Red
}

export function WellPlateCard({ 
  plate, 
  formatDate, 
  onDelete,
  onPress,
  hideDelete = false,
}: WellPlateCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable 
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => onPress(plate)}
    >
      <Animated.View 
        style={[
          styles.card,
          styles.wellPlateCard,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        {!hideDelete && (
          <Pressable 
            style={styles.deletePlateButton}
            onPress={() => onDelete(plate)}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.error} />
          </Pressable>
        )}

        <View style={[styles.cardHeader, styles.wellPlateHeader]}>
          <MaterialCommunityIcons name="dots-circle" size={24} color={Colors.primary} />
          <Text style={styles.wellPlateTitle}>{plate.name}</Text>
        </View>
        
        <View style={styles.wellPlateStats}>
          <View style={styles.statItem}>
            <Text style={styles.wellPlateLabel}>Date</Text>
            <Text style={styles.wellPlateValue}>{formatDate(plate.date)}</Text>
          </View>
          <View style={[styles.statItem, styles.descriptionItem]}>
            <Text style={styles.wellPlateValue}>
              {plate.description}
            </Text>
          </View>
        </View>

        <View style={styles.wellProgress}>
          <Text style={styles.wellPlateLabel}>
            Effective Wells: {plate.positiveWells}/{plate.wells}
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${(plate.positiveWells / plate.wells) * 100}%`,
                  backgroundColor: getProgressColor(plate.positiveWells)
                }
              ]} 
            />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  wellPlateCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
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
  wellPlateStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
  },
  descriptionItem: {
    flex: 2,
    marginLeft: 16,
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
}); 