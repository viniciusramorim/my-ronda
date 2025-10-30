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

interface RotaPreDefinida {
  id: string;
  nome: string;
  pontos: PontoColeta[];
  ativa: boolean;
}

interface PontoColeta {
  id: string;
  sigla: string;
  uf: string;
  descricao: string;
  ordem: number;
  concluido: boolean;
  timestamp?: string;
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
  const [comment, setComment] = useState('');
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

  // Novos estados para rota pré-definida
  const [rotasPreDefinidas, setRotasPreDefinidas] = useState<RotaPreDefinida[]>([]);
  const [rotaAtiva, setRotaAtiva] = useState<RotaPreDefinida | null>(null);
  const [proximoPonto, setProximoPonto] = useState<PontoColeta | null>(null);
  const [mostrarSelecaoRota, setMostrarSelecaoRota] = useState(false);
  const [modoRota, setModoRota] = useState<'livre' | 'predefinida' | null>(null);

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

  // Carregar rotas pré-definidas
  const carregarRotasPreDefinidas = useCallback(async () => {
    try {
      // Aqui você pode carregar de um arquivo local, API ou Firebase
      const rotasExemplo: RotaPreDefinida[] = [
        {
          id: 'rota_1',
          nome: 'Rota Norte',
          ativa: true,
          pontos: [
            { id: 'p1', sigla: 'STA', uf: 'SP', descricao: 'Site Torre A', ordem: 1, concluido: false },
            { id: 'p2', sigla: 'STB', uf: 'SP', descricao: 'Site Torre B', ordem: 2, concluido: false },
            { id: 'p3', sigla: 'MTC', uf: 'MG', descricao: 'Mini Torre C', ordem: 3, concluido: false },
            { id: 'p4', sigla: 'CTD', uf: 'RJ', descricao: 'Centro Distribuição D', ordem: 4, concluido: false },
          ]
        },
        {
          id: 'rota_2',
          nome: 'Rota Sul',
          ativa: true,
          pontos: [
            { id: 'p5', sigla: 'STE', uf: 'PR', descricao: 'Site Torre E', ordem: 1, concluido: false },
            { id: 'p6', sigla: 'MTF', uf: 'SC', descricao: 'Mini Torre F', ordem: 2, concluido: false },
            { id: 'p7', sigla: 'CTG', uf: 'RS', descricao: 'Centro Distribuição G', ordem: 3, concluido: false },
          ]
        }
      ];
      
      setRotasPreDefinidas(rotasExemplo);
      return rotasExemplo;
    } catch (error) {
      console.error('Erro ao carregar rotas pré-definidas:', error);
      return [];
    }
  }, []);

  // Carregar checkpoints da ronda
  const carregarCheckpoints = useCallback(async (rondaId: string) => {
    try {
      // Aqui você carregaria os checkpoints do Firebase
      // Por enquanto, vamos apenas limpar os checkpoints locais
      setCheckpoints([]);
    } catch (error) {
      console.error('Erro ao carregar checkpoints:', error);
    }
  }, []);

  // Verificar ronda ativa - FUNÇÃO ATUALIZADA
  const verificarRondaAtiva = useCallback(async () => {
    try {
      const rondaSalva = await AsyncStorage.getItem('rondaId');
      const userUid = await AsyncStorage.getItem('userUid');
      const rotaAtivaSalva = await AsyncStorage.getItem('rotaAtiva');
      const modoRotaSalvo = await AsyncStorage.getItem('modoRota');

      if (rondaSalva && userUid) {
        setRondaId(rondaSalva);
        setUid(userUid);
        setIsTracking(true);

        // Recuperar detalhes da ronda do Firebase
        const rondaRef = doc(otherDb, 'rondas', rondaSalva);
        const rondaDoc = await getDoc(rondaRef);
        
        if (rondaDoc.exists()) {
          const data = rondaDoc.data();
          setRondaDetails(data);
          
          // Restaurar modo da rota
          if (modoRotaSalvo) {
            setModoRota(modoRotaSalvo as 'livre' | 'predefinida');
          } else if (data.modoRota) {
            setModoRota(data.modoRota);
          }

          // Restaurar rota ativa se existir
          if (rotaAtivaSalva && modoRotaSalvo === 'predefinida') {
            try {
              const rotaParseada = JSON.parse(rotaAtivaSalva);
              setRotaAtiva(rotaParseada);
              
              // Encontrar próximo ponto não concluído
              const proximo = rotaParseada.pontos.find((p: PontoColeta) => !p.concluido);
              setProximoPonto(proximo || null);
              
              console.log('Rota pré-definida recuperada:', rotaParseada.nome);
            } catch (error) {
              console.error('Erro ao parsear rota ativa:', error);
            }
          } else if (data.rotaPreDefinida && modoRotaSalvo === 'predefinida') {
            // Tentar recuperar do Firebase se não tiver no AsyncStorage
            const rotas = await carregarRotasPreDefinidas();
            const rota = rotas.find(r => r.id === data.rotaPreDefinida.id);
            if (rota) {
              setRotaAtiva(rota);
              // Encontrar próximo ponto não concluído baseado nos checkpoints
              const proximo = rota.pontos.find(p => !p.concluido);
              setProximoPonto(proximo || null);
            }
          }

          // Carregar checkpoints
          await carregarCheckpoints(rondaSalva);
        }

        // Iniciar monitoramento de localização
        await startLocationTracking(rondaSalva, userUid);

        console.log('Ronda recuperada - Modo:', modoRotaSalvo || data?.modoRota);
      }
    } catch (error) {
      console.error('Erro ao verificar ronda ativa:', error);
    }
  }, [carregarRotasPreDefinidas, carregarCheckpoints]);

