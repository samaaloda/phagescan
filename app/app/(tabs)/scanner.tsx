import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker"; 
import { Colors } from "../../constants/Colors";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CustomButton } from '../../components/CustomButton';
import { getExperiments, saveWellPlate } from "../../services/firebaseService";
import { PROCESS_IMAGE_URL } from "../../constants/api";

const WellPlateGrid: React.FC<{ 
  rows: number; 
  columns: number; 
  wellData: { coordinate: string; prediction: string }[]; 
}> = ({ rows, columns, wellData }) => {
  const rowLabels = 'ABCDEFGH'.split('');
  const columnLabels = Array.from({ length: columns }, (_, i) => (i + 1).toString());

  // Create an array that maps each grid index to the well prediction if available
  const wellsMap = new Array(rows * columns).fill(null);
  wellData.forEach((well) => {
    const rowIndex = well.coordinate.charCodeAt(0) - "A".charCodeAt(0);
    const colIndex = parseInt(well.coordinate.substring(1)) - 1;
    const index = rowIndex * columns + colIndex;
    if (index >= 0 && index < wellsMap.length) {
      wellsMap[index] = well.prediction; // "Effective", "Somewhat Effective", or "Ineffective"
    }
  });

  return (
    <View style={styles.wellGridWrapper}>
      <View style={styles.columnLabelsContainer}>
        <View style={styles.rowLabelSpacer} />
        {columnLabels.map((label) => ( //mapping each column label with its designated label as needed for processing
          <View style={styles.columnLabel} key={label}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
        ))}
      </View>
      {rowLabels.slice(0, rows).map((rowLabel, rowIndex) => (
        <View key={rowLabel} style={styles.gridRow}>
          <View style={styles.rowLabel}>
            <Text style={styles.labelText}>{rowLabel}</Text>
          </View>
          <View style={styles.circlesRow}>
            {columnLabels.map((_, colIndex) => {
              const index = rowIndex * columns + colIndex;
              const prediction = wellsMap[index];
              // Start with the base circle style
              const circleStyle = [
                styles.circle,
                prediction === "Effective"
                  ? styles.effectiveWell
                  : prediction === "Somewhat Effective"
                  ? styles.somewhatEffectiveWell
                  : prediction === "Ineffective"
                  ? styles.ineffectiveWell
                  : null,
              ];

              // Append the appropriate style based on the prediction
              if (prediction === "Effective") {
                circleStyle.push(styles.effectiveWell);
              } else if (prediction === "Somewhat Effective") {
                circleStyle.push(styles.somewhatEffectiveWell);
              } else if (prediction === "Ineffective") {
                circleStyle.push(styles.ineffectiveWell);
              }
              return <View key={`${rowLabel}${colIndex + 1}`} style={circleStyle} />;
            })}
          </View>
        </View>
      ))}
    </View>
  );
};

// Fix SavePlateModal props and destructuring
type SavePlateModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (experimentId: string, name: string, description: string) => Promise<void>;
  imageUri: string | null;
  wellData: any;
};

