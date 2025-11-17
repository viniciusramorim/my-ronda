import { View, Alert, TouchableOpacity, Text, Modal, ScrollView, Platform, AppState, ActivityIndicator, Linking } from 'react-native';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { useEffect, useState, useCallback } from 'react';
import { doc, setDoc, updateDoc, collection, addDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { otherDb, storage } from '@/services/firebaseConfig';
import { useRonda } from './_layout';
import styles from '@/assets/styles/stylesIndex';
import KmModal from '@/components/modals/KmModal';
import PanicModal from '@/components/modals/PanicModal';
import CheckpointModal from '@/components/modals/CheckpointModal';
import TrocaVeiculoModal from '@/components/modals/TrocaVeiculoModal';

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
  latitude: number; // ← Adicione isso
  longitude: number; // ← Adicione isso
}

interface Site {
  id: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  raio: number;
  uf: string;
  regional: string;
  status: string;
  createdBy: string;
  idOriginalPerimetro: string;
  dataInicio: any;
  dataFim: any | null;
  geohash?: string; // ← Adicione este campo
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
  const [showTrocaVeiculoModal, setShowTrocaVeiculoModal] = useState(false);
  const [carregandoRotas, setCarregandoRotas] = useState(false);
  const [estaProximoDoPonto, setEstaProximoDoPonto] = useState(false);
  const [distanciaAtual, setDistanciaAtual] = useState<number>(0);
  const [sitesProximosEncontrados, setSitesProximosEncontrados] = useState<Site[]>([]);
  const [mostrarSelecaoSites, setMostrarSelecaoSites] = useState(false);
  const [mostrandoAlertaDetecao, setMostrandoAlertaDetecao] = useState(false);

  const selecionarSite = (site: Site) => {
    setSiteCode(site.nome);
    setUf(site.uf);
    setMotivo('ronda_em_site');
    setMostrarSelecaoSites(false);
    setMostrandoAlertaDetecao(false);
    setShowCheckpointModal(true);
  };

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

  // Carregar rotas pré-definidas do Firestore filtradas por UID
  const carregarRotasPreDefinidas = useCallback(async () => {
    setCarregandoRotas(true);
    try {
      console.log('Carregando rotas pré-definidas do Firestore...');

      if (!uid) {
        console.log('UID do usuário não disponível');
        setRotasPreDefinidas([]);
        return [];
      }

      console.log('UID do usuário:', uid);

      // Referência para a collection rotas_rondas
      const rotasRef = collection(otherDb, 'rotas_rondas');

      // Query para buscar apenas rotas ativas E que tenham o UID do usuário
      const q = query(
        rotasRef,
        where('ativa', '==', true),
        where('uid', '==', uid)
      );

      const querySnapshot = await getDocs(q);

      const rotas: RotaPreDefinida[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Rota encontrada para o usuário:', data.nome);

        // Dentro da função carregarRotasPreDefinidas, no mapeamento dos pontos:
        const rota: RotaPreDefinida = {
          id: doc.id,
          nome: data.nome || 'Rota sem nome',
          ativa: data.ativa || false,
          pontos: data.pontos?.map((ponto: any, index: number) => ({
            id: ponto.id || `ponto_${index}`,
            sigla: ponto.sigla || '',
            uf: ponto.uf || '',
            descricao: ponto.descricao || '',
            ordem: ponto.ordem || index + 1,
            concluido: ponto.concluido || false,
            timestamp: ponto.timestamp || '',
            imageUrl: ponto.imageUrl || '',
            latitude: ponto.latitude || 0, // ← Adicione isso
            longitude: ponto.longitude || 0, // ← Adicione isso
          })) || [],
        };

        rotas.push(rota);
      });

      console.log(`Total de rotas carregadas para o usuário ${uid}: ${rotas.length}`);
      setRotasPreDefinidas(rotas);

      if (rotas.length === 0) {
        console.log('Nenhuma rota encontrada para o UID:', uid);
        Alert.alert(
          'Nenhuma Rota Disponível',
          'Não foram encontradas rotas pré-definidas para o seu usuário.'
        );
      }

      return rotas;

    } catch (error) {
      console.error('Erro ao carregar rotas pré-definidas do Firestore:', error);

      // Verificar se é erro de permissão ou se não há rotas para o usuário
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('Permission')) {
          Alert.alert(
            'Erro de Permissão',
            'Não foi possível acessar as rotas. Verifique suas permissões.'
          );
        } else {
          Alert.alert(
            'Erro de Conexão',
            'Não foi possível carregar as rotas do servidor. Verifique sua conexão.'
          );
        }
      }

