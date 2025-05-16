import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import styles from '../../assets/styles/stylesIndex';

interface KmModalProps {
  visible: boolean;
  type: 'inicio' | 'fim' | null;
  kmValue: string;
  onKmChange: (text: string) => void;
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
          <ActivityIndicator size="large" color="#0000ff" />
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

export default KmModal;