  // Salvar estado da rota no AsyncStorage - NOVA FUNÇÃO
  const salvarEstadoRota = useCallback(async () => {
    try {
      if (rotaAtiva) {
        await AsyncStorage.setItem('rotaAtiva', JSON.stringify(rotaAtiva));
      }
      if (modoRota) {
        await AsyncStorage.setItem('modoRota', modoRota);
      }
    } catch (error) {
      console.error('Erro ao salvar estado da rota:', error);
    }
  }, [rotaAtiva, modoRota]);

  // Limpar estado da rota do AsyncStorage - NOVA FUNÇÃO
  const limparEstadoRota = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove(['rotaAtiva', 'modoRota']);
    } catch (error) {
      console.error('Erro ao limpar estado da rota:', error);
    }
  }, []);

  // Efeito para salvar estado da rota quando mudar
  useEffect(() => {
    if (isTracking && (rotaAtiva || modoRota)) {
      salvarEstadoRota();
    }
  }, [rotaAtiva, modoRota, isTracking, salvarEstadoRota]);

  // Iniciar monitoramento de localização
  const startLocationTracking = useCallback(async (rondaId: string, userId: string) => {
    try {
      const rondaRef = doc(otherDb, 'rondas', rondaId);
      const userRef = doc(otherDb, 'usuarios', userId);

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 600000,
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
        timeInterval: 600000,
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
      await carregarRotasPreDefinidas();
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

    // Mostrar modal de seleção de modo de rota
    setMostrarSelecaoRota(true);
  };

  // Selecionar modo de rota
  const selecionarModoRota = (modo: 'livre' | 'predefinida') => {
    setModoRota(modo);
    
    if (modo === 'predefinida') {
      // Manter o modal aberto para seleção da rota específica
      setMostrarSelecaoRota(true);
    } else {
      // Modo livre - ir direto para dados do veículo
      setMostrarSelecaoRota(false);
      setShowKmModal('inicio');
    }
  };

  // Confirmar rota selecionada
  const confirmarRotaSelecionada = (rota: RotaPreDefinida) => {
    setRotaAtiva(rota);
    setProximoPonto(rota.pontos[0]); // Primeiro ponto da rota
    setMostrarSelecaoRota(false);
    setShowKmModal('inicio');
  };

  // Avançar para próximo ponto
  const avancarParaProximoPonto = async () => {
    if (!rotaAtiva || !proximoPonto) return;

    try {
      // Marcar ponto atual como concluído
      const pontosAtualizados = rotaAtiva.pontos.map(ponto => 
        ponto.id === proximoPonto.id 
          ? { ...ponto, concluido: true, timestamp: new Date().toISOString() }
          : ponto
      );

      const rotaAtualizada = {
        ...rotaAtiva,
        pontos: pontosAtualizados
      };

      setRotaAtiva(rotaAtualizada);

      // Encontrar próximo ponto não concluído
      const proximo = pontosAtualizados.find(p => !p.concluido);
      
      if (proximo) {
        setProximoPonto(proximo);
        Alert.alert('Próximo Ponto', `Siga para: ${proximo.sigla}-${proximo.uf} - ${proximo.descricao}`);
      } else {
        // Rota concluída
        setProximoPonto(null);
        Alert.alert('Rota Concluída', 'Todos os pontos da rota foram visitados!');
      }
    } catch (error) {
      console.error('Erro ao avançar para próximo ponto:', error);
    }
  };

  // Confirmar início da ronda - ATUALIZADA
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
        modoRota: modoRota,
        ...(rotaAtiva && {
          rotaPreDefinida: {
            id: rotaAtiva.id,
            nome: rotaAtiva.nome,
            pontosTotais: rotaAtiva.pontos.length
          }
        }),
      };

      await setDoc(rondaRef, rondaData);

      setRondaId(novaRondaId);
      setRondaDetails(rondaData);
      setIsTracking(true);
      setShowKmModal(null);
      setCheckpoints([]);
      setImage(null);

      await AsyncStorage.setItem('rondaId', novaRondaId);
      await salvarEstadoRota(); // Salvar estado da rota

      // Iniciar monitoramento de localização
      await startLocationTracking(novaRondaId, uid);

      // Mostrar mensagem conforme o modo
      if (modoRota === 'predefinida' && rotaAtiva && proximoPonto) {
        Alert.alert(
          'Rota Iniciada', 
          `Rota "${rotaAtiva.nome}" iniciada. Primeiro ponto: ${proximoPonto.sigla}-${proximoPonto.uf}`
        );
      } else {
        Alert.alert('Ronda Iniciada', 'Modo de rota livre ativado. Você pode registrar checkpoints livremente.');
      }
    } catch (error) {
      console.error('Erro ao iniciar rastreamento:', error);
      Alert.alert('Erro', 'Não foi possível iniciar o rastreamento.');
    }
  };

  // Parar ronda
  const stopTracking = async () => {
    setShowKmModal('fim');
  };

  // Confirmar parada da ronda - ATUALIZADA
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

        const pontosConcluidos = rotaAtiva ? rotaAtiva.pontos.filter(p => p.concluido).length : 0;

        await Promise.all([
          updateDoc(rondaRef, {
            fim: new Date().toISOString(),
            kmFinal: parseFloat(kmFinal),
            placaFinal,
            distanciaPercorrida,
            imagemFinal: imageUrl,
            ...(rotaAtiva && {
              rotaPreDefinida: {
                id: rotaAtiva.id,
                nome: rotaAtiva.nome,
                pontosTotais: rotaAtiva.pontos.length,
                pontosConcluidos: pontosConcluidos
              }
            })
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
        setRotaAtiva(null);
        setProximoPonto(null);
        setModoRota(null);
      }, 1000);

      await AsyncStorage.removeItem('rondaId');
      await limparEstadoRota(); // Limpar estado da rota
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

    if (proximoPonto) {
      // Usar dados do ponto da rota ativa
      setSiteCode(proximoPonto.sigla);
      setUf(proximoPonto.uf);
      setMotivo('ronda_em_site');
      setShowCheckpointModal(true);
    } else {
      // Comportamento normal quando não há rota ativa (modo livre)
      if (motivo === 'ronda_em_site') {
        setShowCheckpointModal(true);
      } else {
        confirmCheckpoint();
      }
    }
  };

  // Confirmar checkpoint - ATUALIZADA
  const confirmCheckpoint = async () => {
    try {
      let imageUrl = null;
      if ((motivo === 'ronda_em_site' || proximoPonto) && image) {
        imageUrl = await uploadImage();
      }

      const site = proximoPonto 
        ? `${proximoPonto.sigla}-${proximoPonto.uf}`
        : `${siteCode.toUpperCase()}-${uf}`;

      const checkpointData = {
        site,
        motivo: proximoPonto ? 'ronda_em_site' : motivo,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        comentario: comment,
        ...(imageUrl && { imageUrl }),
      };

      const checkpointsRef = collection(otherDb, 'rondas', rondaId, 'checkpoints');
      await addDoc(checkpointsRef, checkpointData);

      setCheckpoints(prev => [...prev, checkpointData]);

      // Avançar para próximo ponto se estiver em uma rota pré-definida
      if (proximoPonto) {
        await avancarParaProximoPonto();
        await salvarEstadoRota(); // Salvar estado atualizado da rota
      }

      Alert.alert('Checkpoint adicionado', `Site ${site} salvo com sucesso.`);
      setSiteCode('');
      setUf('');
      setMotivo('');
      setImage(null);
      setComment('');
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

        {/* Modal de Seleção de Modo de Rota */}
        <Modal visible={mostrarSelecaoRota} transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              {!modoRota ? (
                // Seleção inicial do modo
                <>
                  <Text style={styles.modalTitle}>Selecione o Modo de Ronda</Text>
                  
                  <TouchableOpacity
                    style={styles.modoRotaButton}
                    onPress={() => selecionarModoRota('livre')}
                  >
                    <MaterialCommunityIcons name="map-marker-radius" size={40} color="#007BFF" />
                    <Text style={styles.modoRotaTitle}>Rota Livre</Text>
                    <Text style={styles.modoRotaDescricao}>
                      Registre checkpoints livremente sem uma rota pré-definida
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modoRotaButton}
                    onPress={() => selecionarModoRota('predefinida')}
                  >
                    <MaterialCommunityIcons name="map-marker-path" size={40} color="#28a745" />
                    <Text style={styles.modoRotaTitle}>Rota Pré-definida</Text>
                    <Text style={styles.modoRotaDescricao}>
                      Siga uma rota com pontos pré-definidos em sequência
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.buttonCancel}
                    onPress={() => setMostrarSelecaoRota(false)}
                  >
                    <Text style={styles.buttonText}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Seleção de rota específica (apenas para modo pré-definido)
                <>
                  <Text style={styles.modalTitle}>Selecionar Rota Pré-Definida</Text>
                  <ScrollView style={styles.rotasList}>
                    {rotasPreDefinidas.map(rota => (
                      <TouchableOpacity
                        key={rota.id}
                        style={styles.rotaItem}
                        onPress={() => confirmarRotaSelecionada(rota)}
                      >
                        <Text style={styles.rotaNome}>{rota.nome}</Text>
                        <Text style={styles.rotaPontos}>
                          {rota.pontos.length} pontos • {rota.pontos.map(p => `${p.sigla}-${p.uf}`).join(' → ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.buttonCancel}
                    onPress={() => {
                      setModoRota(null);
                      setMostrarSelecaoRota(false);
                    }}
                  >
                    <Text style={styles.buttonText}>Voltar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

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
              setRotaAtiva(null);
              setProximoPonto(null);
              setModoRota(null);
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
            comment={comment}
            onCommentChange={setComment}
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
            <View style={styles.modoInfoContainer}>
              <Text style={styles.modoInfoText}>
                Modo: {modoRota === 'predefinida' ? 'Rota Pré-definida' : 'Rota Livre'}
              </Text>
              {rotaAtiva && (
                <Text style={styles.rotaAtivaText}>
                  Rota: {rotaAtiva.nome}
                </Text>
              )}
            </View>

            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={motivo}
                onValueChange={(itemValue) => {
                  setMotivo(itemValue);
                  if (itemValue !== 'ronda_em_site') setImage(null);
                }}
                dropdownIconColor="#fff"
                style={styles.picker}
                enabled={!uploading && !proximoPonto}
              >
                <Picker.Item label="Selecione o motivo" value="" color="#999" />
                <Picker.Item label="Ronda em site" value="ronda_em_site" color="#000" />
                <Picker.Item label="Abastecimento" value="abastecimento" color="#000" />
                <Picker.Item label="Troca de veículo" value="troca_de_veiculo" color="#000" />
                <Picker.Item label="Outro" value="outro" color="#000" />
              </Picker>
            </View>

            <TouchableOpacity
              style={[
                styles.buttonCheckpoint,
                (!motivo && !proximoPonto) ? styles.buttonDisabled : null
              ]}
              onPress={handleCheckpoint}
              disabled={uploading || (!motivo && !proximoPonto)}
            >
              <Text style={styles.buttonText}>
                {proximoPonto 
                  ? `Registrar ${proximoPonto.sigla}-${proximoPonto.uf}`
                  : motivo === 'ronda_em_site' 
                    ? 'Registrar Site' 
                    : 'Registrar Checkpoint'
                }
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Progresso da Rota (apenas para modo pré-definido) */}
        {isTracking && rotaAtiva && (
          <View style={styles.rotaContainer}>
            <Text style={styles.rotaTitle}>Rota: {rotaAtiva.nome}</Text>
            
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Progresso: {rotaAtiva.pontos.filter(p => p.concluido).length} / {rotaAtiva.pontos.length}
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { 
                      width: `${(rotaAtiva.pontos.filter(p => p.concluido).length / rotaAtiva.pontos.length) * 100}%` 
                    }
                  ]} 
                />
              </View>
            </View>

            {proximoPonto && (
              <View style={styles.proximoPontoContainer}>
                <Text style={styles.proximoPontoTitle}>Próximo Ponto:</Text>
                <Text style={styles.proximoPonto}>
                  {proximoPonto.sigla}-{proximoPonto.uf} - {proximoPonto.descricao}
                </Text>
              </View>
            )}

            <ScrollView style={styles.pontosList}>
              {rotaAtiva.pontos.map(ponto => (
                <View key={ponto.id} style={[
                  styles.pontoItem,
                  ponto.concluido && styles.pontoConcluido
                ]}>
                  <MaterialCommunityIcons 
                    name={ponto.concluido ? "check-circle" : "map-marker"} 
                    size={20} 
                    color={ponto.concluido ? "#28a745" : "#007BFF"} 
                  />
                  <Text style={styles.pontoText}>
                    {ponto.sigla}-{ponto.uf} - {ponto.descricao}
                  </Text>
                  {ponto.timestamp && (
                    <Text style={styles.pontoTime}>
                      {new Date(ponto.timestamp).toLocaleTimeString()}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Informações do modo livre */}
        {isTracking && modoRota === 'livre' && !rotaAtiva && (
          <View style={styles.rotaLivreContainer}>
            <Text style={styles.rotaLivreTitle}>Modo Rota Livre</Text>
            <Text style={styles.rotaLivreDescricao}>
              Você está no modo de rota livre. Registre checkpoints conforme necessário selecionando o motivo acima.
            </Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{checkpoints.length}</Text>
                <Text style={styles.statLabel}>Checkpoints</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {checkpoints.filter(cp => cp.motivo === 'ronda_em_site').length}
                </Text>
                <Text style={styles.statLabel}>Sites</Text>
              </View>
            </View>
          </View>
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

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Modo:</Text>
              <Text style={styles.detailValue}>
                {rondaDetails.modoRota === 'predefinida' ? 'Rota Pré-definida' : 'Rota Livre'}
              </Text>
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

// Estilos (mantidos iguais do código anterior)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a003f',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  scrollContainer: {
    paddingBottom: 100,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#ffffff',
  },
  button: {
    borderRadius: 5,
    paddingVertical: 15,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonStart: {
    backgroundColor: '#28a745',
  },
  buttonStop: {
    backgroundColor: '#dc3545',
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
    backgroundColor: '#dc3545',
    borderRadius: 50,
    padding: 15,
    elevation: 5,
  },
  buttonCheckpoint: {
    backgroundColor: '#007BFF',
    borderRadius: 5,
    paddingVertical: 15,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(170, 170, 170, 0.5)',
  },
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modoRotaButton: {
    padding: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
  },
  modoRotaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
  modoRotaDescricao: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  rotasList: {
    maxHeight: 300,
  },
  rotaItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rotaNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  rotaPontos: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  rotaContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  rotaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  progressContainer: {
    marginBottom: 15,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 4,
  },
  proximoPontoContainer: {
    backgroundColor: '#d1ecf1',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  proximoPontoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0c5460',
  },
  proximoPonto: {
    fontSize: 16,
    color: '#0c5460',
    fontWeight: 'bold',
  },
  pontosList: {
    maxHeight: 200,
  },
  pontoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pontoConcluido: {
    backgroundColor: '#d4edda',
  },
  pontoText: {
    flex: 1,
    marginLeft: 10,
    color: '#333',
  },
  pontoTime: {
    fontSize: 12,
    color: '#666',
  },
  buttonCancel: {
    backgroundColor: '#6c757d',
    borderRadius: 5,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  modoInfoContainer: {
    backgroundColor: '#e7f3ff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#007BFF',
  },
  modoInfoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007BFF',
  },
  rotaAtivaText: {
    fontSize: 14,
    color: '#0056b3',
    marginTop: 5,
  },
  rotaLivreContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#e7f3ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  rotaLivreTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007BFF',
    marginBottom: 10,
  },
  rotaLivreDescricao: {
    fontSize: 14,
    color: '#0056b3',
    lineHeight: 20,
    marginBottom: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007BFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#0056b3',
    marginTop: 5,
  },
});