import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface PanicModalProps {
  visible: boolean;
  siteCode: string;
  onSiteCodeChange: (text: string) => void;
  uf: string;
  onUfChange: (value: string) => void;
  image: string | null;
  onTakeImage: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  uploading: boolean;
  comment: string;
  onCommentChange: (text: string) => void;
}

const PanicModal: React.FC<PanicModalProps> = ({
  visible,
  siteCode,
  onSiteCodeChange,
  uf,
  onUfChange,
  image,
  onTakeImage,
  onCancel,
  onConfirm,
  uploading,
  comment,
  onCommentChange,
}) => {
  if (!visible) return null;

  // Função para aplicar máscara na sigla (3 caracteres maiúsculos, letras e números)
  const handleSiteCodeChange = (text: string) => {
    // Remove caracteres especiais, mantém apenas letras e números
    let cleaned = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // Limita a 3 caracteres
    if (cleaned.length > 3) {
      cleaned = cleaned.substring(0, 3);
    }

    onSiteCodeChange(cleaned);
  };

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Registrar Incidência</Text>

        <TextInput
          style={styles.modalInput}
          placeholder="Sigla (ex: SP1) - Máx. 3 caracteres"
          placeholderTextColor="#999"
          value={siteCode}
          onChangeText={handleSiteCodeChange}
          editable={!uploading}
          maxLength={3}
          autoCapitalize="characters"
        />

        <View style={styles.pickerContainerUF}>
          <Picker
            selectedValue={uf}
            onValueChange={onUfChange}
            style={styles.ufPicker}
            enabled={!uploading}
          >
            <Picker.Item label="UF" value="" color="#999" />
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

        <TextInput
          style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
          placeholder="Adicionar Comentário..."
          placeholderTextColor="#999"
          value={comment}
          onChangeText={onCommentChange}
          editable={!uploading}
          multiline={true}
          numberOfLines={4}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
  pickerContainerUF: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 10,
  },
  ufPicker: {
    height: 50,
    width: '100%',
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
    backgroundColor: '#dc3545',
  },
  modalButtonConfirm: {
    backgroundColor: '#28a745',
  },
  modalButtonText: {
    color: '#fff',
    textAlign: 'center',
  },
});

export default PanicModal;