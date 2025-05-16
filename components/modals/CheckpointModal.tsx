import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import styles from '../../assets/styles/stylesIndex';

interface CheckpointModalProps {
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
}

const CheckpointModal: React.FC<CheckpointModalProps> = ({
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
}) => {
  if (!visible) return null;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Registrar Checkpoint</Text>

        <TextInput
          style={styles.modalInput}
          placeholder="Sigla (ex: SP1)"
          placeholderTextColor="#999"
          value={siteCode}
          onChangeText={onSiteCodeChange}
          editable={!uploading}
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

export default CheckpointModal;