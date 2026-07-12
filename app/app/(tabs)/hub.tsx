import { StyleSheet, View, Text, ScrollView, ActivityIndicator, RefreshControl, Animated, Dimensions, TouchableOpacity, PanResponder } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Colors } from '../../constants/Colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getSharedExperiments, getExperimentsSharedWithMe } from '../../services/firebaseService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../lib/firebaseConfig';
import { SharedExperimentCard } from '../../components/SharedExperimentCard';
import { HubExperimentDetailModal } from '../../components/HubExperimentDetailModal';

interface SharedExperiment {
  id: string;
  experimentId: string;
  experimentTitle: string;
  experimentSubtitle: string;
  experimentDescription: string;
  experimentImageUrl: string;
  userFirstName: string;
  userLastName: string;
  userName: string;
  dateShared: string;
}

const { width } = Dimensions.get('window');

export default function HubScreen() {
  const [sharedExperiments, setSharedExperiments] = useState<SharedExperiment[]>([]);
  const [personalSharedExperiments, setPersonalSharedExperiments] = useState<SharedExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<SharedExperiment | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 for Shared, 1 for Community
  const slideAnim = useRef(new Animated.Value(0)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
        return Math.abs(dx) > Math.abs(dy);
      },
      onPanResponderMove: (_, { dx }) => {
        if ((activeTab === 0 && dx < 0) || (activeTab === 1 && dx > 0)) {
          slideAnim.setValue(dx);
        }
      },
      onPanResponderRelease: (_, { dx }) => {
        if (Math.abs(dx) > width * 0.2) {
          if (dx > 0 && activeTab === 1) {
            switchTab(0);
          } else if (dx < 0 && activeTab === 0) {
            switchTab(1);
          } else {
            resetPosition();
          }
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const switchTab = (index: number) => {
    setActiveTab(index);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(tabIndicatorAnim, {
        toValue: index,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const resetPosition = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const getTabStyle = (index: number) => ({
    color: activeTab === index ? Colors.primary : Colors.darkGrey,
    fontWeight: activeTab === index ? '700' as const : '600' as const,
    transform: [{ 
      scale: activeTab === index ? 1.05 : 1 
    }],
  });

  // Set up real-time listener for shared experiments
  useEffect(() => {
    setLoading(true);
    
    // Create queries for both collections
    const sharedWellPlatesCollection = collection(db, 'sharedWellPlates');
    const publicQuery = query(
      sharedWellPlatesCollection,
      where('isPublic', '==', true),
      orderBy('dateShared', 'desc')
    );
    
    // Set up the real-time listeners
    const unsubscribePublic = onSnapshot(publicQuery, async () => {
      try {
        const experiments = await getSharedExperiments();
        setSharedExperiments(experiments);
      } catch (error) {
        console.error('Error fetching public experiments:', error);
      }
    });

    const unsubscribePersonal = onSnapshot(sharedWellPlatesCollection, async () => {
      try {
        const personalExperiments = await getExperimentsSharedWithMe();
        setPersonalSharedExperiments(personalExperiments);
      } catch (error) {
        console.error('Error fetching personal shared experiments:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    });
    
    // Clean up the listeners when component unmounts
    return () => {
      unsubscribePublic();
      unsubscribePersonal();
    };
  }, []);

  // Manual refresh function
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The real-time listener will handle the refresh
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleExperimentPress = (experiment: SharedExperiment) => {
    /*const formattedExperiment = {
      id: experiment.experimentId,
      title: experiment.experimentTitle,
      subtitle: experiment.experimentSubtitle || '',
      description: experiment.experimentDescription,
      imageUrl: experiment.experimentImageUrl,
      date: experiment.dateShared,
      userName: `${experiment.userFirstName} ${experiment.userLastName}`.trim(),
    };*/
    
    setSelectedExperiment(experiment);
    setIsDetailModalVisible(true);
  };

  const handleModalClose = () => {
    setIsDetailModalVisible(false);
    setSelectedExperiment(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Headers */}
      <View style={styles.tabHeaderContainer}>
        <View style={styles.tabHeader}>
          <TouchableOpacity 
            style={styles.tabButton} 
            onPress={() => switchTab(0)}
          >
            <Text style={[styles.tabText, getTabStyle(0)]}>
              Shared with me
            </Text>
            <Text style={[styles.tabSubtext, { color: activeTab === 0 ? Colors.primary : Colors.darkGrey }]}>
              Personal experiments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.tabButton} 
            onPress={() => switchTab(1)}
          >
            <Text style={[styles.tabText, getTabStyle(1)]}>
              Community Hub
            </Text>
            <Text style={[styles.tabSubtext, { color: activeTab === 1 ? Colors.primary : Colors.darkGrey }]}>
              Discover & explore
            </Text>
          </TouchableOpacity>
          <Animated.View 
            style={[
              styles.tabIndicator,
              {
                transform: [{
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, width / 2],
                  }),
                }],
              },
            ]} 
          />
        </View>
      </View>

      {/* Content */}
      <Animated.View 
        style={[
          styles.contentContainer,
          {
            transform: [{
              translateX: Animated.add(
                slideAnim,
                tabIndicatorAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -width],
                })
              ),
            }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Shared with me tab */}
        <View style={styles.tabContent}>
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading shared experiments...</Text>
            </View>
          ) : personalSharedExperiments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons 
                name="share-variant" 
                size={64} 
                color={Colors.primary} 
              />
              <Text style={styles.emptyText}>No experiments shared with you</Text>
              <Text style={styles.emptySubtext}>
                Experiments shared directly with you will appear here
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[Colors.primary]}
                  tintColor={Colors.primary}
                />
              }
            >
              {personalSharedExperiments.map((experiment) => (
                <SharedExperimentCard
                  key={experiment.id}
                  experiment={experiment}
                  formatDate={formatDate}
                  onPress={() => handleExperimentPress(experiment)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Community Hub tab */}
        <View style={styles.tabContent}>
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading shared experiments...</Text>
            </View>
          ) : sharedExperiments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons 
                name="flask-empty-outline" 
                size={64} 
                color={Colors.primary} 
              />
              <Text style={styles.emptyText}>No shared experiments found</Text>
              <Text style={styles.emptySubtext}>
                Experiments shared by users will appear here
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[Colors.primary]}
                  tintColor={Colors.primary}
                />
              }
            >
              {sharedExperiments.map((experiment) => (
                <SharedExperimentCard
                  key={experiment.id}
                  experiment={experiment}
                  formatDate={formatDate}
                  onPress={() => handleExperimentPress(experiment)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </Animated.View>

      {selectedExperiment && (
        <HubExperimentDetailModal
          visible={isDetailModalVisible}
          experiment={{
          id: selectedExperiment.experimentId,
          title: selectedExperiment.experimentTitle,
          subtitle: selectedExperiment.experimentSubtitle,
          description: selectedExperiment.experimentDescription,
          imageUrl: selectedExperiment.experimentImageUrl,
          date: selectedExperiment.dateShared,
          userName: selectedExperiment.userName,
      }}
          onClose={handleModalClose}
          formatDate={formatDate}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 0,
    marginTop: -45,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginBottom: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: '80%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: -30,
    marginBottom: -30,
  },
  tabHeaderContainer: {
    backgroundColor: '#fff',
    paddingTop: 4,
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    marginTop: -20,
  },
  tabHeader: {
    flexDirection: 'row',
    position: 'relative',
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabText: {
    fontSize: 18,
    marginBottom: 4,
    fontWeight: '600',
  },
  tabSubtext: {
    fontSize: 12,
    opacity: 0.8,
    fontWeight: '500',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: width / 2,
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    width: width * 2,
    marginTop: -1,
  },
  tabContent: {
    width: width,
    flex: 1,
  },
}); 