import { View, Alert, TextInput, TouchableOpacity, Text, Image, Modal, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { useEffect, useState } from 'react';
import { doc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { otherDb, storage } from '@/services/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRonda } from './_layout';
import styles from '../../assets/styles/stylesIndex';

const LOCATION_TASK_NAME = 'background-location-task';
const BACKGROUND_FETCH_TASK = 'background-fetch-task';

interface Checkpoint {
  site: string;
  motivo: string;
  timestamp: string;
  imageUrl?: string;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Erro na tarefa de localização em segundo plano:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    const location = locations[0];
    if (location) {
      console.log('Localização em segundo plano:', location);
      const rondaId = await AsyncStorage.getItem('rondaId');
      const uid = await AsyncStorage.getItem('userUid');
      if (rondaId && uid) {
        const rondaRef = doc(otherDb, 'rondas', rondaId);
        const userRef = doc(otherDb, 'usuarios', uid);
        await updateDoc(rondaRef, {
          ultimaLocalizacao: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date().toISOString(),
          },
        });
        await updateDoc(userRef, {
          status_ronda: "Em Ronda",
          ultimaLocalizacao: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  }
});

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const now = Date.now();
  console.log(`Background fetch executado em: ${new Date(now).toISOString()}`);
  return BackgroundFetch.Result.NewData;
});

async function registerBackgroundFetch() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Background fetch registrado!');
  } catch (err) {
    console.log('Erro ao registrar background fetch:', err);
  }
}

// Função para verificar e solicitar permissões
async function checkAndRequestPermissions() {
  // Verifica permissões de câmera
  const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
  if (cameraStatus.status !== 'granted') {
    Alert.alert('Permissão necessária', 'Precisamos de acesso à sua câmera para tirar fotos.');
  }

  // Verifica permissões de localização
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    Alert.alert('Permissão necessária', 'Precisamos de acesso à sua localização.');
    return false;
  }

  // Verifica permissões de background no Android
  if (Platform.OS === 'android') {
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      Alert.alert(
        'Permissão necessária',
        'Para rastreamento contínuo, precisamos de acesso à sua localização em segundo plano.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configurações', onPress: () => Location.openSettings() }
        ]
      );
      return false;
    }
  }

  return true;
}

// Função para verificar otimizações de bateria no Android
async function checkBatteryOptimizations() {
  if (Platform.OS === 'android') {
    const batteryOptimizationEnabled = await Location.hasServicesEnabledAsync();
    if (!batteryOptimizationEnabled) {
      Alert.alert(
        "Modo de Economia Ativo",
        "Para o rastreamento funcionar corretamente, desative as otimizações de bateria para este app nas configurações do dispositivo.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Abrir Configurações", onPress: () => Location.openSettings() }
        ]
      );
      return false;
    }
  }
  return true;
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
  const [uf, setUf] = useState<string>('');

  useEffect(() => {
    registerBackgroundFetch();
    userData();
    checkAndRequestPermissions();
    (async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à sua câmera para tirar fotos.');
      }
    })();
  }, []);

  const takeImage = async () => {
    let result = await ImagePicker.launchCameraAsync({
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
    // Verifica permissões antes de iniciar
    const permissionsGranted = await checkAndRequestPermissions();
    if (!permissionsGranted) return;

    // Verifica otimizações de bateria no Android
    const batteryOk = await checkBatteryOptimizations();
    if (!batteryOk) return;

    setShowKmModal('inicio');
  };

  const confirmStartTracking = async () => {
    if (!kmInicial) {
      Alert.alert('Erro', 'Por favor, informe a quilometragem inicial.');
      return;
    }

    if (!uid) {
      Alert.alert('Erro', 'UID do usuário não encontrado.');
      return;
    }

    try {
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

      await AsyncStorage.setItem('rondaId', novaRondaId);

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

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 0,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Rastreamento de Localização',
          notificationBody: 'Seu aplicativo está rastreando sua localização.',
          notificationColor: '#0000ff',
        },
      });

    } catch (error) {
      console.error('Erro ao iniciar rastreamento:', error);
      Alert.alert('Erro', 'Não foi possível iniciar o rastreamento.');
    }
  };

  const stopTracking = async () => {
    setShowKmModal('fim');
  };

  const confirmStopTracking = async () => {
    if (!kmFinal) {
      Alert.alert('Erro', 'Por favor, informe a quilometragem final.');
      return;
    }

    if (parseFloat(kmFinal) <= parseFloat(kmInicial)) {
      Alert.alert('Erro', 'A quilometragem final não pode ser menor que a quilometragem inicial.');
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

      setTimeout(() => {
        setRondaId(null);
        setRondaDetails(null);
        setKmInicial('');
        setKmFinal('');
        setShowKmModal(null);
        setCheckpoints([]);
      }, 1000);
    }

    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  };

  const handleCheckpoint = async () => {
    if (motivo === 'ronda_em_site' && (!rondaId || !location || !siteCode.trim() || !uf.trim())) {
      Alert.alert('Erro', 'Informe a sigla do site, a UF e certifique-se de que o GPS está ativo.');
      return;
    } else if (!rondaId || !location){
      Alert.alert('Erro', 'Certifique-se de que o GPS está ativo.');
      return;
    }

    try {
      let imageUrl = null;
      if (motivo === 'ronda_em_site' && image) {
        imageUrl = await uploadImage();
      }

      const checkpointData = {
        site: `${siteCode.toUpperCase()}-${uf}`,
        motivo,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        ...(imageUrl && { imageUrl }),
      };

      const checkpointsRef = collection(otherDb, 'rondas', rondaId, 'checkpoints');
      await addDoc(checkpointsRef, checkpointData);

      setCheckpoints(prev => [...prev, checkpointData]);

      Alert.alert('Checkpoint adicionado', `Site ${siteCode.toUpperCase()} salvo com sucesso.`);
      setSiteCode('');
      setUf('');
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
        disabled={uploading}
      >
        <Text style={styles.buttonText}>
          {isTracking ? 'Parar Ronda' : 'Iniciar Ronda'}
        </Text>
      </TouchableOpacity>

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
              editable={!uploading}
            />

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowKmModal(null)}
                disabled={uploading}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={showKmModal === 'inicio' ? confirmStartTracking : confirmStopTracking}
                disabled={uploading}
              >
                <Text style={styles.modalButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {isTracking && (
        <>
          {motivo === 'ronda_em_site' && (
            <View style={styles.siteInputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Sigla (ex: SP1)"
                placeholderTextColor="#999"
                value={siteCode}
                onChangeText={(text) => setSiteCode(text)}
                editable={!uploading}
              />
              <View style={styles.pickerContainerUF}>
                <Picker
                  selectedValue={uf}
                  onValueChange={(itemValue) => setUf(itemValue)}
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
            </View>
          )}

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={motivo}
              onValueChange={(itemValue) => {
                setMotivo(itemValue);
                if (itemValue !== 'ronda_em_site') setImage(null);
              }}
              dropdownIconColor="#fff"
              style={styles.picker}
              enabled={!uploading}
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
                onPress={takeImage}
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
            </>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonCheckpoint
            ]}
            onPress={handleCheckpoint}
            disabled={uploading}
          >
            <Text style={styles.buttonText}>Registrar Checkpoint</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}