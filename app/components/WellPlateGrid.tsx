import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

interface WellPlateGridProps {
  rows: number;
  columns: number;
  wellData: { coordinate: string; prediction: string }[];
}

const getWellCoordinate = (rowIndex: number, colIndex: number, rowLabels: string[]): string => {
  return `${rowLabels[rowIndex]}${colIndex + 1}`;
};

export const WellPlateGrid: React.FC<WellPlateGridProps> = ({ rows, columns, wellData }) => {
  const rowLabels = 'ABCDEFGH'.split('');
  const columnLabels = Array.from({ length: columns }, (_, i) => (i + 1).toString());

  // Create a map of coordinates to predictions
  const wellsMap = new Map<string, string>();
  wellData.forEach(well => {
    wellsMap.set(well.coordinate, well.prediction);
  });

  return (
    <View style={styles.wrapper}>
      <Text style={styles.header}>Classifications</Text>
      <View style={styles.outerContainer}>
        <View style={styles.gridContainer}>
          {/* Top row: empty top-left corner plus column labels */}
          <View style={styles.columnLabelRow}>
            <View style={styles.corner} />
            {columnLabels.map((label, index) => (
              <View key={`col-label-${index}`} style={styles.columnLabel}>
                <Text style={styles.labelText}>{label}</Text>
              </View>
            ))}
          </View>
          {/* Grid rows: row label on left plus circles */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.gridRow}>
              <View style={styles.rowLabel}>
                <Text style={styles.labelText}>{rowLabels[rowIndex]}</Text>
              </View>
              {Array.from({ length: columns }).map((_, colIndex) => {
                const coordinate = getWellCoordinate(rowIndex, colIndex, rowLabels);
                const prediction = wellsMap.get(coordinate) || 'Not Effective';

                return (
                  <View 
                    key={`circle-${rowIndex}-${colIndex}`} 
                    style={[
                      styles.circle,
                      prediction === 'Effective' ? styles.effectiveWell :
                      prediction === 'Mid Effective' ? styles.somewhatEffectiveWell :
                      styles.ineffectiveWell
                    ]} 
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
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
  );
};

const circleSize = 22;
const circleMargin = 1.5;

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 20,
  },
  header: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 12,
  },
  outerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  gridContainer: {
    alignSelf: 'flex-start',
  },
  columnLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: circleMargin,
  },
  corner: {
    width: circleSize,
    height: circleSize,
    marginRight: circleMargin,
  },
  columnLabel: {
    width: circleSize,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: circleMargin,
  },
  rowLabel: {
    width: circleSize - 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: circleMargin,
  },
  labelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: circleMargin,
  },
  circle: {
    width: circleSize,
    height: circleSize,
    borderRadius: circleSize / 2,
    marginHorizontal: circleMargin,
  },
  effectiveWell: {
    backgroundColor: '#2ECC71',
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
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
    backgroundColor: Colors.error,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendCircle: {
    width: circleSize,
    height: circleSize,
    borderRadius: circleSize / 2,
  },
  legendText: {
    fontSize: 14,
    color: Colors.primary,
  },
  statusList: {
    marginTop: 16,
    width: '100%',
    padding: 12,
  },
  statusHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  statusColumns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusColumn: {
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    color: Colors.darkGrey,
    marginBottom: 4,
  },
  coordinateText: {
    fontWeight: 'bold',
    color: Colors.primary,
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
    color: Colors.error,
    fontWeight: 'bold',
  },
}); 

export default WellPlateGrid;