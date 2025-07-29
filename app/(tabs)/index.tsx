import { View, Alert, TouchableOpacity, Text, Modal, ScrollView, Platform, AppState, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { useEffect, useState, useCallback } from 'react';
import { doc, setDoc, updateDoc, collection, addDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { otherDb, storage } from '@/services/firebaseConfig';
import { useRonda } from './_layout';
import KmModal from '@/components/modals/KmModal';
import PanicModal from '@/components/modals/PanicModal';
import CheckpointModal from '@/components/modals/CheckpointModal';

const LOCATION_TASK_NAME = 'background-location-task';
const BACKGROUND_FETCH_TASK = 'background-fetch-task';

interface Checkpoint {
  site: string;
  motivo: string;
  timestamp: string;
  imageUrl?: string;
}

// Definição da tarefa de localização em background
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    if (error.code === 'TASK_NOT_REGISTERED') {
      console.log('Tarefa de localização não registrada. Tentando registrar novamente...');
      return;
    }
    console.error('Erro na tarefa de localização em segundo plano:', error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    const location = locations[0];
    if (location) {
      console.log('Localização em segundo plano recebida:', new Date().toISOString());
      try {
        const rondaId = await AsyncStorage.getItem('rondaId');
        const uid = await AsyncStorage.getItem('userUid');

        if (rondaId && uid) {
          const rondaRef = doc(otherDb, 'rondas', rondaId);
          const userRef = doc(otherDb, 'usuarios', uid);

          await Promise.all([
            updateDoc(rondaRef, {
              ultimaLocalizacao: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: new Date().toISOString(),
              },
            }),
            updateDoc(userRef, {
              status_ronda: "Em Ronda",
              ultimaLocalizacao: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: new Date().toISOString(),
              },
            })
          ]);
        }
      } catch (err) {
        console.error('Erro ao salvar localização em background:', err);
      }
    }
  }
});

// Definição da tarefa de background fetch
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const now = Date.now();
  console.log(`Background fetch executado em: ${new Date(now).toISOString()}`);

  // Verificar se há dados pendentes para sincronizar
  try {
    const pendingSync = await AsyncStorage.getItem('pendingSync');
    if (pendingSync) {
      // Implemente sua lógica de sincronização aqui
      console.log('Sincronizando dados pendentes...');
      await AsyncStorage.removeItem('pendingSync');
    }
  } catch (error) {
    console.error('Erro durante background fetch:', error);
  }

  return BackgroundFetch.BackgroundFetchResult.NewData;
});

