import { View, StyleSheet, Alert, TextInput, TouchableOpacity, Text, Image, Modal, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { doc, setDoc, updateDoc, collection, addDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { otherDb, storage } from '@/services/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRonda } from './_layout';

interface Checkpoint {
  site: string;
  motivo: string;
  timestamp: string;
  imageUrl?: string;
}

export default function HomeScreen() {
  const { isTracking, setIsTracking } = useRonda();
  const [location, setLocation] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [rondaId, setRondaId] = useState<string | null>(null);
  const [siteCode, setSiteCode] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('Ronda em site');
  const [user, setUser] = useState<string | null>('');
  const [uid, setUid] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kmInicial, setKmInicial] = useState<string>('');
  const [kmFinal, setKmFinal] = useState<string>('');
  const [showKmModal, setShowKmModal] = useState<'inicio' | 'fim' | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [rondaDetails, setRondaDetails] = useState<any>(null);

  useEffect(() => {
    userData();
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para enviar fotos.');
      }
    })();
  }, []);

  const loadCheckpoints = async (rondaId: string) => {
    try {
      const checkpointsRef = collection(otherDb, 'rondas', rondaId, 'checkpoints');
      const snapshot = await getDocs(checkpointsRef);
      const loadedCheckpoints = snapshot.docs.map(doc => doc.data() as Checkpoint);
      setCheckpoints(loadedCheckpoints);
    } catch (error) {
      console.error('Erro ao carregar checkpoints:', error);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImage = async () => {
    if (!image) return null;
    
    setUploading(true);
    try {
      const response = await fetch(image);
      const blob = await response.blob();
      const storageRef = ref(storage, `checkpoints/${rondaId}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error) {
      console.error('Erro no upload:', error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const userData = async () => {
    let nome = await AsyncStorage.getItem('userName');
    let userUid = await AsyncStorage.getItem('userUid');
    setUser(nome);
    setUid(userUid);
  };

  const startTracking = async () => {
    setShowKmModal('inicio');
  };

  const confirmStartTracking = async () => {
    if (!kmInicial) {
      Alert.alert('Erro', 'Por favor, informe a quilometragem inicial.');
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'É necessário acesso à localização.');
      return;
    }

    if (!uid) {
      Alert.alert('Erro', 'UID do usuário não encontrado.');
      return;
    }

    const novaRondaId = `ronda_${new Date().getTime()}`;
    const rondaRef = doc(otherDb, 'rondas', novaRondaId);
    const userRef = doc(otherDb, 'usuarios', uid);
    
    const rondaData = {
      nomeRonda: `Ronda_${new Date().toLocaleString()}`,
      inicio: new Date().toISOString(),
      kmInicial: parseFloat(kmInicial),
      ultimaLocalizacao: null,
      uid: uid,
      timestamp: new Date().toISOString(),
    };
    
    await setDoc(rondaRef, rondaData);
    
    setRondaId(novaRondaId);
    setRondaDetails(rondaData);
    setIsTracking(true);
    setShowKmModal(null);
    setCheckpoints([]);

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 0,
      },
      async (loc) => {
        setLocation(loc);
        try {
          await updateDoc(rondaRef, {
            ultimaLocalizacao: {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              timestamp: new Date().toISOString(),
            },
          });

          await updateDoc(userRef, {
            status_ronda: "Em Ronda",
            ultimaLocalizacao: {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              timestamp: new Date().toISOString(),
            },
          });
        } catch (error) {
          console.error('Erro ao atualizar localização:', error);
        }
      }
    );

    setSubscription(sub);
  };

  const stopTracking = async () => {
    setShowKmModal('fim');
  };

  const confirmStopTracking = async () => {
    if (!kmFinal) {
      Alert.alert('Erro', 'Por favor, informe a quilometragem final.');
      return;
    }

    if (subscription) {
      subscription.remove();
      setSubscription(null);
      setIsTracking(false);

      if (rondaId && uid) {
        try {
          const rondaRef = doc(otherDb, 'rondas', rondaId);
          const userRef = doc(otherDb, 'usuarios', uid);

          const distanciaPercorrida = parseFloat(kmFinal) - parseFloat(kmInicial);
          
          await Promise.all([
            updateDoc(rondaRef, {
              fim: new Date().toISOString(),
              kmFinal: parseFloat(kmFinal),
              distanciaPercorrida,
            }),
            updateDoc(userRef, {
              status_ronda: "Parado"
            })
          ]);

          // Atualiza os detalhes locais
          setRondaDetails(prev => ({
            ...prev,
            fim: new Date().toISOString(),
            kmFinal: parseFloat(kmFinal),
            distanciaPercorrida
          }));
        } catch (error) {
          console.error('Erro ao atualizar documentos:', error);
          Alert.alert('Erro', 'Não foi possível atualizar o status da ronda.');
        }
      }

      // Limpa os estados após um pequeno delay para mostrar os dados finais
      setTimeout(() => {
        setRondaId(null);
        setRondaDetails(null);
        setKmInicial('');
        setKmFinal('');
        setShowKmModal(null);
        setCheckpoints([]);
      }, 3000);
    }
  };

  const handleCheckpoint = async () => {
    if (!rondaId || !location || !siteCode.trim()) {
      Alert.alert('Erro', 'Informe a sigla do site e certifique-se de que o GPS está ativo.');
      return;
    }

    try {
      let imageUrl = null;
      if (motivo === 'ronda_em_site' && image) {
        imageUrl = await uploadImage();
      }

      const checkpointData = {
        site: siteCode.toUpperCase(),
        motivo,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        ...(imageUrl && { imageUrl }),
      };

      const checkpointsRef = collection(otherDb, 'rondas', rondaId, 'checkpoints');
      await addDoc(checkpointsRef, checkpointData);

      // Atualiza a lista local de checkpoints
      setCheckpoints(prev => [...prev, checkpointData]);

      Alert.alert('Checkpoint adicionado', `Site ${siteCode.toUpperCase()} salvo com sucesso.`);
      setSiteCode('');
      setMotivo('Ronda em site');
      setImage(null);
    } catch (error) {
      console.error('Erro ao adicionar checkpoint:', error);
      Alert.alert('Erro', 'Não foi possível salvar o checkpoint.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.welcomeText}>Bem-vindo(a) {user}.</Text>

      <TouchableOpacity
        style={[
          styles.button,
          isTracking ? styles.buttonStop : styles.buttonStart,
        ]}
        onPress={isTracking ? stopTracking : startTracking}
      >
        <Text style={styles.buttonText}>
          {isTracking ? 'Parar Ronda' : 'Iniciar Ronda'}
        </Text>
      </TouchableOpacity>

      {/* Modal para KM Inicial/Final */}
      <Modal
        visible={showKmModal !== null}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {showKmModal === 'inicio' ? 'Quilometragem Inicial' : 'Quilometragem Final'}
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder={`Digite o KM ${showKmModal === 'inicio' ? 'inicial' : 'final'}`}
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={showKmModal === 'inicio' ? kmInicial : kmFinal}
              onChangeText={showKmModal === 'inicio' ? setKmInicial : setKmFinal}
            />
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowKmModal(null)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={showKmModal === 'inicio' ? confirmStartTracking : confirmStopTracking}
              >
                <Text style={styles.modalButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detalhes da Ronda - Mostra apenas quando a ronda está ativa */}
      {isTracking && rondaDetails && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Detalhes da Ronda</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Início:</Text>
            <Text style={styles.detailValue}>
              {new Date(rondaDetails.inicio).toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>KM Inicial:</Text>
            <Text style={styles.detailValue}>{rondaDetails.kmInicial}</Text>
          </View>

          {rondaDetails.fim && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fim:</Text>
                <Text style={styles.detailValue}>
                  {new Date(rondaDetails.fim).toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>KM Final:</Text>
                <Text style={styles.detailValue}>{rondaDetails.kmFinal}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Distância Percorrida:</Text>
                <Text style={styles.detailValue}>
                  {rondaDetails.distanciaPercorrida} km
                </Text>
              </View>
            </>
          )}

          {checkpoints.length > 0 && (
            <View style={styles.checkpointsContainer}>
              <Text style={styles.checkpointsTitle}>Checkpoints ({checkpoints.length})</Text>
              {checkpoints.map((cp, index) => (
                <View key={index} style={styles.checkpointItem}>
                  <Text style={styles.checkpointSite}>{cp.site}</Text>
                  <Text style={styles.checkpointMotivo}>{cp.motivo}</Text>
                  <Text style={styles.checkpointTime}>
                    {new Date(cp.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Formulário de Checkpoint - Mostra apenas quando a ronda está ativa */}
      {isTracking && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Sigla do site (ex: SP001)"
            placeholderTextColor="#999"
            value={siteCode}
            onChangeText={setSiteCode}
          />

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={motivo}
              onValueChange={(itemValue) => {
                setMotivo(itemValue);
                if (itemValue !== 'ronda_em_site') setImage(null);
              }}
              dropdownIconColor="#fff"
              style={styles.picker}
            >
              <Picker.Item label="Selecione o motivo" value="" color="#999" />
              <Picker.Item label="Ronda em site" value="ronda_em_site" color="#000" />
              <Picker.Item label="Abastecimento" value="abastecimento" color="#000" />
              <Picker.Item label="Troca de veículo" value="troca_de_veiculo" color="#000" />
              <Picker.Item label="Outros" value="outros" color="#000" />
            </Picker>
          </View>

          {motivo === 'ronda_em_site' && (
            <>
              <TouchableOpacity 
                style={styles.imageButton}
                onPress={pickImage}
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
            </>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              !siteCode ? styles.buttonDisabled : styles.buttonCheckpoint
            ]}
            onPress={handleCheckpoint}
            disabled={!siteCode}
          >
            <Text style={styles.buttonText}>Registrar Checkpoint</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 16,
    alignItems: 'center',
    backgroundColor: '#2a003f',
  },
  welcomeText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 16,
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: '#3a005c',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bb86fc',
  },
  detailsTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#bb86fc',
    fontWeight: 'bold',
  },
  detailValue: {
    fontSize: 14,
    color: '#ffffff',
  },
  checkpointsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#bb86fc',
    paddingTop: 12,
  },
  checkpointsTitle: {
    fontSize: 14,
    color: '#bb86fc',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  checkpointItem: {
    backgroundColor: '#4a006c',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  checkpointSite: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  checkpointMotivo: {
    fontSize: 12,
    color: '#bbbbbb',
  },
  checkpointTime: {
    fontSize: 12,
    color: '#bb86fc',
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#bb86fc',
    borderRadius: 8,
    padding: 10,
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#3a005c',
    color: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerContainer: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#3a005c',
    borderColor: '#bb86fc',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  picker: {
    color: '#fff',
    backgroundColor: '#3a005c',
    height: 50,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    width: '100%',
    maxWidth: 300,
  },
  buttonStart: {
    backgroundColor: '#03dac5',
  },
  buttonStop: {
    backgroundColor: '#cf6679',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonCheckpoint: {
    backgroundColor: '#6200ee',
  },
  buttonDisabled: {
    backgroundColor: '#555',
  },
  imageButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3700B3',
    marginVertical: 10,
    width: '100%',
    maxWidth: 300,
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#bb86fc',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#2a003f',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  modalInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#bb86fc',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#3a005c',
    color: '#ffffff',
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    padding: 10,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#cf6679',
  },
  modalButtonConfirm: {
    backgroundColor: '#03dac5',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});