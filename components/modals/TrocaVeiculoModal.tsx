import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface TrocaVeiculoModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (dados: {
    kmAtual: string;
    placaAtual: string;
    kmNovo: string;
    placaNovo: string;
    imageUrl?: string;
  }) => void;
  image: string | null;
  onTakeImage: () => void;
  uploading: boolean;
}

export default function TrocaVeiculoModal({
  visible,
  onCancel,
  onConfirm,
  image,
  onTakeImage,
  uploading,
}: TrocaVeiculoModalProps) {
  const [kmAtual, setKmAtual] = useState('');
  const [placaAtual, setPlacaAtual] = useState('');
  const [kmNovo, setKmNovo] = useState('');
  const [placaNovo, setPlacaNovo] = useState('');

  const handleConfirm = () => {
    if (!kmAtual || !placaAtual || !kmNovo || !placaNovo) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    if (Number(kmNovo) <= Number(kmAtual)) {
      Alert.alert('Erro', 'A quilometragem do novo veículo deve ser maior que a do veículo atual.');
      return;
    }

    onConfirm({
      kmAtual,
      placaAtual,
      kmNovo,
      placaNovo,
    });
    
    // Limpar campos após confirmação
    setKmAtual('');
    setPlacaAtual('');
    setKmNovo('');
    setPlacaNovo('');
  };

  const handleCancel = () => {
    setKmAtual('');
    setPlacaAtual('');
    setKmNovo('');
    setPlacaNovo('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Troca de Veículo</Text>

          {/* Veículo Atual */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Veículo Atual</Text>
            
            <TextInput
              style={styles.input}
              placeholder="KM do veículo atual"
              placeholderTextColor="#999"
              value={kmAtual}
              onChangeText={setKmAtual}
              keyboardType="numeric"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Placa do veículo atual"
              placeholderTextColor="#999"
              value={placaAtual}
              onChangeText={setPlacaAtual}
              autoCapitalize="characters"
            />
          </View>

          {/* Novo Veículo */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Novo Veículo</Text>
            
            <TextInput
              style={styles.input}
              placeholder="KM do novo veículo"
              placeholderTextColor="#999"
              value={kmNovo}
              onChangeText={setKmNovo}
              keyboardType="numeric"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Placa do novo veículo"
              placeholderTextColor="#999"
              value={placaNovo}
              onChangeText={setPlacaNovo}
              autoCapitalize="characters"
            />
          </View>

          {/* Foto do Hodômetro */}
          <View style={styles.imageSection}>
            <Text style={styles.imageTitle}>Foto do Hodômetro (Opcional)</Text>
            
            <TouchableOpacity
              style={styles.imageButton}
              onPress={onTakeImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#007BFF" />
              ) : image ? (
                <View style={styles.imagePreview}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#28a745" />
                  <Text style={styles.imagePreviewText}>Foto capturada</Text>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <MaterialCommunityIcons name="camera" size={24} color="#007BFF" />
                  <Text style={styles.imageButtonText}>Tirar Foto</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Botões */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={handleCancel}
              disabled={uploading}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.buttonConfirm]}
              onPress={handleConfirm}
              disabled={uploading}
            >
              <Text style={styles.buttonText}>
                {uploading ? 'Processando...' : 'Confirmar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  imageSection: {
    marginBottom: 20,
  },
  imageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  imageButton: {
    borderWidth: 2,
    borderColor: '#007BFF',
    borderStyle: 'dashed',
    borderRadius: 5,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePreview: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  imagePreviewText: {
    marginLeft: 8,
    color: '#28a745',
    fontWeight: 'bold',
  },
  imageButtonText: {
    color: '#007BFF',
    marginTop: 5,
    fontWeight: 'bold',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    borderRadius: 5,
    padding: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  buttonCancel: {
    backgroundColor: '#6c757d',
  },
  buttonConfirm: {
    backgroundColor: '#007BFF',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});