      // Fallback para dados vazios em caso de erro
      setRotasPreDefinidas([]);
      return [];
    } finally {
      setCarregandoRotas(false);
    }
  }, [uid]); // ← Adicione uid como dependência

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

  // Iniciar monitoramento de localização - ATUALIZADA
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

      // Iniciar serviço de background usando a função auxiliar
      await gerenciarTarefaBackground('iniciar');

      console.log('Monitoramento de localização iniciado');
    } catch (error) {
      console.error('Erro ao iniciar monitoramento de localização:', error);
    }
  }, []);

  // Verificar ronda ativa - ATUALIZADA
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

              console.log('Rota pré-definida recuperada do AsyncStorage:', rotaParseada.nome);
            } catch (error) {
              console.error('Erro ao parsear rota ativa do AsyncStorage:', error);
            }
          } else if (data.rotaPreDefinida && modoRotaSalvo === 'predefinida') {
            // Tentar recuperar do Firestore se não tiver no AsyncStorage
            console.log('Tentando recuperar rota do Firestore:', data.rotaPreDefinida.id);

            try {
              const rotaDocRef = doc(otherDb, 'rotas_rondas', data.rotaPreDefinida.id);
              const rotaDocSnap = await getDoc(rotaDocRef);

              if (rotaDocSnap.exists()) {
                const rotaData = rotaDocSnap.data();

                // Verificar se a rota pertence ao usuário atual
                if (rotaData.uid === userUid && rotaData.ativa) {
                  const rota: RotaPreDefinida = {
                    id: rotaDocSnap.id,
                    nome: rotaData.nome || 'Rota sem nome',
                    ativa: rotaData.ativa || false,
                    pontos: rotaData.pontos?.map((ponto: any, index: number) => ({
                      id: ponto.id || `ponto_${index}`,
                      sigla: ponto.sigla || '',
                      uf: ponto.uf || '',
                      descricao: ponto.descricao || '',
                      ordem: ponto.ordem || index + 1,
                      concluido: ponto.concluido || false,
                      timestamp: ponto.timestamp || '',
                      imageUrl: ponto.imageUrl || '',
                    })) || [],
                  };

                  setRotaAtiva(rota);

                  // Encontrar próximo ponto não concluído baseado nos checkpoints
                  const proximo = rota.pontos.find(p => !p.concluido);
                  setProximoPonto(proximo || null);

                  console.log('Rota pré-definida recuperada do Firestore:', rota.nome);
                } else {
                  console.log('Rota não pertence ao usuário ou está inativa');
                  setModoRota('livre'); // Muda para modo livre se a rota não for válida
                }
              } else {
                console.log('Rota não encontrada no Firestore:', data.rotaPreDefinida.id);
                setModoRota('livre'); // Muda para modo livre se a rota não for encontrada
              }
            } catch (error) {
              console.error('Erro ao recuperar rota do Firestore:', error);
              setModoRota('livre'); // Muda para modo livre em caso de erro
            }
          }

          // Carregar checkpoints
          await carregarCheckpoints(rondaSalva);
        }

        // Iniciar monitoramento de localização
        await startLocationTracking(rondaSalva, userUid);

        console.log('Ronda recuperada - Modo:', modoRotaSalvo);
      }
    } catch (error) {
      console.error('Erro ao verificar ronda ativa:', error);
    }
  }, [carregarCheckpoints, startLocationTracking, uid]);

  // Efeito para salvar estado da rota quando mudar
  useEffect(() => {
    if (isTracking && (rotaAtiva || modoRota)) {
      salvarEstadoRota();
    }
  }, [rotaAtiva, modoRota, isTracking, salvarEstadoRota]);

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
      await userData(); // ← Isso carrega o UID primeiro
      await carregarRotasPreDefinidas(); // ← Depois carrega as rotas
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

  // Efeito para recarregar rotas quando o UID mudar
  useEffect(() => {
    if (uid) {
      console.log('UID carregado, recarregando rotas...');
      carregarRotasPreDefinidas();
    }
  }, [uid, carregarRotasPreDefinidas]);

  // Verificar proximidade do ponto atual (apenas para informação)
  useEffect(() => {
    if (isTracking && location && proximoPonto && modoRota === 'predefinida') {
      const proximoPontoComCoordenadas = proximoPonto as PontoColeta;

      if (proximoPontoComCoordenadas.latitude && proximoPontoComCoordenadas.longitude) {
        const estaProximo = verificarProximidadeDoLocal(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          },
          {
            latitude: proximoPontoComCoordenadas.latitude,
            longitude: proximoPontoComCoordenadas.longitude
          },
          0.1 // 100 metros
        );

        const distancia = calcularDistancia(
          location.coords.latitude,
          location.coords.longitude,
          proximoPontoComCoordenadas.latitude,
          proximoPontoComCoordenadas.longitude
        );

        setEstaProximoDoPonto(estaProximo);
        setDistanciaAtual(distancia);

        // Apenas informa quando está próximo, mas não bloqueia nada
        if (estaProximo && !proximoPontoComCoordenadas.concluido) {
          // Opcional: pode mostrar uma notificação informativa
          console.log(`Próximo do ponto ${proximoPonto.sigla}-${proximoPonto.uf}`);
        }
      }
    }
  }, [location, proximoPonto, isTracking, modoRota]);

  // Efeito para limpar estados quando modais forem fechados
  useEffect(() => {
    // Se o modal de seleção de sites foi fechado, limpar o alerta de detecção
    if (!mostrarSelecaoSites && !showCheckpointModal) {
      setMostrandoAlertaDetecao(false);
    }
  }, [mostrarSelecaoSites, showCheckpointModal]);

  // Efeito para limpar tudo quando a ronda for parada
  useEffect(() => {
    if (!isTracking) {
      setMostrandoAlertaDetecao(false);
      setMostrarSelecaoSites(false);
      setSitesProximosEncontrados([]);
    }
  }, [isTracking]);

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

  // Função auxiliar para gerenciar tarefas de background
  const gerenciarTarefaBackground = async (acao: 'iniciar' | 'parar') => {
    try {
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

      if (acao === 'iniciar' && !isTaskRegistered) {
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
        console.log('Tarefa de background iniciada');
      } else if (acao === 'parar' && isTaskRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('Tarefa de background parada');
      }
    } catch (error) {
      console.error(`Erro ao ${acao} tarefa de background:`, error);

      if (error instanceof Error && error.message.includes('TaskNotFoundException')) {
        console.log('Tarefa não encontrada - provavelmente já foi removida');
      } else if (acao === 'parar') {
        // Se não conseguimos parar a tarefa, tentar forçar a remoção
        try {
          await BackgroundFetch.unregisterTaskAsync(LOCATION_TASK_NAME);
          console.log('Tarefa forçadamente removida');
        } catch (unregisterError) {
          console.error('Erro ao forçar remoção da tarefa:', unregisterError);
        }
      }
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
      // Parar subscription do foreground primeiro
      if (subscription) {
        subscription.remove();
        setSubscription(null);
      }

      setIsTracking(false);

      await gerenciarTarefaBackground('parar');

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
          })
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
      await limparEstadoRota();

      Alert.alert('Sucesso', 'Ronda finalizada com sucesso!');

    } catch (error) {
      console.error('Erro ao parar rastreamento:', error);

      // Mesmo se der erro na parada do background, continuar com o processo
      if (error instanceof Error && error.message.includes('TaskNotFoundException')) {
        console.log('Tarefa já foi removida, continuando processo...');
        // Continuar com o processo mesmo se a tarefa não for encontrada
      } else {
        Alert.alert('Aviso', 'Ronda finalizada, mas houve um problema ao parar alguns serviços.');
      }
    }
  };

  const handleCheckpoint = async () => {
    if (!rondaId || !location) {
      Alert.alert('Erro', 'Certifique-se de que o GPS está ativo.');
      return;
    }

    // Se estiver no modo livre e o motivo for "ronda_em_site", detectar site automaticamente
    if (modoRota === 'livre' && motivo === 'ronda_em_site' && !proximoPonto) {
      try {
        // Usar um estado para controlar o alerta em vez de Alert.alert diretamente
        setMostrandoAlertaDetecao(true);

        // USAR A NOVA FUNÇÃO COM GEOHASH - buscar múltiplos sites
        const sitesProximos = await encontrarSitesProximosComGeohash(
          location.coords.latitude,
          location.coords.longitude,
          10 // Buscar até 10 sites
        );

        // Fechar o alerta de detecção
        setMostrandoAlertaDetecao(false);

        if (sitesProximos.length > 0) {
          // Salvar os sites encontrados no estado
          setSitesProximosEncontrados(sitesProximos);

          if (sitesProximos.length === 1) {
            // Se só tem um site, usar automaticamente
            const siteProximo = sitesProximos[0];
            setSiteCode(siteProximo.nome);
            setUf(siteProximo.uf);
            setMotivo('ronda_em_site');

            const distancia = distanceBetween(
              [siteProximo.latitude, siteProximo.longitude],
              [location.coords.latitude, location.coords.longitude]
            );

            Alert.alert(
              'Site Detectado',
              `Site mais próximo encontrado:\n\n${siteProximo.nome}-${siteProximo.uf}\n${siteProximo.endereco}\n\nDistância: ${distancia.toFixed(2)}km`,
              [
                {
                  text: 'Usar Outro Site',
                  style: 'cancel',
                  onPress: () => setShowCheckpointModal(true)
                },
                {
                  text: 'Confirmar',
                  onPress: () => setShowCheckpointModal(true)
                }
              ]
            );
          } else {
            // Se tem múltiplos sites, mostrar modal de seleção
            setMostrarSelecaoSites(true);
          }
        } else {
          Alert.alert(
            'Nenhum Site Próximo',
            'Não foi encontrado nenhum site ativo dentro de 10km da sua localização. Você pode registrar manualmente.',
            [
              {
                text: 'Registrar Manualmente',
                onPress: () => setShowCheckpointModal(true)
              },
              {
                text: 'Cancelar',
                style: 'cancel'
              }
            ]
          );
        }
        return;
      } catch (error) {
        console.error('Erro ao detectar site:', error);
        // Garantir que o alerta seja fechado em caso de erro
        setMostrandoAlertaDetecao(false);
        setShowCheckpointModal(true);
      }
    }

    // Comportamento original para outros casos
    if (proximoPonto) {
      if (proximoPonto.latitude && proximoPonto.longitude) {
        const distancia = calcularDistancia(
          location.coords.latitude,
          location.coords.longitude,
          proximoPonto.latitude,
          proximoPonto.longitude
        );

        setDistanciaAtual(distancia);

        if (distancia > 0.1) {
          Alert.alert(
            'Aviso - Distância do Local',
            `Você está a ${distancia.toFixed(2)} km do ponto ${proximoPonto.sigla}-${proximoPonto.uf}. 
            
  Deseja registrar mesmo assim?`,
            [
              {
                text: 'Cancelar',
                style: 'cancel'
              },
              {
                text: 'Registrar',
                onPress: () => {
                  setSiteCode(proximoPonto.sigla);
                  setUf(proximoPonto.uf);
                  setMotivo('ronda_em_site');
                  setShowCheckpointModal(true);
                }
              }
            ]
          );
          return;
        }
      }

      setSiteCode(proximoPonto.sigla);
      setUf(proximoPonto.uf);
      setMotivo('ronda_em_site');
      setShowCheckpointModal(true);
    } else {
      if (motivo === 'ronda_em_site') {
        setShowCheckpointModal(true);
      } else if (motivo === 'troca_de_veiculo') {
        setShowTrocaVeiculoModal(true);
      } else {
        confirmCheckpoint();
      }
    }
  };

  // Confirmar checkpoint
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

  // Função para lidar com troca de veículo
  const handleTrocaVeiculo = async (dados: {
    kmAtual: string;
    placaAtual: string;
    kmNovo: string;
    placaNovo: string;
    imageUrl?: string;
  }) => {
    if (!rondaId) {
      Alert.alert('Erro', 'Nenhuma ronda ativa encontrada.');
      return;
    }

    try {
      let imageUrl = null;
      if (image) {
        imageUrl = await uploadImage();
      }

      // Criar checkpoint de troca de veículo
      const checkpointData = {
        site: 'TROCA_VEICULO',
        motivo: 'troca_de_veiculo',
        latitude: location?.coords.latitude || 0,
        longitude: location?.coords.longitude || 0,
        timestamp: new Date().toISOString(),
        detalhes: {
          kmAnterior: parseFloat(dados.kmAtual),
          placaAnterior: dados.placaAtual,
          kmNovo: parseFloat(dados.kmNovo),
          placaNovo: dados.placaNovo,
        },
        ...(imageUrl && { imageUrl }),
      };

      const checkpointsRef = collection(otherDb, 'rondas', rondaId, 'checkpoints');
      await addDoc(checkpointsRef, checkpointData);

      // Atualizar a ronda com os novos dados do veículo
      const rondaRef = doc(otherDb, 'rondas', rondaId);
      await updateDoc(rondaRef, {
        ultimaTrocaVeiculo: {
          timestamp: new Date().toISOString(),
          kmAnterior: parseFloat(dados.kmAtual),
          placaAnterior: dados.placaAtual,
          kmNovo: parseFloat(dados.kmNovo),
          placaNovo: dados.placaNovo,
          imagem: imageUrl,
        },
        // Atualizar também os dados atuais da ronda
        placaAtual: dados.placaNovo,
        kmAtual: parseFloat(dados.kmNovo),
      });

      // Atualizar estado local
      setRondaDetails((prev: any) => ({
        ...prev,
        placaAtual: dados.placaNovo,
        kmAtual: parseFloat(dados.kmNovo),
        ultimaTrocaVeiculo: {
          timestamp: new Date().toISOString(),
          kmAnterior: parseFloat(dados.kmAtual),
          placaAnterior: dados.placaAtual,
          kmNovo: parseFloat(dados.kmNovo),
          placaNovo: dados.placaNovo,
          imagem: imageUrl,
        },
      }));

      // Adicionar ao histórico de checkpoints
      setCheckpoints(prev => [...prev, checkpointData]);

      Alert.alert('Sucesso', 'Troca de veículo registrada com sucesso!');
      setShowTrocaVeiculoModal(false);
      setImage(null);
    } catch (error) {
      console.error('Erro ao registrar troca de veículo:', error);
      Alert.alert('Erro', 'Não foi possível registrar a troca de veículo.');
    }
  };

  // Função para calcular distância entre duas coordenadas (fórmula de Haversine)
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Raio da Terra em quilômetros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distancia = R * c; // Distância em quilômetros
    return distancia;
  };

  // Função para verificar se está próximo de um ponto
  const verificarProximidadeDoLocal = (
    localizacaoAtual: { latitude: number; longitude: number } | null,
    pontoAlvo: { latitude: number; longitude: number },
    distanciaMaximaKm: number = 0.1 // 100 metros padrão
  ): boolean => {
    if (!localizacaoAtual) return false;

    const distancia = calcularDistancia(
      localizacaoAtual.latitude,
      localizacaoAtual.longitude,
      pontoAlvo.latitude,
      pontoAlvo.longitude
    );

    return distancia <= distanciaMaximaKm;
  };

  // Função para abrir navegação até o ponto
  const abrirNavegacao = async (ponto: PontoColeta) => {
    if (!ponto.latitude || !ponto.longitude) {
      Alert.alert('Erro', 'Coordenadas do ponto não disponíveis.');
      return;
    }

    const destino = `${ponto.latitude},${ponto.longitude}`;
    const label = `${ponto.sigla}-${ponto.uf}`;

    // URLs para diferentes apps de navegação
    const urls = {
      waze: `https://waze.com/ul?ll=${ponto.latitude},${ponto.longitude}&navigate=yes`,
      googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${ponto.latitude},${ponto.longitude}&travelmode=driving`,
      appleMaps: `http://maps.apple.com/?daddr=${ponto.latitude},${ponto.longitude}&dirflg=d`
    };

    // Mostrar opções para o usuário escolher
    Alert.alert(
      'Navegar até o local',
      `Como deseja navegar até ${label}?`,
      [
        {
          text: 'Waze',
          onPress: async () => {
            try {
              const canOpen = await Linking.canOpenURL(urls.waze);
              if (canOpen) {
                await Linking.openURL(urls.waze);
              } else {
                // Se Waze não estiver instalado, tenta Google Maps
                await Linking.openURL(urls.googleMaps);
              }
            } catch (error) {
              console.error('Erro ao abrir Waze:', error);
              Alert.alert('Erro', 'Não foi possível abrir o Waze.');
            }
          }
        },
        {
          text: 'Google Maps',
          onPress: async () => {
            try {
              await Linking.openURL(urls.googleMaps);
            } catch (error) {
              console.error('Erro ao abrir Google Maps:', error);
              Alert.alert('Erro', 'Não foi possível abrir o Google Maps.');
            }
          }
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
  };

  // Atualize a função de busca manual para usar Geohash
  const buscarSitesProximosManualmente = async () => {
    if (!location) {
      Alert.alert('Erro', 'Localização não disponível.');
      return;
    }

    try {
      setMostrandoAlertaDetecao(true);

      // USAR A NOVA FUNÇÃO COM GEOHASH
      const sitesProximos = await encontrarSitesProximosComGeohash(
        location.coords.latitude,
        location.coords.longitude,
        10 // Buscar mais resultados
      );

      setMostrandoAlertaDetecao(false);

      if (sitesProximos.length > 0) {
        // Usar o mesmo modal de seleção
        setSitesProximosEncontrados(sitesProximos);
        setMostrarSelecaoSites(true);
      } else {
        Alert.alert(
          'Nenhum Site Encontrado',
          'Não há sites ativos dentro de 10km da sua localização.'
        );
      }
    } catch (error) {
      console.error('Erro ao buscar sites:', error);
      setMostrandoAlertaDetecao(false);
      Alert.alert('Erro', 'Não foi possível buscar sites próximos.');
    }
  };

  // Função para encontrar múltiplos sites próximos com Geohash
  const encontrarSitesProximosComGeohash = async (latitude: number, longitude: number, limite: number = 10): Promise<Site[]> => {
    try {
      const center = [latitude, longitude];
      const radiusInM = 10 * 1000; // 10km em metros
      const bounds = geohashQueryBounds(center, radiusInM);

      const promises = bounds.map((bound) => {
        const mapaDeCalorRef = collection(otherDb, 'mapaDeCalor');
        const q = query(
          mapaDeCalorRef,
          where('geohash', '>=', bound[0]),
          where('geohash', '<=', bound[1]),
          where('status', '==', 'ativo')
        );
        return getDocs(q);
      });

      const snapshots = await Promise.all(promises);

      const sitesProximos: Site[] = [];

      for (const snapshot of snapshots) {
        for (const doc of snapshot.docs) {
          const siteData = doc.data();

          if (siteData.latitude && siteData.longitude) {
            const lat = siteData.latitude;
            const lng = siteData.longitude;
            const distanceInKm = distanceBetween([lat, lng], center);

            if (distanceInKm <= 10) {
              sitesProximos.push({
                id: doc.id,
                nome: siteData.nome || '',
                endereco: siteData.endereco || '',
                latitude: lat,
                longitude: lng,
                raio: siteData.raio || 0,
                uf: siteData.uf || '',
                regional: siteData.regional || '',
                status: siteData.status || '',
                createdBy: siteData.createdBy || '',
                idOriginalPerimetro: siteData.idOriginalPerimetro || '',
                dataInicio: siteData.dataInicio || null,
                dataFim: siteData.dataFim || null,
                geohash: siteData.geohash || ''
              });
            }
          }
        }
      }

      // Ordenar por distância e limitar resultados
      sitesProximos.sort((a, b) => {
        const distA = distanceBetween([a.latitude, a.longitude], center);
        const distB = distanceBetween([b.latitude, b.longitude], center);
        return distA - distB;
      });

      return sitesProximos.slice(0, limite);

    } catch (error) {
      console.error('Erro ao buscar múltiplos sites com Geohash:', error);

      // Fallback
      const mapaDeCalorRef = collection(otherDb, 'mapaDeCalor');
      const q = query(mapaDeCalorRef, where('status', '==', 'ativo'));
      const querySnapshot = await getDocs(q);

      const sites: Site[] = [];

      querySnapshot.forEach((doc) => {
        const siteData = doc.data();
        if (siteData.latitude && siteData.longitude) {
          const distancia = calcularDistancia(
            latitude,
            longitude,
            siteData.latitude,
            siteData.longitude
          );

          if (distancia <= 10) {
            sites.push({
              id: doc.id,
              nome: siteData.nome || '',
              endereco: siteData.endereco || '',
              latitude: siteData.latitude,
              longitude: siteData.longitude,
              raio: siteData.raio || 0,
              uf: siteData.uf || '',
              regional: siteData.regional || '',
              status: siteData.status || '',
              createdBy: siteData.createdBy || '',
              idOriginalPerimetro: siteData.idOriginalPerimetro || '',
              dataInicio: siteData.dataInicio || null,
              dataFim: siteData.dataFim || null,
              geohash: siteData.geohash || ''
            });
          }
        }
      });

      sites.sort((a, b) => {
        const distA = calcularDistancia(latitude, longitude, a.latitude, a.longitude);
        const distB = calcularDistancia(latitude, longitude, b.latitude, b.longitude);
        return distA - distB;
      });

      return sites.slice(0, limite);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.welcomeText}>Bem-vindo(a), {user}.</Text>

        {/* Seu botão principal de iniciar ronda */}
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

                  {carregandoRotas ? (
                    <View style={styles.carregandoContainer}>
                      <ActivityIndicator size="large" color="#007BFF" />
                      <Text style={styles.carregandoText}>Carregando rotas...</Text>
                    </View>
                  ) : (
                    <>
                      <ScrollView style={styles.rotasList}>
                        {rotasPreDefinidas.length > 0 ? (
                          rotasPreDefinidas.map(rota => (
                            <TouchableOpacity
                              key={rota.id}
                              style={styles.rotaItem}
                              onPress={() => confirmarRotaSelecionada(rota)}
                            >
                              <Text style={styles.rotaNome}>{rota.nome}</Text>
                              <Text style={styles.rotaPontos}>
                                {rota.pontos.length} pontos • {rota.pontos.map(p => `${p.sigla}-${p.uf}`).join(' → ')}
                              </Text>
                              <Text style={styles.rotaStatus}>
                                {rota.ativa ? 'Ativa' : 'Inativa'}
                              </Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          // No JSX do modal, atualize a mensagem quando não houver rotas:
                          <View style={styles.semRotasContainer}>
                            <MaterialCommunityIcons name="map-marker-off" size={40} color="#999" />
                            <Text style={styles.semRotasText}>Nenhuma rota disponível</Text>
                            <Text style={styles.semRotasSubtext}>
                              Não há rotas pré-definidas cadastradas para o seu usuário.
                              {"\n"}UID: {uid?.substring(0, 8)}...
                            </Text>
                          </View>
                        )}
                      </ScrollView>

                      <TouchableOpacity
                        style={styles.buttonRecarregar}
                        onPress={carregarRotasPreDefinidas}
                        disabled={carregandoRotas}
                      >
                        <MaterialCommunityIcons name="reload" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Recarregar Rotas</Text>
                      </TouchableOpacity>
                    </>
                  )}

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
            // Novas props adicionadas
            onAutoDetect={buscarSitesProximosManualmente}
            location={location}
            modoRota={modoRota}
          />
        </Modal>

        {/* Modal de Seleção de Sites Próximos */}
        <Modal visible={mostrarSelecaoSites} transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>Selecione o Site</Text>
              <Text style={styles.modalSubtitle}>
                {sitesProximosEncontrados.length} site(s) encontrado(s) próximos a você
              </Text>

              <ScrollView style={styles.sitesList}>
                {sitesProximosEncontrados.map((site, index) => {
                  const distancia = distanceBetween(
                    [site.latitude, site.longitude],
                    [location.coords.latitude, location.coords.longitude]
                  );

                  return (
                    <TouchableOpacity
                      key={site.id}
                      style={[
                        styles.siteItem,
                        index === 0 && styles.siteItemMaisProximo
                      ]}
                      onPress={() => selecionarSite(site)}
                    >
                      <View style={styles.siteInfo}>
                        <Text style={styles.siteNome}>
                          {site.nome}-{site.uf}
                          {index === 0 && ' 🏆'}
                        </Text>
                        <Text style={styles.siteEndereco}>{site.endereco}</Text>
                        <Text style={styles.siteDistancia}>
                          📍 {distancia.toFixed(2)} km de distância
                        </Text>
                        {site.regional && (
                          <Text style={styles.siteRegional}>🏢 {site.regional}</Text>
                        )}
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={24}
                        color="#666"
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.button, styles.buttonCancel, { marginTop: 10 }]}
                onPress={() => {
                  setMostrarSelecaoSites(false);
                  setShowCheckpointModal(true);
                }}
              >
                <Text style={styles.buttonText}>Registrar Site Manualmente</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonCancel, { marginTop: 5 }]}
                onPress={() => {
                  setMostrarSelecaoSites(false);
                  setMostrandoAlertaDetecao(false); // Limpar o alerta
                }}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal de Detecção de Sites */}
        <Modal visible={mostrandoAlertaDetecao} transparent={true} animationType="fade">
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { padding: 30 }]}>
              <ActivityIndicator size="large" color="#007BFF" />
              <Text style={[styles.modalTitle, { marginTop: 20, textAlign: 'center' }]}>
                Detectando Site
              </Text>
              <Text style={[styles.modalSubtitle, { textAlign: 'center' }]}>
                Procurando sites próximos na sua localização...
              </Text>

              <TouchableOpacity
                style={[styles.button, styles.buttonCancel, { marginTop: 20 }]}
                onPress={() => setMostrandoAlertaDetecao(false)}
              >
                <Text style={styles.buttonText}>Cancelar Busca</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Troca Veiculo Modal */}
        <TrocaVeiculoModal
          visible={showTrocaVeiculoModal}
          onCancel={() => {
            setShowTrocaVeiculoModal(false);
            setImage(null);
          }}
          onConfirm={handleTrocaVeiculo}
          image={image}
          onTakeImage={takeImage}
          uploading={uploading}
        />

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
        {isTracking && rotaAtiva && proximoPonto && (
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
              <View style={[
                styles.proximoPontoContainer,
                estaProximoDoPonto && styles.proximoPontoContainerProximo
              ]}>
                <Text style={styles.proximoPontoTitle}>
                  {estaProximoDoPonto ? '✅ Próximo Ponto (Perto)' : '📍 Próximo Ponto'}
                </Text>
                <Text style={styles.proximoPonto}>
                  {proximoPonto.sigla}-{proximoPonto.uf} - {proximoPonto.descricao}
                </Text>

                {location && (
                  <View style={styles.distanciaInfo}>
                    <Text style={styles.distanciaText}>
                      Distância: {distanciaAtual.toFixed(2)} km
                    </Text>
                    <Text style={styles.registroPermitidoText}>
                      ✅ Registro permitido de qualquer local
                    </Text>
                    {distanciaAtual > 0.1 && (
                      <Text style={styles.avisoDistanciaText}>
                        ⚠️ Você está longe do local
                      </Text>
                    )}
                  </View>
                )}

                {/* Botão de Navegação */}
                <TouchableOpacity
                  style={styles.navegacaoButton}
                  onPress={() => abrirNavegacao(proximoPonto)}
                  disabled={!proximoPonto.latitude || !proximoPonto.longitude}
                >
                  <MaterialCommunityIcons name="navigation" size={20} color="#fff" />
                  <Text style={styles.navegacaoButtonText}>
                    Navegar até {proximoPonto.sigla}-{proximoPonto.uf}
                  </Text>
                </TouchableOpacity>
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

            {/* Informações do veículo atual */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Veículo Atual:</Text>
              <Text style={styles.detailValue}>
                {rondaDetails.placaAtual || rondaDetails.placaInicial}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>KM Atual:</Text>
              <Text style={styles.detailValue}>
                {rondaDetails.kmAtual || rondaDetails.kmInicial}
              </Text>
            </View>

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

            {/* Histórico de trocas de veículo */}
            {rondaDetails.ultimaTrocaVeiculo && (
              <View style={styles.trocaVeiculoContainer}>
                <Text style={styles.trocaVeiculoTitle}>Última Troca de Veículo</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>De:</Text>
                  <Text style={styles.detailValue}>
                    {rondaDetails.ultimaTrocaVeiculo.placaAnterior} (KM: {rondaDetails.ultimaTrocaVeiculo.kmAnterior})
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Para:</Text>
                  <Text style={styles.detailValue}>
                    {rondaDetails.ultimaTrocaVeiculo.placaNovo} (KM: {rondaDetails.ultimaTrocaVeiculo.kmNovo})
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Data/Hora:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(rondaDetails.ultimaTrocaVeiculo.timestamp).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

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