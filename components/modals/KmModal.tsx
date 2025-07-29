import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';

interface KmModalProps {
  visible: boolean;
  type: 'inicio' | 'fim' | null;
  kmValue: string;
  onKmChange: (text: string) => void;
  placaValue: string;
  onPlacaChange: (text: string) => void;
  image: string | null;
  onTakeImage: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  uploading: boolean;
}

const KmModal: React.FC<KmModalProps> = ({
  visible,
  type,
  kmValue,
  onKmChange,
  placaValue,
  onPlacaChange,
  image,
  onTakeImage,
  onCancel,
  onConfirm,
  uploading,
}) => {
  if (!visible || !type) return null;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>
          {type === 'inicio' ? 'Quilometragem Inicial' : 'Quilometragem Final'}
        </Text>

        <TextInput
          style={styles.modalInput}
          placeholder={`Digite o KM ${type === 'inicio' ? 'inicial' : 'final'}`}
          placeholderTextColor="#999"
          keyboardType="numeric"
          value={kmValue}
          onChangeText={onKmChange}
          editable={!uploading}
        />

        <TextInput
          style={styles.modalInput}
          placeholder="Placa do Veículo"
          placeholderTextColor="#999"
          value={placaValue}
          onChangeText={onPlacaChange}
          editable={!uploading}
        />

        <TouchableOpacity
          style={styles.imageButton}
          onPress={onTakeImage}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>
            {image ? 'Alterar Imagem' : 'Adicionar Imagem'}
          </Text>
        </TouchableOpacity>

        {image && (
          <Image
            source={{ uri: image }}
            style={styles.imagePreview}
          />
        )}

        {uploading && (
          <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 10 }} />
        )}

        <View style={styles.modalButtonContainer}>
          <TouchableOpacity
            style={[styles.modalButton, styles.modalButtonCancel]}
            onPress={onCancel}
            disabled={uploading}
          >
            <Text style={styles.modalButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modalButton, styles.modalButtonConfirm]}
            onPress={onConfirm}
            disabled={uploading}
          >
            <Text style={styles.modalButtonText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Estilos do componente
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fundo semi-transparente
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  imageButton: {
    backgroundColor: '#007BFF',
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 5,
    marginBottom: 10,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
    padding: 10,
    borderRadius: 5,
  },
  modalButtonCancel: {
    backgroundColor: '#dc3545', // Cor de fundo para cancelar
  },
  modalButtonConfirm: {
    backgroundColor: '#28a745', // Cor de fundo para confirmar
  },
  modalButtonText: {
    color: '#fff',
    textAlign: 'center',
  },
});

export default KmModal;