export default function HomeScreen() {
  const { isTracking, setIsTracking } = useRonda();
  const [location, setLocation] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [rondaId, setRondaId] = useState<string | null>(null);
  const [siteCode, setSiteCode] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [user, setUser] = useState<string | null>('');
  const [uid, setUid] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kmInicial, setKmInicial] = useState<string>('');
  const [kmFinal, setKmFinal] = useState<string>('');
  const [placaInicial, setPlacaInicial] = useState<string>('');
  const [placaFinal, setPlacaFinal] = useState<string>('');
  const [showKmModal, setShowKmModal] = useState<'inicio' | 'fim' | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [rondaDetails, setRondaDetails] = useState<any>(null);
  const [uf, setUf] = useState<string>('');
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  // Registrar tarefas de background
  const registerBackgroundTasks = useCallback(async () => {
    try {
      // Registrar background fetch
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutos
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('Background fetch registrado com sucesso');
    } catch (err) {
      console.log('Erro ao registrar background fetch:', err);
    }
  }, []);

  // Verificar e solicitar permissões
  const checkAndRequestPermissions = useCallback(async () => {
    try {
      // Permissões de câmera
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus.status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à sua câmera para tirar fotos.');
      }

      // Permissões de localização em foreground
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à sua localização.');
        return false;
      }

      // Permissões de background no Android
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
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      return false;
    }
  }, []);

  // Verificar otimizações de bateria no Android
  const checkBatteryOptimizations = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
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
      } catch (error) {
        console.error('Erro ao verificar otimizações de bateria:', error);
      }
    }
    return true;
  }, []);

  // Carregar dados do usuário
  const userData = useCallback(async () => {
    try {
      const nome = await AsyncStorage.getItem('userName');
      const userUid = await AsyncStorage.getItem('userUid');
      setUser(nome);
      setUid(userUid);
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  }, []);

  // Verificar ronda ativa
  const verificarRondaAtiva = useCallback(async () => {
    try {
      const rondaSalva = await AsyncStorage.getItem('rondaId');
      const userUid = await AsyncStorage.getItem('userUid');

      if (rondaSalva && userUid) {
        setRondaId(rondaSalva);
        setUid(userUid);
        setIsTracking(true);

        // Recuperar detalhes da ronda
        const rondaRef = doc(otherDb, 'rondas', rondaSalva);
        const rondaDoc = await getDoc(rondaRef);
        if (rondaDoc.exists()) {
          setRondaDetails(rondaDoc.data());
        }

        // Iniciar monitoramento de localização
        await startLocationTracking(rondaSalva, userUid);
      }
    } catch (error) {
      console.error('Erro ao verificar ronda ativa:', error);
    }
  }, []);

  // Iniciar monitoramento de localização
  const startLocationTracking = useCallback(async (rondaId: string, userId: string) => {
    try {
      const rondaRef = doc(otherDb, 'rondas', rondaId);
      const userRef = doc(otherDb, 'usuarios', userId);

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 60000,
          distanceInterval: 0,
        },
        async (loc) => {
          setLocation(loc);
          try {
            await Promise.all([
              updateDoc(rondaRef, {
                ultimaLocalizacao: {
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                  timestamp: new Date().toISOString(),
                },
              }),
              updateDoc(userRef, {
                status_ronda: "Em Ronda",
                ultimaLocalizacao: {
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                  timestamp: new Date().toISOString(),
                },
              })
            ]);
          } catch (err) {
            console.error('Erro ao atualizar localização:', err);
          }
        }
      );

      setSubscription(sub);

      // Iniciar serviço de background
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 60000,
        distanceInterval: 0,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Rastreamento de Localização',
          notificationBody: 'Seu aplicativo está rastreando sua localização.',
          notificationColor: '#0000ff',
        },
      });

      console.log('Monitoramento de localização iniciado');
    } catch (error) {
      console.error('Erro ao iniciar monitoramento de localização:', error);
    }
  }, []);

  // Lidar com mudanças no estado do app
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App voltou para primeiro plano
        console.log('App voltou para primeiro plano');

        if (isTracking) {
          // Verificar se a tarefa de background ainda está ativa
          const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
          if (!isTaskRegistered) {
            console.log('Tarefa de background não registrada. Reiniciando...');
            if (rondaId && uid) {
              await startLocationTracking(rondaId, uid);
            }
          }
        }
      }

      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [appState, isTracking, rondaId, uid, startLocationTracking]);

  // Efeito inicial
  useEffect(() => {
    const initialize = async () => {
      await registerBackgroundTasks();
      await checkAndRequestPermissions();
      await userData();
      await verificarRondaAtiva();
    };

    initialize();

    return () => {
      // Limpeza
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // Tirar foto
  const takeImage = async () => {
    try {
      let result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      Alert.alert('Erro', 'Não foi possível acessar a câmera.');
    }
  };

  // Upload de imagem
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

  // Iniciar ronda
  const startTracking = async () => {
    const permissionsGranted = await checkAndRequestPermissions();
    if (!permissionsGranted) return;

    const batteryOk = await checkBatteryOptimizations();
    if (!batteryOk) return;

    setShowKmModal('inicio');
  };

  // Confirmar início da ronda
  const confirmStartTracking = async () => {
    if (!kmInicial || !placaInicial) {
      Alert.alert('Erro', 'Por favor, informe a quilometragem inicial e a placa do veículo.');
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

      const imageUrl = await uploadImage();

      const rondaData = {
        nomeRonda: `Ronda_${new Date().toLocaleString()}`,
        inicio: new Date().toISOString(),
        kmInicial: parseFloat(kmInicial),
        placaInicial,
        ultimaLocalizacao: null,
        uid: uid,
        timestamp: new Date().toISOString(),
        imagemInicial: imageUrl,
      };

      await setDoc(rondaRef, rondaData);

      setRondaId(novaRondaId);
      setRondaDetails(rondaData);
      setIsTracking(true);
      setShowKmModal(null);
      setCheckpoints([]);
      setImage(null);

      await AsyncStorage.setItem('rondaId', novaRondaId);

      // Iniciar monitoramento de localização
      await startLocationTracking(novaRondaId, uid);
    } catch (error) {
      console.error('Erro ao iniciar rastreamento:', error);
      Alert.alert('Erro', 'Não foi possível iniciar o rastreamento.');
    }
  };

  // Parar ronda
  const stopTracking = async () => {
    setShowKmModal('fim');
  };

  // Confirmar parada da ronda
  const confirmStopTracking = async () => {
    if (!kmFinal || !placaFinal) {
      Alert.alert('Erro', 'Por favor, informe a quilometragem final e a placa do veículo.');
      return;
    }

    if (parseFloat(kmFinal) <= parseFloat(kmInicial)) {
      Alert.alert('Erro', 'A quilometragem final não pode ser menor que a quilometragem inicial.');
      return;
    }

    try {
      if (subscription) {
        subscription.remove();
        setSubscription(null);
      }

      setIsTracking(false);

      if (rondaId && uid) {
        const rondaRef = doc(otherDb, 'rondas', rondaId);
        const userRef = doc(otherDb, 'usuarios', uid);

        const distanciaPercorrida = parseFloat(kmFinal) - parseFloat(kmInicial);
        const imageUrl = await uploadImage();

        await Promise.all([
          updateDoc(rondaRef, {
            fim: new Date().toISOString(),
            kmFinal: parseFloat(kmFinal),
            placaFinal,
            distanciaPercorrida,
            imagemFinal: imageUrl,
          }),
          updateDoc(userRef, {
            status_ronda: "Parado"
          }),
          Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
        ]);

        setRondaDetails((prev: any) => ({
          ...prev,
          fim: new Date().toISOString(),
          kmFinal: parseFloat(kmFinal),
          placaFinal,
          distanciaPercorrida,
          imagemFinal: imageUrl,
        }));
      }

      // Limpar estado
      setTimeout(() => {
        setRondaId(null);
        setRondaDetails(null);
        setKmInicial('');
        setKmFinal('');
        setPlacaInicial('');
        setPlacaFinal('');
        setShowKmModal(null);
        setCheckpoints([]);
        setImage(null);
      }, 1000);

      await AsyncStorage.removeItem('rondaId');
    } catch (error) {
      console.error('Erro ao parar rastreamento:', error);
      Alert.alert('Erro', 'Não foi possível parar o rastreamento.');
    }
  };

  // Registrar checkpoint
  const handleCheckpoint = async () => {
    if (!rondaId || !location) {
      Alert.alert('Erro', 'Certifique-se de que o GPS está ativo.');
      return;
    }

    if (motivo === 'ronda_em_site') {
      setShowCheckpointModal(true);
    } else {
      confirmCheckpoint();
    }
  };

  // Confirmar checkpoint
  const confirmCheckpoint = async () => {
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
      setMotivo('');
      setImage(null);
      setShowCheckpointModal(false);
    } catch (error) {
      console.error('Erro ao adicionar checkpoint:', error);
      Alert.alert('Erro', 'Não foi possível salvar o checkpoint.');
    }
  };

  // Botão de pânico
  const handlePanicButton = () => {
    setShowPanicModal(true);
  };

  // Confirmar checkpoint de pânico
  const confirmPanicCheckpoint = async () => {
    if (!rondaId || !location || !siteCode.trim() || !uf.trim()) {
      Alert.alert('Erro', 'Informe a sigla do site, a UF e certifique-se de que o GPS está ativo.');
      return;
    }

    try {
      let imageUrl = null;
      if (image) {
        imageUrl = await uploadImage();
      }

      const checkpointData = {
        site: `${siteCode.toUpperCase()}-${uf}`,
        motivo: 'reporte_de_incidencia',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        ...(imageUrl && { imageUrl }),
      };

      const checkpointsRef = collection(otherDb, 'rondas', rondaId, 'checkpoints');
      await addDoc(checkpointsRef, checkpointData);

      setCheckpoints(prev => [...prev, checkpointData]);

      Alert.alert('Reporte de Incidencia registrado', 'Checkpoint de Reporte de Incidencia salvo com sucesso.');
      setShowPanicModal(false);
      setSiteCode('');
      setUf('');
      setImage(null);
    } catch (error) {
      console.error('Erro ao adicionar checkpoint de Reporte de Incidencia:', error);
      Alert.alert('Erro', 'Não foi possível salvar o checkpoint de Reporte de Incidencia.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.welcomeText}>Bem-vindo(a), {user}.</Text>

        <TouchableOpacity
          style={[
            styles.button,
            isTracking ? styles.buttonStop : styles.buttonStart,
          ]}
          onPress={isTracking ? stopTracking : startTracking}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>
            {isTracking ? 'Finalizar Atividade' : 'Iniciar Atividade'}
          </Text>
        </TouchableOpacity>

        {/* KM Modal */}
        <Modal visible={showKmModal !== null} transparent={true} animationType="slide">
          <KmModal
            visible={showKmModal !== null}
            type={showKmModal}
            kmValue={showKmModal === 'inicio' ? kmInicial : kmFinal}
            onKmChange={showKmModal === 'inicio' ? setKmInicial : setKmFinal}
            placaValue={showKmModal === 'inicio' ? placaInicial : placaFinal}
            onPlacaChange={showKmModal === 'inicio' ? setPlacaInicial : setPlacaFinal}
            image={image}
            onTakeImage={takeImage}
            onCancel={() => {
              setShowKmModal(null);
              setImage(null);
            }}
            onConfirm={showKmModal === 'inicio' ? confirmStartTracking : confirmStopTracking}
            uploading={uploading}
          />
        </Modal>

        {/* Panic Modal */}
        <Modal visible={showPanicModal} transparent={true} animationType="slide">
          <PanicModal
            visible={showPanicModal}
            siteCode={siteCode}
            onSiteCodeChange={setSiteCode}
            uf={uf}
            onUfChange={setUf}
            image={image}
            onTakeImage={takeImage}
            onCancel={() => setShowPanicModal(false)}
            onConfirm={confirmPanicCheckpoint}
            uploading={uploading}
          />
        </Modal>

        {/* Checkpoint Modal */}
        <Modal visible={showCheckpointModal} transparent={true} animationType="slide">
          <CheckpointModal
            visible={showCheckpointModal}
            siteCode={siteCode}
            onSiteCodeChange={setSiteCode}
            uf={uf}
            onUfChange={setUf}
            image={image}
            onTakeImage={takeImage}
            onCancel={() => setShowCheckpointModal(false)}
            onConfirm={confirmCheckpoint}
            uploading={uploading}
          />
        </Modal>

        {/* Tracking Options */}
        {isTracking && (
          <>
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

            <TouchableOpacity
              style={[
                styles.buttonCheckpoint,
                !motivo ? styles.buttonDisabled : null // Adiciona a classe de estilo desabilitada, se necessário
              ]}
              onPress={handleCheckpoint}
              disabled={uploading || !motivo} // Desabilita se não houver motivo selecionado
            >
              <Text style={styles.buttonText}>Registrar Ronda</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Ronda Details */}
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

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Placa Inicial:</Text>
              <Text style={styles.detailValue}>{rondaDetails.placaInicial}</Text>
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
                  <Text style={styles.detailLabel}>Placa Final:</Text>
                  <Text style={styles.detailValue}>{rondaDetails.placaFinal}</Text>
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
      </ScrollView>

      {isTracking && (
        <TouchableOpacity
          style={styles.panicButton}
          onPress={handlePanicButton}
          disabled={uploading}
        >
          <MaterialCommunityIcons name="shield-alert-outline" size={40} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Estilos aprimorados
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a003f', // Cor roxa/púrpura
    paddingTop: 40, // Espaçamento do topo
    paddingHorizontal: 20, // Espaçamento lateral
  },
  scrollContainer: {
    paddingBottom: 100,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#ffffff', // Cor do texto
  },
  button: {
    borderRadius: 5,
    paddingVertical: 15,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonStart: {
    backgroundColor: '#28a745', // Cor verde para iniciar
  },
  buttonStop: {
    backgroundColor: '#dc3545', // Cor vermelha para parar
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
  },
  pickerContainer: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 15,
  },
  picker: {
    height: 60,
    width: '100%',
    color: '#ffffff',
  },
  detailsContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  detailValue: {
    color: '#555',
  },
  checkpointsContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#eef',
    borderRadius: 5,
  },
  checkpointsTitle: {
    fontWeight: 'bold',
    color: '#007BFF',
  },
  checkpointItem: {
    padding: 5,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  checkpointSite: {
    fontWeight: 'bold',
  },
  checkpointMotivo: {
    color: '#555',
  },
  checkpointTime: {
    fontSize: 12,
    color: '#777',
  },
  panicButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#dc3545', // Cor de alerta para o botão de pânico
    borderRadius: 50,
    padding: 15,
    elevation: 5,
  },
  buttonCheckpoint: {
    backgroundColor: '#007BFF', // Cor azul para checkpoints
    borderRadius: 5,
    paddingVertical: 15,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(170, 170, 170, 0.5)', // Cor cinza mais transparente
  },
});