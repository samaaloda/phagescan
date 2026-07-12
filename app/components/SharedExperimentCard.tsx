import React from 'react';
import { StyleSheet, View, Text, Image, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface SharedExperimentProps {
  experiment: {
    id: string;
    experimentId: string;
    experimentTitle: string;
    experimentSubtitle?: string;
    experimentDescription: string;
    experimentImageUrl: string;
    userFirstName: string;
    userLastName: string;
    dateShared: string;
  };
  onPress?: () => void;
  formatDate: (dateString: string) => string;
}

export function SharedExperimentCard({ experiment, onPress, formatDate }: SharedExperimentProps) {
  return (
    <Pressable 
      key={experiment.id} 
      style={styles.card}
      onPress={onPress}
    >
      <Image 
        source={{ uri: experiment.experimentImageUrl }} 
        style={styles.cardImage} 
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{experiment.experimentTitle}</Text>
        {experiment.experimentSubtitle ? (
          <Text style={styles.cardSubtitle}>{experiment.experimentSubtitle}</Text>
        ) : null}
        <Text 
          style={styles.cardDescription}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {experiment.experimentDescription}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.userInfo}>
            <MaterialCommunityIcons name="account" size={16} color={Colors.primary} />
            <Text style={styles.userName}>
              {experiment.userFirstName} {experiment.userLastName}
            </Text>
          </View>
          <View style={styles.dateInfo}>
            <MaterialCommunityIcons name="calendar" size={16} color={Colors.primary} />
            <Text style={styles.dateText}>{formatDate(experiment.dateShared)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#444',
    marginBottom: 16,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
}); 