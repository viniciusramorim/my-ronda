import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { otherDb } from '@/services/firebaseConfig';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';


type UsuarioFirestore = {
  regional?: string;
  ufsPermitidas?: string[];
};

type RegionalCodigo = 'SP' | 'SU' | 'NE' | 'CO_N' | 'SE';

interface Props {
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
}

const normalizeRegional = (regional?: string): RegionalCodigo | null => {
  if (!regional) return null;
  const r = regional.trim().toUpperCase();


  if (r === 'SP') return 'SP';
  if (r === 'SU') return 'SU';
  if (r === 'NE') return 'NE';
  if (r === 'SE') return 'SE';
  if (r === 'CO_N') return 'CO_N';

  return null;
};

const getUfsByRegional = (regional: RegionalCodigo): string[] => {
  switch (regional) {
    case 'SP':
      return ['SP'];

    case 'SU':
      return ['PR', 'SC', 'RS'];

    case 'SE':
      return ['RJ', 'MG', 'ES'];

    case 'NE':
      return ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'];

    case 'CO_N':
      return [
        'DF', 'GO', 'MT', 'MS',
        'AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO',
      ];

    default:
      return [];
  }
};

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
  ///modoRota,
}) => {


  const [userRegional, setUserRegional] = useState<RegionalCodigo | null>(null);
  const [ufsPermitidas, setUfsPermitidas] = useState<string[]>([]);


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
  //const mostrarBotaoAutoDetect = modoRota === 'livre' && location && onAutoDetect;

  /* ===== BUSCA DO USUÁRIO (REGIONAL + UFs) ===== */
  useEffect(() => {
    if (!visible) return;
    const buscarUsuario = async () => {
      const uid = await AsyncStorage.getItem('userUid');
      if (!uid) return;

      const snap = await getDoc(doc(otherDb, 'usuarios', uid));
      if (!snap.exists()) return;

      const data = snap.data() as UsuarioFirestore;

      const regionalNormalizada =
        normalizeRegional(data.regional);

      setUserRegional(regionalNormalizada);

      if (data.ufsPermitidas && data.ufsPermitidas.length > 0) {
        setUfsPermitidas(data.ufsPermitidas);
      } else if (regionalNormalizada) {
        setUfsPermitidas(
          getUfsByRegional(regionalNormalizada)
        );
      }
    };

    buscarUsuario();
  }, [visible]);

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.modalTitle}>Registrar Ronda</Text>

          {/* Botão de detecção automática - apenas no modo livre */}

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


          {/*<Text style={styles.sectionLabel}>Sigla do Site</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Digite a sigla (ex: SP1) - Máx. 3 letras"
            placeholderTextColor="#999"
            value={siteCode}
            onChangeText={handleSiglaChange}
            editable={!uploading}
            maxLength={3}
            autoCapitalize="characters"
          />*/}

          {/*<Text style={styles.sectionLabel}>UF</Text>
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
          </View>*/}


          <Text style={styles.label}>UF</Text>
          <View style={styles.ufContainer}>
            <Picker selectedValue={uf} onValueChange={onUfChange}>
              <Picker.Item label="Selecione" value="" />
              {ufsPermitidas.map(u => (
                <Picker.Item key={u} label={u} value={u} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>Sigla</Text>

          {/* ✅ COMPONENTE DE BUSCA FUNCIONANDO */}
          <TextInput
            style={styles.modalInput}
            placeholder="Digite a sigla"
            placeholderTextColor="#999"
            value={siteCode}
            onChangeText={handleSiglaChange}
            editable={!uploading}
            autoCapitalize="characters"
          />



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
              onPress={() => onConfirm()}
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


  listaLocais: {
    marginBottom: 15,
  },
  localItem: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  localSigla: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
  },
  localNome: {
    fontSize: 13,
    color: '#666',
  },
  selectInput: {
    height: 45,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  selectText: {
    fontSize: 16,
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#999',
  },

  buscarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007BFF',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  buscarButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  selectTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },


  autocompleteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
  },

  autocompleteInput: {
    flex: 1,
    height: 45,
    fontSize: 16,
    color: '#333',
  },

  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },

  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  dropdownTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },

  dropdownSubtitle: {
    fontSize: 13,
    color: '#666',
  },

  siglaSucesso: {
    marginTop: 6,
    color: '#28a745',
    fontSize: 14,
    fontWeight: '600',
  },
  autoBtn: {
    backgroundColor: '#28a745',
    padding: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  ufContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 5,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },

  autoText: { color: '#fff', marginLeft: 6 },
  label: { marginTop: 10, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 5 },

  option: { padding: 10, borderBottomWidth: 1 },
  ok: { color: '#28a745', marginTop: 6 },
  error: { color: '#007BFF', marginTop: 6 },


});

export default CheckpointModal;