const SavePlateModal: React.FC<SavePlateModalProps> = ({
  visible,
  onClose,
  onSave,
  imageUri,
  wellData,
}) => {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExperiment, setSelectedExperiment] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [plateName, setPlateName] = useState("");
  const [plateDescription, setPlateDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
  // If modal not visible, clear selection and bail.
  if (!visible) {
    setSelectedExperiment(null);
    return;
  }

  let cancelled = false;

  const fetchExperiments = async () => {
    setLoading(true);
    try {
      const experimentsList = await getExperiments();

      // keep experiments state in sync
      setExperiments(Array.isArray(experimentsList) ? experimentsList : []);

      // choose first if any, else null
      if (Array.isArray(experimentsList) && experimentsList.length > 0) {
        setSelectedExperiment(experimentsList[0]);
      } else {
        setSelectedExperiment(null);
      }
    } catch (error) {
      console.error("Error fetching experiments 2:", error);
      Alert.alert("Error", "Failed to load experiments.");
      setExperiments([]);
      setSelectedExperiment(null);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  fetchExperiments();
  return () => { cancelled = true; };
}, [visible]);


  const handleSave = async () => {
    if (!selectedExperiment) {
      Alert.alert("Error", "Please select an experiment.");
      return;
    }

    if (!plateName.trim()) {
      Alert.alert("Error", "Please enter a name for the well plate.");
      return;
    }

    try {
      setSaving(true);
      await onSave(selectedExperiment.id, plateName, plateDescription);
      setPlateName("");
      setPlateDescription("");
      setSelectedExperiment(experiments[0]);
      onClose();
    } catch (error) {
      console.error("Error saving well plate:", error);
      Alert.alert("Error", "Failed to save well plate.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.saveModalContent}>
          <View style={styles.saveModalHeader}>
            <Text style={styles.saveModalTitle}>Save Well Plate</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={Colors.darkGrey} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
          ) : (
            <ScrollView contentContainerStyle={styles.saveModalBody}>
              <Text style={styles.inputLabel}>Well Plate Name</Text>
              <TextInput
                style={styles.textInput}
                value={plateName}
                onChangeText={setPlateName}
                placeholder="Enter well plate name"
              />

              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                value={plateDescription}
                onChangeText={setPlateDescription}
                placeholder="Enter description"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Select Experiment</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowDropdown(!showDropdown)}
              >
                <Text style={styles.dropdownButtonText}>
                  {selectedExperiment ? selectedExperiment.title : "Select an experiment"}
                </Text>
                <MaterialCommunityIcons
                  name={showDropdown ? "chevron-up" : "chevron-down"}
                  size={24}
                  color={Colors.darkGrey}
                />
              </TouchableOpacity>

              {showDropdown && (
                <View style={styles.dropdownList}>
                  {experiments.map((experiment) => (
                    <TouchableOpacity
                      key={experiment.id}
                      style={[
                        styles.dropdownItem,
                        selectedExperiment?.id === experiment.id && styles.selectedDropdownItem,
                      ]}
                      onPress={() => {
                        setSelectedExperiment(experiment);
                        setShowDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedExperiment?.id === experiment.id && styles.selectedDropdownItemText,
                        ]}
                      >
                        {experiment.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.saveButtonContainer}>
                <CustomButton
                  title={saving ? "Saving..." : "Save Well Plate"}
                  onPress={handleSave}
                  style={styles.saveConfirmButton}
                  textStyle={styles.saveConfirmButtonText}
                  disabled={saving}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

type ResultsModalProps = {
  visible: boolean;
  onClose: () => void;
  wellData: { coordinate: string; prediction: string }[];
  imageUri: string | null;
};

const ResultsModal: React.FC<ResultsModalProps> = ({ visible, onClose, wellData, imageUri }) => {
  const [saveModalVisible, setSaveModalVisible] = useState(false);

  const effectiveCount = wellData.filter(well => well.prediction === "Effective").length;
  const somewhatEffectiveCount = wellData.filter(well => well.prediction === "Somewhat Effective").length;
  const ineffectiveCount = wellData.filter(well => well.prediction === "Ineffective").length;

  const handleSavePlate = async (experimentId: string, name: string, description: string) => {
    try {
      const wellPlateId = await saveWellPlate(experimentId, name, description, imageUri ?? "", wellData);
      if (wellPlateId) {
        Alert.alert("Success", "Well plate saved successfully!");
        setSaveModalVisible(false);
        setTimeout(() => onClose(), 500);
        return;
      } else {
        throw new Error("Failed to save well plate");
      }
    } catch (error) {
      console.error("Error saving well plate:", error);
      Alert.alert("Error", "Failed to save well plate. Please try again.");
      throw error;
    }
  };

  if (!wellData || wellData.length === 0) return null;
  
  return (
    <Modal 
      visible={visible} 
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalHeaderBackButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Analysis Results</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
          {imageUri && (
            <View style={styles.resultsSection}>
              <View style={styles.wellImageContainer}>
                <Image source={{ uri: imageUri }} style={styles.wellPlateImage} />
              </View>
            </View>
          )}
          
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Well Plate Overview</Text>
            <View style={styles.wellGridContainer}>
              <WellPlateGrid rows={8} columns={12} wellData={wellData} />
              
              {/* Update Legend to include all three types */}
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendCircle, styles.legendEffectiveCircle]} />
                  <Text style={styles.legendText}>Effective</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendCircle, styles.legendSomewhatEffectiveCircle]} />
                  <Text style={styles.legendText}>Mid Effective</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendCircle, styles.legendIneffectiveCircle]} />
                  <Text style={styles.legendText}>Ineffective</Text>
                </View>
              </View>
              
              {/* Save Plate Button */}
              <CustomButton
                title="Save Plate"
                onPress={() => setSaveModalVisible(true)}
                style={styles.savePlateButton}
                textStyle={styles.savePlateButtonText}
                icon={<MaterialCommunityIcons name="content-save" size={24} color="white" />}
              />
            </View>
          </View>
          
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Well Details</Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{effectiveCount}</Text>
                <Text style={styles.statLabel}>Effective</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{somewhatEffectiveCount}</Text>
                <Text style={styles.statLabel}>Mid Effective</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{ineffectiveCount}</Text>
                <Text style={styles.statLabel}>Ineffective</Text>
              </View>
            </View>
            
            <View style={styles.classificationContainer}>
              <Text style={styles.subsectionTitle}>Classification Results:</Text>
              <View style={styles.statusColumns}>
                <View style={styles.statusColumn}>
                  {wellData
                    .sort((a, b) => {
                      const rowA = a.coordinate[0];
                      const rowB = b.coordinate[0];
                      const colA = parseInt(a.coordinate.substring(1));
                      const colB = parseInt(b.coordinate.substring(1));
                      return rowA.localeCompare(rowB) || colA - colB;
                    })
                    .slice(0, Math.ceil(wellData.length / 2))
                    .map((well, index) => (
                      <Text key={index} style={styles.statusText}>
                        <Text style={styles.coordinateText}>{well.coordinate}</Text>:{" "}
                        <Text style={
                          well.prediction === "Effective" ? styles.effectiveText :
                          well.prediction === "Somewhat Effective" ? styles.somewhatEffectiveText : 
                          well.prediction === "Ineffective" ? styles.ineffectiveText :
                          styles.ineffectiveText
                        }>
                          {well.prediction === "Somewhat Effective" ? "Mid Effective" : well.prediction}
                        </Text>
                      </Text>
                    ))}
                </View>
                <View style={styles.statusColumn}>
                  {wellData
                    .sort((a, b) => {
                      const rowA = a.coordinate[0];
                      const rowB = b.coordinate[0];
                      const colA = parseInt(a.coordinate.substring(1));
                      const colB = parseInt(b.coordinate.substring(1));
                      return rowA.localeCompare(rowB) || colA - colB;
                    })
                    .slice(Math.ceil(wellData.length / 2))
                    .map((well, index) => (
                      <Text key={index} style={styles.statusText}>
                        <Text style={styles.coordinateText}>{well.coordinate}</Text>:{" "}
                        <Text style={
                          well.prediction === "Effective" ? styles.effectiveText :
                          well.prediction === "Somewhat Effective" ? styles.somewhatEffectiveText : 
                          well.prediction === "Ineffective" ? styles.ineffectiveText :
                          styles.ineffectiveText
                        }>
                          {well.prediction === "Somewhat Effective" ? "Mid Effective" : well.prediction}
                        </Text>
                      </Text>
                    ))}
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.buttonContainer}>
            <CustomButton
              title="Return to Scanner"
              onPress={onClose}
              style={styles.returnButton}
              textStyle={styles.buttonText}
            />
          </View>
        </ScrollView>
        
        <SavePlateModal
          visible={saveModalVisible}
          onClose={() => setSaveModalVisible(false)}
          onSave={handleSavePlate}
          imageUri={imageUri}
          wellData={wellData}
        />
      </SafeAreaView>
    </Modal>
  );
};

const ImageUploadScreen = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [classificationResults, setClassificationResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [showBackButton, setShowBackButton] = useState(false);
  const [isUpload, setIsUpload] = useState<boolean | null>(null);
  const [wellData, setWellData] = useState<{ coordinate: string; prediction: string }[]>([]);
  
  const [resultsModalVisible, setResultsModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setHasCameraPermission(status === "granted");
    })();
  }, []);

  type Result = {
  Predicted: string;
  r: number;
  x: number;
  y: number;
  row?: number;
  column?: number;
};

