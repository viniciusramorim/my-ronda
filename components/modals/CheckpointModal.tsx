import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, StyleSheet, ScrollView, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CheckpointModalProps {
  visible: boolean;
  siteCode: string;
  onSiteCodeChange: (text: string) => void;
  uf: string;
  onUfChange: (value: string) => void;
  comment: string;
  onCommentChange: (text: string) => void;
  image: string | null;
  onTakeImage: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  uploading: boolean;
  // Novas props para detecção automática
  onAutoDetect?: () => void;
  location?: any;
  modoRota?: 'livre' | 'predefinida' | null;
}

const CheckpointModal: React.FC<CheckpointModalProps> = ({
  visible,
  siteCode,
  onSiteCodeChange,
  uf,
  onUfChange,
  comment,
  onCommentChange,
  image,
  onTakeImage,
  onCancel,
  onConfirm,
  uploading,
  onAutoDetect,
  location,
  modoRota,
}) => {
  // Função para aplicar a máscara da sigla (3 caracteres maiúsculos)
  const handleSiglaChange = (text: string) => {
    // Remove caracteres especiais, mantém apenas letras e números
    let cleaned = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Limita a 3 caracteres
    if (cleaned.length > 3) {
      cleaned = cleaned.substring(0, 3);
    }
    
    onSiteCodeChange(cleaned);
  };

  // Função para lidar com a detecção automática
  const handleAutoDetect = () => {
    if (!location) {
      Alert.alert('GPS Indisponível', 'Sua localização não está disponível. Verifique o GPS.');
      return;
    }

    if (onAutoDetect) {
      onAutoDetect();
    }
  };

  // Verificar se pode mostrar o botão de detecção automática
  const mostrarBotaoAutoDetect = modoRota === 'livre' && location && onAutoDetect;

  if (!visible) return null;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.modalTitle}>Registrar Ronda</Text>

          {/* Botão de detecção automática - apenas no modo livre */}
          {mostrarBotaoAutoDetect && (
            <TouchableOpacity
              style={styles.autoDetectButton}
              onPress={handleAutoDetect}
              disabled={uploading}
            >
              <MaterialCommunityIcons name="radar" size={20} color="#fff" />
              <Text style={styles.autoDetectButtonText}>
                Buscar Site Mais Próximo
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionLabel}>Sigla do Site</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Digite a sigla (ex: SP1) - Máx. 3 letras"
            placeholderTextColor="#999"
            value={siteCode}
            onChangeText={handleSiglaChange}
            editable={!uploading}
            maxLength={3}
            autoCapitalize="characters"
          />

          <Text style={styles.sectionLabel}>UF</Text>
          <View style={styles.pickerContainerUF}>
            <Picker
              selectedValue={uf}
              onValueChange={onUfChange}
              style={styles.ufPicker}
              enabled={!uploading}
            >
              <Picker.Item label="Selecione a UF" value="" color="#999" />
              <Picker.Item label="AC" value="AC" />
              <Picker.Item label="AL" value="AL" />
              <Picker.Item label="AP" value="AP" />
              <Picker.Item label="AM" value="AM" />
              <Picker.Item label="BA" value="BA" />
              <Picker.Item label="CE" value="CE" />
              <Picker.Item label="DF" value="DF" />
              <Picker.Item label="ES" value="ES" />
              <Picker.Item label="GO" value="GO" />
              <Picker.Item label="MA" value="MA" />
              <Picker.Item label="MT" value="MT" />
              <Picker.Item label="MS" value="MS" />
              <Picker.Item label="MG" value="MG" />
              <Picker.Item label="PA" value="PA" />
              <Picker.Item label="PB" value="PB" />
              <Picker.Item label="PR" value="PR" />
              <Picker.Item label="PE" value="PE" />
              <Picker.Item label="PI" value="PI" />
              <Picker.Item label="RJ" value="RJ" />
              <Picker.Item label="RN" value="RN" />
              <Picker.Item label="RS" value="RS" />
              <Picker.Item label="RO" value="RO" />
              <Picker.Item label="RR" value="RR" />
              <Picker.Item label="SC" value="SC" />
              <Picker.Item label="SP" value="SP" />
              <Picker.Item label="SE" value="SE" />
              <Picker.Item label="TO" value="TO" />
            </Picker>
          </View>

          <Text style={styles.sectionLabel}>Comentário</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Digite um comentário (opcional)"
            placeholderTextColor="#999"
            value={comment}
            onChangeText={onCommentChange}
            editable={!uploading}
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />

          <Text style={styles.sectionLabel}>Imagem</Text>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={onTakeImage}
            disabled={uploading}
          >
            <MaterialCommunityIcons 
              name={image ? "camera" : "camera-plus"} 
              size={20} 
              color="#fff" 
            />
            <Text style={styles.buttonText}>
              {image ? 'Alterar Imagem' : 'Adicionar Imagem'}
            </Text>
          </TouchableOpacity>

          {image && (
            <View style={styles.imageContainer}>
              <Text style={styles.imageLabel}>Pré-visualização:</Text>
              <Image
                source={{ uri: image }}
                style={styles.imagePreview}
              />
            </View>
          )}

          {uploading && (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color="#007BFF" />
              <Text style={styles.uploadingText}>Enviando imagem...</Text>
            </View>
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
              style={[
                styles.modalButton, 
                styles.modalButtonConfirm,
                (!siteCode || !uf) && styles.buttonDisabled
              ]}
              onPress={onConfirm}
              disabled={uploading || !siteCode || !uf}
            >
              <Text style={styles.modalButtonText}>
                {uploading ? 'Enviando...' : 'Confirmar'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Informação sobre campos obrigatórios */}
          <Text style={styles.requiredInfo}>
            * Campos obrigatórios: Sigla e UF
          </Text>
        </ScrollView>
      </View>
    </View>
  );
};

// Estilos do componente atualizados
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  scrollContent: {
    flexGrow: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  modalInput: {
    height: 45,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
  },
  commentInput: {
    height: 100,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    textAlignVertical: 'top',
    backgroundColor: '#f9f9f9',
    fontSize: 16,
  },
  pickerContainerUF: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    overflow: 'hidden',
  },
  ufPicker: {
    height: 50,
  },
  autoDetectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  autoDetectButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007BFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  imageContainer: {
    marginBottom: 15,
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  uploadingContainer: {
    alignItems: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  uploadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 5,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalButtonCancel: {
    backgroundColor: '#dc3545',
  },
  modalButtonConfirm: {
    backgroundColor: '#28a745',
  },
  buttonDisabled: {
    backgroundColor: '#6c757d',
    opacity: 0.6,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requiredInfo: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

export default CheckpointModal;