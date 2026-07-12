import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  Image,
  ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { WellPlate } from './WellPlateCard';
import { getWellPlateDetails } from '../services/firebaseService';

// Define the circle dimensions from scanner.tsx for consistency
const circleSize = 18;
const circleMargin = 4;

interface WellData {
  row: string;
  column: number;
  prediction: string;
  coordinate?: string; // Added for compatibility with existing code
  isEffective?: boolean; // Added for compatibility with existing code
}

interface WellPlateDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  formatDate?: (date: string) => string;
  plate?: WellPlate;
  wellPlateId?: string;
}

const WellPlateDetailsModal = ({ visible, onClose, formatDate, plate, wellPlateId }: WellPlateDetailsModalProps) => {
  const [loading, setLoading] = useState(true);
  const [wellPlateData, setWellPlateData] = useState<any>(null);
  const [wellsData, setWellsData] = useState<WellData[]>([]);

  useEffect(() => {
    if (visible) {
      if (wellPlateId) {
        fetchWellPlateData(wellPlateId);
      } else if (plate) {
        fetchWellPlateData(plate.id);
      }
    }
  }, [visible, wellPlateId, plate]);

  const fetchWellPlateData = async (id: string) => {
    try {
      setLoading(true);
      const data = await getWellPlateDetails(id);
      
      setWellPlateData(data);
      setWellsData(data.wells);
    } catch (error) {
      console.error('Error fetching well plate data:', error);
    } finally {
      setLoading(false);
    }
  };

  // WellPlateGrid component from scanner.tsx, slightly modified
  const WellPlateGrid = () => {
    const rows = 8;
    const columns = 12;
    const rowLabels = 'ABCDEFGH'.split('');
    const columnLabels = Array.from({ length: columns }, (_, i) => (i + 1).toString());

    // Create a map of coordinates to predictions
    const wellsMap = new Map<string, string>();
    wellsData.forEach(well => {
      wellsMap.set(well.coordinate || `${well.row}${well.column}`, well.prediction);
    });

    return (
      <View style={styles.wellGridWrapper}>
        {/* Column labels */}
        <View style={styles.columnLabelsContainer}>
          <View style={styles.rowLabelSpacer} />
          <View style={styles.columnLabelsRow}>
            {columnLabels.map((label, index) => (
              <Text key={index} style={styles.columnLabelText}>{label}</Text>
            ))}
          </View>
        </View>

        {/* Grid with row labels */}
        {rowLabels.map((rowLabel, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            <Text style={styles.rowLabelText}>{rowLabel}</Text>
            <View style={styles.circlesRow}>
              {columnLabels.map((colLabel, colIndex) => {
                const coordinate = `${rowLabel}${colLabel}`;
                const prediction = wellsMap.get(coordinate);
                
                return (
                  <View 
                    key={coordinate} 
                    style={[
                      styles.circle,
                      prediction === "Effective" ? styles.effectiveWell :
                      prediction === "Somewhat Effective" ? styles.somewhatEffectiveWell :
                      styles.ineffectiveWell
                    ]} 
                  />
                );
              })}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const getWellCounts = () => {
    const effective = wellsData.filter(well => well.prediction === "Effective").length;
    const somewhatEffective = wellsData.filter(well => well.prediction === "Somewhat Effective").length;
    const ineffective = wellsData.filter(well => well.prediction === "Ineffective").length;
    return { effective, somewhatEffective, ineffective };
  };

  return (
    <Modal 
      visible={visible} 
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Well Plate Details</Text>
          <View style={{ width: 40 }} />
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading well plate data...</Text>
          </View>
        ) : (
          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
            {wellPlateData && (
              <>
                <Text style={styles.plateName}>{wellPlateData.name}</Text>
                {wellPlateData.description && (
                  <Text style={styles.plateDescription}>{wellPlateData.description}</Text>
                )}
                
                {wellPlateData.imageURL && (
                  <View style={styles.resultsSection}>
                    <View style={styles.wellImageContainer}>
                      <Image source={{ uri: wellPlateData.imageURL }} style={styles.wellPlateImage} />
                    </View>
                  </View>
                )}
                
                <View style={styles.resultsSection}>
                  <Text style={styles.sectionTitle}>Well Plate Overview</Text>
                  <View style={styles.wellGridContainer}>
                    <WellPlateGrid />
                    
                    {/* Legend */}
                    <View style={styles.legendContainer}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendCircle, styles.effectiveWell]} />
                        <Text style={styles.legendText}>Effective</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendCircle, styles.somewhatEffectiveWell]} />
                        <Text style={styles.legendText}>Mid Effective</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendCircle, styles.ineffectiveWell]} />
                        <Text style={styles.legendText}>Not Effective</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.resultsSection}>
                  <Text style={styles.sectionTitle}>Statistics</Text>
                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {getWellCounts().effective}
                      </Text>
                      <Text style={styles.statLabel}>Effective</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {getWellCounts().somewhatEffective}
                      </Text>
                      <Text style={styles.statLabel}>Mid Effective</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {getWellCounts().ineffective}
                      </Text>
                      <Text style={styles.statLabel}>Not Effective</Text>
                    </View>
                  </View>
                </View>
                
                {wellsData.length > 0 && (
                  <View style={styles.resultsSection}>
                    <Text style={styles.sectionTitle}>Well Status</Text>
                    <View style={styles.statusColumns}>
                      <View style={styles.statusColumn}>
                        {wellsData
                          .slice(0, Math.ceil(wellsData.length / 2))
                          .map((well, index) => (
                            <Text key={index} style={styles.statusText}>
                              <Text style={styles.coordinateText}>{well.coordinate || `${well.row}${well.column}`}</Text>:
                              {" "}
                              <Text style={
                                well.prediction === "Effective" ? styles.effectiveText :
                                well.prediction === "Somewhat Effective" ? styles.somewhatEffectiveText :
                                styles.ineffectiveText
                              }>
                                {well.prediction === "Somewhat Effective" ? "Mid Effective" : well.prediction}
                              </Text>
                            </Text>
                          ))}
                      </View>
                      <View style={styles.statusColumn}>
                        {wellsData
                          .slice(Math.ceil(wellsData.length / 2))
                          .map((well, index) => (
                            <Text key={index} style={styles.statusText}>
                              <Text style={styles.coordinateText}>{well.coordinate || `${well.row}${well.column}`}</Text>:
                              {" "}
                              <Text style={
                                well.prediction === "Effective" ? styles.effectiveText :
                                well.prediction === "Somewhat Effective" ? styles.somewhatEffectiveText :
                                styles.ineffectiveText
                              }>
                                {well.prediction === "Somewhat Effective" ? "Mid Effective" : well.prediction}
                              </Text>
                            </Text>
                          ))}
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 4,
    color: Colors.primary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  plateName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  plateDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.darkGrey,
  },
  resultsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 16,
  },
  wellImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  wellPlateImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  wellGridContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  wellGridWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  columnLabelsContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 4,
  },
  rowLabelSpacer: {
    width: 20,
  },
  columnLabelsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 8,
    paddingLeft: 8,
  },
  columnLabelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
    width: circleSize,
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: circleMargin * 2,
    width: '100%',
  },
  rowLabelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
    width: 20,
    textAlign: 'center',
  },
  circlesRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 8,
    paddingLeft: 8,
  },
  circle: {
    width: circleSize,
    height: circleSize,
    borderRadius: circleSize / 2,
    margin: circleMargin,
  },
  effectiveWell: {
    backgroundColor: "#2ECC71",
  },
  somewhatEffectiveWell: {
    backgroundColor: '#FFC107',
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  ineffectiveWell: {
    backgroundColor: Colors.accent,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  legendText: {
    fontSize: 14,
    color: Colors.darkGrey,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.darkGrey,
    marginTop: 4,
  },
  statusColumns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusColumn: {
    flex: 1,
    paddingHorizontal: 8,
  },
  statusText: {
    fontSize: 14,
    marginBottom: 4,
  },
  coordinateText: {
    fontWeight: 'bold',
    color: Colors.darkGrey,
  },
  effectiveText: {
    color: '#2ECC71',
    fontWeight: 'bold',
  },
  somewhatEffectiveText: {
    color: '#FFC107',
    fontWeight: 'bold',
  },
  ineffectiveText: {
    color: Colors.accent,
    fontWeight: 'bold',
  },
});

export default WellPlateDetailsModal; 