const ROW_LETTERS = "ABCDEFGH";
const MAX_ROWS = 8;
const MAX_COLS = 12;

// Map API results onto a standard 96-well plate (A1–H12 only)
const resultToWellData = (results: Result[]) => {
  const withGridCoords = results.filter(
    (item) =>
      typeof item.row === "number" &&
      typeof item.column === "number" &&
      item.row >= 1 &&
      item.row <= MAX_ROWS &&
      item.column >= 1 &&
      item.column <= MAX_COLS
  );

  const mapped =
    withGridCoords.length > 0
      ? withGridCoords.map((item) => {
          const rowLetter = ROW_LETTERS[item.row! - 1];
          const colNumber = item.column!;
          return {
            coordinate: `${rowLetter}${colNumber}`,
            prediction: item.Predicted,
          };
        })
      : (() => {
          // Fallback for older API responses without row/column
          const sorted = results.slice().sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
          });

          return sorted.slice(0, MAX_ROWS * MAX_COLS).flatMap((item, index) => {
            const rowIndex = Math.floor(index / MAX_COLS);
            if (rowIndex >= MAX_ROWS) return [];
            const rowLetter = ROW_LETTERS[rowIndex];
            const colNumber = (index % MAX_COLS) + 1;
            return [
              {
                coordinate: `${rowLetter}${colNumber}`,
                prediction: item.Predicted,
              },
            ];
          });
        })();

  return mapped.sort((a, b) => {
    const rowA = a.coordinate.charCodeAt(0);
    const rowB = b.coordinate.charCodeAt(0);
    if (rowA !== rowB) return rowA - rowB;
    return parseInt(a.coordinate.substring(1), 10) - parseInt(b.coordinate.substring(1), 10);
  });
};



  const captureImage = async () => {
    if (hasCameraPermission === false) {
      Alert.alert("Permission Denied", "Please enable camera access in settings.");
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSelectedImage(result.assets[0].uri);
      setBase64Image(result.assets[0].base64);
      setIsUpload(false);
    } else {
      Alert.alert("Error", "Failed to capture image.");
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSelectedImage(result.assets[0].uri);
      setBase64Image(result.assets[0].base64);
      setIsUpload(true);
    } else {
      Alert.alert("Error", "Failed to process image.");
    }
  };

  const classifyImage = async (modelType: string) => {
  if (!selectedImage) {
    Alert.alert("No Image Selected", "Please upload or capture an image first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", {
    uri: selectedImage,
    type: "image/jpeg",
    name: "plate.jpg",
  } as any);
  formData.append("model_type", modelType);

  setLoading(true);

  try {
    const response = await fetch(PROCESS_IMAGE_URL, {
      method: "POST",
      body: formData,
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Server error ${response.status}`);
    }

    const result = await response.json();
    console.log("Result:", result);
    setClassificationResults(result.results);
    setWellData(resultToWellData(result.results));
    setResultsModalVisible(true);
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message} (API: ${PROCESS_IMAGE_URL})`
        : "Unexpected error";
    Alert.alert("Error", message);
  } finally {
    setLoading(false);
  }
};


  const resetScreen = () => {
    setSelectedImage(null);
    setBase64Image(null);
    setClassificationResults([]);
    setWellData([]);
    setResultsModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Phage Scanner</Text>
          <Text style={styles.subtitle}>Analyze well plates for phage activity</Text>
        </View>

        <View style={styles.imageContainer}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.preview} />
          ) : (
            <View style={styles.placeholderContainer}>
              <MaterialCommunityIcons name="camera-outline" size={64} color={Colors.primary} />
              <Text style={styles.placeholderText}>No image selected</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          
        {selectedImage && !resultsModalVisible && (
            <CustomButton
              title="Analyze Image (Binary)"
              onPress={() => classifyImage("binary")}
              style={[styles.actionButton, styles.highlightButton]}
              textStyle={styles.buttonText}
            />
          )}

          {selectedImage && !resultsModalVisible && (
            <CustomButton
              title="Analyze Image (Multi-Class)"
              onPress={() => classifyImage("rule")}
              style={[styles.actionButton, styles.highlightButton]}
              textStyle={styles.buttonText}
            />
          )}

          <CustomButton
            title="Take Photo"
            onPress={captureImage}
            style={[styles.actionButton, styles.primaryButton]}
            textStyle={styles.buttonText}
          />
          
          <CustomButton
            title="Choose from Library"
            onPress={pickImage}
            variant="secondary"
            style={styles.actionButton}
            textStyle={styles.secondaryButtonText}
          />
          
          
        </View>

        {loading && (
          <Modal transparent={true} animationType="fade" visible={loading}>
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FFB570" />
              <Text style={styles.loadingText}>Processing Image...</Text>
            </View>
          </Modal>
        )}
        
        <ResultsModal 
          visible={resultsModalVisible} 
          onClose={() => setResultsModalVisible(false)}
          wellData={wellData}
          imageUri={selectedImage}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const circleSize = 22;
const circleMargin = 1.5;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  preview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  buttonContainer: {
    width: '100%',
    marginVertical: 24,
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  highlightButton: {
    backgroundColor: Colors.highlight,
    shadowOpacity: 0.3,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultsContainer: {
    alignItems: "center",
    width: "100%",
  },
  resultsHeader: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
  },
  gridContainer: {
    alignItems: "center",
  },
  columnLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingLeft: 20,
  },
  corner: {
    width: circleSize - 4,
    height: circleSize,
    marginRight: circleMargin + 4,
  },
  columnLabel: {
    width: circleSize,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: circleMargin,
  },
  rowLabel: {
    width: circleSize - 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: circleMargin,
  },
  labelText: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.primary,
  },
  circle: {
    width: circleSize,
    height: circleSize,
    borderRadius: circleSize / 2,
    marginHorizontal: circleMargin,
  },
  effectiveWell: {
    backgroundColor: "#2ECC71",
    shadowColor: "#2ECC71",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  ineffectiveWell: {
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  loadingText: {
    color: "#FFF",
    fontSize: 16,
    marginTop: 10,
  },
  backButton: {
    backgroundColor: "#FF7070",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 20,
    marginTop: 10,
  },
  statusList: {
    marginTop: 16,
    width: "90%",
    padding: 12,
  },
  statusHeader: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.primary,
    marginBottom: 8,
  },
  statusColumns: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusColumn: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    color: Colors.darkGrey,
    marginBottom: 4,
  },
  coordinateText: {
    fontWeight: "bold",
    color: Colors.primary,
  },
  effectiveText: {
    color: '#2ECC71', // Green
    fontWeight: 'bold',
  },
  somewhatEffectiveText: {
    color: '#FFC107', // Yellow
    fontWeight: 'bold',
  },
  ineffectiveText: {
    color: Colors.error, // Red
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  modalHeaderBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.primary,
    marginLeft: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.darkGrey,
    textAlign: 'center',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  resultsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.darkGrey,
    marginBottom: 12,
    marginTop: 16,
  },
  wellGridContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
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
  classificationContainer: {
    marginTop: 8,
  },
  returnButton: {
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    width: '100%',
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
    width: 20, // Width for the row label column
  },
  columnLabelsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 8, // Adjust as needed to align with the last circle
    paddingLeft: 8, // Adjust as needed to align with the first circle
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
    marginBottom: 3, //circleMargin * 2
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
    paddingRight: 8, // Match with columnLabelsRow
    paddingLeft: 8, // Match with columnLabelsRow\
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
  legendEffectiveCircle: {
    backgroundColor: "#2ECC71",
    borderColor: "#2ECC71",
  },
  legendSomewhatEffectiveCircle: {
    backgroundColor: "#FFC107",
    borderColor: "#FFC107",
  },
  legendIneffectiveCircle: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  legendText: {
    fontSize: 14,
    color: Colors.darkGrey,
  },
  savePlateButton: {
    backgroundColor: Colors.highlight,
    marginTop: 20,
    paddingHorizontal: 24,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  savePlateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveModalContent: {
    backgroundColor: 'white',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  saveModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  saveModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  saveModalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.darkGrey,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textAreaInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: Colors.darkGrey,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    backgroundColor: 'white',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedDropdownItem: {
    backgroundColor: '#f0f7ff',
  },
  dropdownItemText: {
    fontSize: 16,
    color: Colors.darkGrey,
  },
  selectedDropdownItemText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  saveButtonContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  saveConfirmButton: {
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: 12,
  },
  saveConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    padding: 24,
  },
  closeButton: {
    padding: 8,
  },
  somewhatEffectiveWell: {
    backgroundColor: '#FFC107', // Yellow
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
});

export default ImageUploadScreen;