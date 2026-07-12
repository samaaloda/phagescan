import { Modal, View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

interface CustomModalProps {
  visible: boolean;
  transparent?: boolean;
  animationType?: "none" | "slide" | "fade";
  onRequestClose?: () => void;
  children: React.ReactNode;
  overlayStyle?: object;
  contentStyle?: object;
}

export function CustomModal({
  visible,
  transparent = true,
  animationType = "fade",
  onRequestClose,
  children,
  overlayStyle,
  contentStyle,
}: CustomModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onRequestClose}
    >
      <View style={[styles.modalOverlay, overlayStyle]}>
        <View style={[styles.modalContent, contentStyle]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
}); 