import {
  View,
  Alert,
  TouchableOpacity,
  Text,
  Modal,
  ScrollView,
  Platform,
  AppState,
  ActivityIndicator,
  Linking,
  AppStateStatus,
} from "react-native";
import { useRouter } from "expo-router";
import { geohashQueryBounds, distanceBetween } from "geofire-common";
import { Picker } from "@react-native-picker/picker";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDoc,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  getDocs,
  limit,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { otherDb, storage, db, firebase } from "@/services/firebaseConfig";
import { useRonda } from "./_layout";
import styles from "@/assets/styles/stylesIndex";
import KmModal from "@/components/modals/KmModal";
import PanicModal from "@/components/modals/PanicModal";
import CheckpointModal from "@/components/modals/CheckpointModal";
import TrocaVeiculoModal from "@/components/modals/TrocaVeiculoModal";

const LOCATION_TASK_NAME = "background-location-task";
const BACKGROUND_FETCH_TASK = "background-fetch-task";
const SITUACOES_SITE_DETECTAVEL = new Set([
  "ATIVO",
  "ATIVO NAO ADQUIRIDO",
  "ATIVO ADQUIRIDO",
  "PREVISTO",
]);

const normalizarTexto = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const parseCoordenada = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const coordenada = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(coordenada) ? coordenada : null;
};

interface Checkpoint {
  site: string;
  motivo: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  comentario?: string;
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
  latitude: number;
  longitude: number;
  ativo: boolean;
}

interface Site {
  id: string;
  nome: string;
  sigla: string;
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
  geohash?: string;
}

// Variável para controle de debounce (foreground)
let ultimaLocalizacaoSalva: {
  timestamp: number;
  lat: number;
  lng: number;
} | null = null;

// Função para verificar se já existe log com o mesmo timestamp e coordenadas
const verificarLogDuplicado = async (
  rondaId: string,
  timestamp: string,
  latitude: number,
  longitude: number,
) => {
  try {
    const logsRef = collection(otherDb, "log_ronda_rota");
    const q = query(
      logsRef,
      where("rondaId", "==", rondaId),
      where("timestamp", "==", timestamp),
      where("latitude", "==", latitude),
      where("longitude", "==", longitude),
      limit(1),
    );

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Erro ao verificar log duplicado:", error);
    return false;
  }
};

// Definição da tarefa de localização em background (ATUALIZADA)
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    if (error.code === "TASK_NOT_REGISTERED") {
      console.log(
        "Tarefa de localização não registrada. Tentando registrar novamente...",
      );
      return;
    }
    console.error("Erro na tarefa de localização em segundo plano:", error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    const location = locations[0];
    if (location) {
      try {
        const rondaId = await AsyncStorage.getItem("rondaId");
        const uid = await AsyncStorage.getItem("userUid");

        if (rondaId && uid) {
          const rondaRef = doc(otherDb, "rondas", rondaId);
          const userRef = doc(otherDb, "usuarios", uid);

          const timestamp = new Date().toISOString();

          console.log("Localização em segundo plano recebida:", timestamp);
          console.log("Lat:", location.coords.latitude);
          console.log("Long:", location.coords.longitude);

          // Verificar se já existe log com esses dados
          const existeDuplicado = await verificarLogDuplicado(
            rondaId,
            timestamp,
            location.coords.latitude,
            location.coords.longitude,
          );

          if (existeDuplicado) {
            console.log("Log duplicado detectado (background), ignorando...");
            return;
          }

          // Criar o log de localização
          const logData = {
            rondaId: rondaId,
            uid: uid,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || null,
            altitude: location.coords.altitude || null,
            speed: location.coords.speed || null,
            heading: location.coords.heading || null,
            timestamp: timestamp,
            source: "background",
            batteryLevel: location.coords.batteryLevel || null,
            appState: AppState.currentState,
          };

          // Salvar no Firestore na coleção log_ronda_rota
          const logRef = collection(otherDb, "log_ronda_rota");
          await addDoc(logRef, logData);

          // Atualizar as outras coleções como antes
          await Promise.all([
            updateDoc(rondaRef, {
              ultimaLocalizacao: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: timestamp,
              },
            }),
            updateDoc(userRef, {
              status_ronda: "Em Ronda",
              ultimaLocalizacao: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: timestamp,
              },
            }),
          ]);

          console.log("Log de localização (background) salvo:", {
            timestamp: timestamp,
            coords: `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`,
          });
        }
      } catch (err) {
        console.error("Erro ao salvar localização em background:", err);
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
    const pendingSync = await AsyncStorage.getItem("pendingSync");
    if (pendingSync) {
      console.log("Sincronizando dados pendentes...");
      await AsyncStorage.removeItem("pendingSync");
    }
  } catch (error) {
    console.error("Erro durante background fetch:", error);
  }

  return BackgroundFetch.BackgroundFetchResult.NewData;
});

export default function HomeScreen() {
  const router = useRouter();
  const { isTracking, setIsTracking } = useRonda();
  const [location, setLocation] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [rondaId, setRondaId] = useState<string | null>(null);
  const [siteCode, setSiteCode] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [user, setUser] = useState<string | null>("");
  const [uid, setUid] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [kmInicial, setKmInicial] = useState<string>("");
  const [kmFinal, setKmFinal] = useState<string>("");
  const [placaInicial, setPlacaInicial] = useState<string>("");
  const [placaFinal, setPlacaFinal] = useState<string>("");
  const [showKmModal, setShowKmModal] = useState<"inicio" | "fim" | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [rondaDetails, setRondaDetails] = useState<any>(null);
  const [uf, setUf] = useState<string>("");
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // Novos estados para rota pré-definida
  const [rotasPreDefinidas, setRotasPreDefinidas] = useState<RotaPreDefinida[]>(
    [],
  );
  const [rotaAtiva, setRotaAtiva] = useState<RotaPreDefinida | null>(null);
  const [proximoPonto, setProximoPonto] = useState<PontoColeta | null>(null);
  const [mostrarSelecaoRota, setMostrarSelecaoRota] = useState(false);
  const [modoRota, setModoRota] = useState<"livre" | "predefinida" | null>(
    null,
  );
  const [showTrocaVeiculoModal, setShowTrocaVeiculoModal] = useState(false);
  const [carregandoRotas, setCarregandoRotas] = useState(false);
  const [siteSelecionadoDaRota, setSiteSelecionadoDaRota] = useState(false);
  const [estaProximoDoPonto, setEstaProximoDoPonto] = useState(false);
  const [distanciaAtual, setDistanciaAtual] = useState<number>(0);
  const [sitesProximosEncontrados, setSitesProximosEncontrados] = useState<
    Site[]
  >([]);
  const [mostrarSelecaoSites, setMostrarSelecaoSites] = useState(false);
  const [mostrandoAlertaDetecao, setMostrandoAlertaDetecao] = useState(false);

  // Referência para o último timestamp salvo
  const ultimoTimestampSalvoRef = useRef<number>(0);

  const selecionarSite = (site: Site) => {
    setSiteCode(site.sigla);
    setUf(site.uf);
    setMotivo("ronda_em_site");
    setMostrarSelecaoSites(false);
    setMostrandoAlertaDetecao(false);
    setShowCheckpointModal(true);
  };

  // Verificar e solicitar permissões
  const checkAndRequestPermissions = useCallback(async () => {
    try {
      // Permissões de câmera
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus.status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso à sua câmera para tirar fotos.",
        );
      }

      // Permissões de localização em foreground
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso à sua localização.",
        );
        return false;
      }

      // Permissões de background no Android
      if (Platform.OS === "android") {
        const { status: backgroundStatus } =
          await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== "granted") {
          Alert.alert(
            "Permissão necessária",
            "Para rastreamento contínuo, precisamos de acesso à sua localização em segundo plano.",
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Abrir Configurações",
                onPress: () => Linking.openSettings(),
              },
            ],
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Erro ao verificar permissões:", error);
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
      console.log("Background fetch registrado com sucesso");
    } catch (err) {
      console.log("Erro ao registrar background fetch:", err);
    }
  }, []);

  // Verificar otimizações de bateria no Android
  const checkBatteryOptimizations = useCallback(async () => {
    if (Platform.OS === "android") {
      try {
        const batteryOptimizationEnabled =
          await Location.hasServicesEnabledAsync();
        if (!batteryOptimizationEnabled) {
          Alert.alert(
            "Modo de Economia Ativo",
            "Para o rastreamento funcionar corretamente, desative as otimizações de bateria para este app nas configurações do dispositivo.",
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Abrir Configurações",
                onPress: () => Linking.openSettings(),
              },
            ],
          );
          return false;
        }
      } catch (error) {
        console.error("Erro ao verificar otimizações de bateria:", error);
      }
    }
    return true;
  }, []);

  // Verificar se o usuário está autenticado no Firebase Auth
  const verificarAuthFirebase = useCallback(async () => {
    console.log("[Auth] Verificando sessão do Firebase...");
    return new Promise<boolean>((resolve) => {
      // Tenta obter o usuário atual imediatamente
      const current = firebase.auth().currentUser;
      if (current) {
        console.log("[Auth] Usuário já autenticado:", current.uid);
        resolve(true);
        return;
      }

      // Se não tiver, aguarda o primeiro evento de mudança de estado
      const unsubscribe = firebase.auth().onAuthStateChanged((user: any) => {
        unsubscribe();
        if (user) {
          console.log("[Auth] Sessão recuperada com sucesso:", user.uid);
          resolve(true);
        } else {
          console.log("[Auth] Nenhuma sessão ativa encontrada no Firebase.");
          resolve(false);
        }
      });

      // Timeout de segurança
      setTimeout(() => {
        unsubscribe();
        const retryUser = firebase.auth().currentUser;
        if (retryUser) {
          resolve(true);
        } else {
          console.log("[Auth] Timeout na verificação de autenticação.");
          resolve(false);
        }
      }, 5000);
    });
  }, []);

  // Carregar dados do usuário
  const userData = useCallback(async () => {
    try {
      const nome = await AsyncStorage.getItem("userName");
      const userUid = await AsyncStorage.getItem("userUid");
      setUser(nome);
      setUid(userUid);
    } catch (error) {
      console.error("Erro ao carregar dados do usuário:", error);
    }
  }, []);

  // Carregar rotas pré-definidas do Firestore filtradas por UID
  const carregarRotasPreDefinidas = useCallback(async () => {
    setCarregandoRotas(true);
    try {
      console.log("Carregando rotas pré-definidas do Firestore...");

      if (!uid) {
        console.log("UID do usuário não disponível");
        setRotasPreDefinidas([]);
        return [];
      }

      console.log("UID do usuário:", uid);

      // Referência para a collection rotas_rondas
      const rotasRef = collection(otherDb, "rotas_rondas");

      // Query para buscar apenas rotas ativas E que tenham o UID do usuário
      const q = query(
        rotasRef,
        where("ativa", "==", true),
        where("uid", "==", uid),
      );

      const querySnapshot = await getDocs(q);

      const rotas: RotaPreDefinida[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Rota encontrada para o usuário:", data.nome);

        const rota: RotaPreDefinida = {
          id: doc.id,
          nome: data.nome || "Rota sem nome",
          ativa: data.ativa || false,
          pontos:
            data.pontos?.map((ponto: any, index: number) => ({
              id: ponto.id || `ponto_${index}`,
              sigla: ponto.sigla || "",
              uf: ponto.uf || "",
              descricao: ponto.descricao || "",
              ordem: ponto.ordem || index + 1,
              concluido: ponto.concluido || false,
              ativo: ponto.concluido !== false,
              timestamp: ponto.timestamp || "",
              imageUrl: ponto.imageUrl || "",
              latitude: ponto.latitude || 0,
              longitude: ponto.longitude || 0,
            })) || [],
        };

        rotas.push(rota);
      });

      console.log(
        `Total de rotas carregadas para o usuário ${uid}: ${rotas.length}`,
      );
      setRotasPreDefinidas(rotas);

      if (rotas.length === 0) {
        console.log("Nenhuma rota encontrada para o UID:", uid);
        Alert.alert(
          "Nenhuma Rota Disponível",
          "Não foram encontradas rotas pré-definidas para o seu usuário.",
        );
      }

      return rotas;
    } catch (error) {
      console.error(
        "Erro ao carregar rotas pré-definidas do Firestore:",
        error,
      );

      if (error instanceof Error) {
        if (
          error.message.includes("permission") ||
          error.message.includes("Permission")
        ) {
          Alert.alert(
            "Erro de Permissão",
            "Não foi possível acessar as rotas. Verifique suas permissões.",
          );
        } else {
          Alert.alert(
            "Erro de Conexão",
            "Não foi possível carregar as rotas do servidor. Verifique sua conexão.",
          );
        }
      }

      setRotasPreDefinidas([]);
      return [];
    } finally {
      setCarregandoRotas(false);
    }
  }, [uid]);

  const buscarUltimoKmPorPlaca = async (uid: string, placa: string) => {
    try {
      const ref = collection(otherDb, "rondas");

      const q = query(
        ref,
        where("uid", "==", uid),
        where("placaFinal", "==", placa),
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const data = snapshot.docs[0].data();

      return data.kmFinal || null;
    } catch (error) {
      console.error("Erro ao buscar último KM:", error);
      return null;
    }
  };

  // Carregar checkpoints da ronda
  const carregarCheckpoints = useCallback(async (rondaId: string) => {
    try {
      console.log("Carregando checkpoints para ronda:", rondaId);

      const checkpointsRef = collection(
        otherDb,
        "rondas",
        rondaId,
        "checkpoints",
      );
      const checkpointsSnapshot = await getDocs(checkpointsRef);

      const checkpointsCarregados: Checkpoint[] = [];
      checkpointsSnapshot.forEach((doc) => {
        const data = doc.data();
        checkpointsCarregados.push({
          site: data.site,
          motivo: data.motivo,
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp,
          comentario: data.comentario,
          imageUrl: data.imageUrl,
        });
      });

      console.log("Checkpoints carregados:", checkpointsCarregados.length);
      setCheckpoints(checkpointsCarregados);

      return checkpointsCarregados;
    } catch (error) {
      console.error("Erro ao carregar checkpoints:", error);
    }
  }, []);

  // Sincronizar checkpoints com a rota ativa
  const sincronizarCheckpointsComRota = useCallback(
    (checkpointsCarregados: Checkpoint[], rota: RotaPreDefinida) => {
      const pontosAtualizados = rota.pontos.map((ponto) => {
        const siteFormatado = `${ponto.sigla}-${ponto.uf}`;
        const temCheckpoint = checkpointsCarregados.some(
          (checkpoint) =>
            checkpoint.site === siteFormatado &&
            checkpoint.motivo === "ronda_em_site",
        );

        return {
          ...ponto,
          concluido: temCheckpoint,
          timestamp: temCheckpoint
            ? checkpointsCarregados.find((c) => c.site === siteFormatado)
              ?.timestamp || ""
            : "",
        };
      });

      const rotaAtualizada = {
        ...rota,
        pontos: pontosAtualizados,
      };

      setRotaAtiva(rotaAtualizada);

      const proximo = pontosAtualizados.find((p) => !p.concluido);
      setProximoPonto(proximo || null);

      console.log("Rota atualizada com checkpoints existentes");
      return rotaAtualizada;
    },
    [],
  );

  // Salvar estado da rota no AsyncStorage
  const salvarEstadoRota = useCallback(async () => {
    try {
      if (rotaAtiva) {
        await AsyncStorage.setItem("rotaAtiva", JSON.stringify(rotaAtiva));
      }
      if (modoRota) {
        await AsyncStorage.setItem("modoRota", modoRota);
      }
    } catch (error) {
      console.error("Erro ao salvar estado da rota:", error);
    }
  }, [rotaAtiva, modoRota]);

  // Limpar estado da rota do AsyncStorage
  const limparEstadoRota = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove(["rotaAtiva", "modoRota"]);
    } catch (error) {
      console.error("Erro ao limpar estado da rota:", error);
    }
  }, []);

  // Função para calcular distância entre duas coordenadas
  const calcularDistancia = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Função para salvar log de localização com verificação de duplicidade
  const salvarLogLocalizacao = useCallback(
    async (
      rondaId: string,
      userId: string,
      location: any,
      source: "foreground" | "background",
    ) => {
      try {
        const timestamp = new Date().toISOString();

        // Verificar se já existe log com esses dados
        const existeDuplicado = await verificarLogDuplicado(
          rondaId,
          timestamp,
          location.coords.latitude,
          location.coords.longitude,
        );

        if (existeDuplicado) {
          console.log("Log duplicado detectado, ignorando...");
          return false;
        }

        const logData = {
          rondaId: rondaId,
          uid: userId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || null,
          altitude: location.coords.altitude || null,
          speed: location.coords.speed || null,
          heading: location.coords.heading || null,
          timestamp: timestamp,
          source: source,
          batteryLevel: location.coords.batteryLevel || null,
          appState: AppState.currentState,
        };

        const logRef = collection(otherDb, "log_ronda_rota");
        await addDoc(logRef, logData);

        console.log(`Log de localização salvo (${source}):`, {
          timestamp: logData.timestamp,
          coords: `${logData.latitude.toFixed(6)}, ${logData.longitude.toFixed(6)}`,
        });

        return true;
      } catch (error) {
        console.error(`Erro ao salvar log de localização (${source}):`, error);
        return false;
      }
    },
    [],
  );

  // Iniciar monitoramento de localização - ATUALIZADA com controle de tempo/distância
  const startLocationTracking = useCallback(
    async (rondaId: string, userId: string) => {
      try {
        const rondaRef = doc(otherDb, "rondas", rondaId);
        const userRef = doc(otherDb, "usuarios", userId);

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 60000, // 1 minuto
            distanceInterval: 50, // 50 metros
          },
          async (loc) => {
            setLocation(loc);

            try {
              const agora = Date.now();
              const distanciaMinima = 50; // metros
              const tempoMinimo = 60000; // 1 minuto

              // Verificar se já salvou uma localização recentemente
              if (ultimaLocalizacaoSalva) {
                const distancia =
                  calcularDistancia(
                    loc.coords.latitude,
                    loc.coords.longitude,
                    ultimaLocalizacaoSalva.lat,
                    ultimaLocalizacaoSalva.lng,
                  ) * 1000; // converter para metros

                const tempoDecorrido = agora - ultimaLocalizacaoSalva.timestamp;

                // Só salvar se passou 1 minuto E se moveu mais de 50 metros
                if (
                  tempoDecorrido < tempoMinimo &&
                  distancia < distanciaMinima
                ) {
                  console.log(
                    "Ignorando localização - menos de 1 minuto e menos de 50 metros de movimento",
                  );
                  return;
                }
              }

              // Salvar log de localização
              await salvarLogLocalizacao(rondaId, userId, loc, "foreground");

              // Atualizar timestamp da última localização salva
              ultimaLocalizacaoSalva = {
                timestamp: agora,
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
              };

              // Atualizar as outras coleções
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
                }),
              ]);

              console.log(
                "Localização atualizada - tempo:",
                Math.round((Date.now() - agora) / 1000),
                "s atrás, distância:",
                ultimaLocalizacaoSalva
                  ? calcularDistancia(
                    loc.coords.latitude,
                    loc.coords.longitude,
                    ultimaLocalizacaoSalva.lat,
                    ultimaLocalizacaoSalva.lng,
                  ) * 1000
                  : 0,
                "metros",
              );
            } catch (err) {
              console.error("Erro ao atualizar localização:", err);
            }
          },
        );

        setSubscription(sub);

        // Iniciar serviço de background com configuração otimizada
        await gerenciarTarefaBackground("iniciar");

        console.log("Monitoramento de localização iniciado");
      } catch (error) {
        console.error("Erro ao iniciar monitoramento de localização:", error);
      }
    },
    [],
  );

  // Verificar ronda ativa
  const verificarRondaAtiva = useCallback(async () => {
    try {
      const rondaSalva = await AsyncStorage.getItem("rondaId");
      const userUid = await AsyncStorage.getItem("userUid");
      const rotaAtivaSalva = await AsyncStorage.getItem("rotaAtiva");
      const modoRotaSalvo = await AsyncStorage.getItem("modoRota");

      if (rondaSalva && userUid) {
        setRondaId(rondaSalva);
        setUid(userUid);
        setIsTracking(true);

        let rotaRecuperada: RotaPreDefinida | null = null;

        // Recuperar detalhes da ronda do Firebase
        const rondaRef = doc(otherDb, "rondas", rondaSalva);
        const rondaDoc = await getDoc(rondaRef);

        if (rondaDoc.exists()) {
          const data = rondaDoc.data();
          setRondaDetails(data);
          
          if (data.kmInicial) setKmInicial(String(data.kmInicial));
          if (data.placaInicial) setPlacaInicial(data.placaInicial);

          // Restaurar modo da rota
          if (modoRotaSalvo) {
            setModoRota(modoRotaSalvo as "livre" | "predefinida");
          } else if (data.modoRota) {
            setModoRota(data.modoRota);
          }

          // Restaurar rota ativa se existir
          if (rotaAtivaSalva && modoRotaSalvo === "predefinida") {
            try {
              const rotaParseada = JSON.parse(rotaAtivaSalva);
              rotaRecuperada = rotaParseada;
              setRotaAtiva(rotaParseada);

              console.log(
                "Rota pré-definida recuperada do AsyncStorage:",
                rotaParseada.nome,
              );
            } catch (error) {
              console.error(
                "Erro ao parsear rota ativa do AsyncStorage:",
                error,
              );
            }
          } else if (data.rotaPreDefinida && modoRotaSalvo === "predefinida") {
            console.log(
              "Tentando recuperar rota do Firestore:",
              data.rotaPreDefinida.id,
            );

            try {
              const rotaDocRef = doc(
                otherDb,
                "rotas_rondas",
                data.rotaPreDefinida.id,
              );
              const rotaDocSnap = await getDoc(rotaDocRef);

              if (rotaDocSnap.exists()) {
                const rotaData = rotaDocSnap.data();

                if (rotaData.uid === userUid && rotaData.ativa) {
                  const rota: RotaPreDefinida = {
                    id: rotaDocSnap.id,
                    nome: rotaData.nome || "Rota sem nome",
                    ativa: rotaData.ativa || false,
                    pontos:
                      rotaData.pontos?.map((ponto: any, index: number) => ({
                        id: ponto.id || `ponto_${index}`,
                        sigla: ponto.sigla || "",
                        uf: ponto.uf || "",
                        descricao: ponto.descricao || "",
                        ordem: ponto.ordem || index + 1,
                        concluido: ponto.concluido || false,
                        timestamp: ponto.timestamp || "",
                        imageUrl: ponto.imageUrl || "",
                      })) || [],
                  };

                  rotaRecuperada = rota;
                  setRotaAtiva(rota);

                  console.log(
                    "Rota pré-definida recuperada do Firestore:",
                    rota.nome,
                  );
                } else {
                  console.log("Rota não pertence ao usuário ou está inativa");
                  setModoRota("livre");
                }
              } else {
                console.log(
                  "Rota não encontrada no Firestore:",
                  data.rotaPreDefinida.id,
                );
                setModoRota("livre");
              }
            } catch (error) {
              console.error("Erro ao recuperar rota do Firestore:", error);
              setModoRota("livre");
            }
          }

          // Carregar checkpoints e sincronizar com rota ativa
          const checkpointsCarregados = await carregarCheckpoints(rondaSalva);

          if (rotaRecuperada && checkpointsCarregados) {
            sincronizarCheckpointsComRota(
              checkpointsCarregados,
              rotaRecuperada,
            );
          }
        }

        // Iniciar monitoramento de localização
        await startLocationTracking(rondaSalva, userUid);

        console.log("Ronda recuperada - Modo:", modoRotaSalvo);
      }
    } catch (error) {
      console.error("Erro ao verificar ronda ativa:", error);
    }
  }, [
    carregarCheckpoints,
    startLocationTracking,
    sincronizarCheckpointsComRota,
    uid,
  ]);

  // Efeito para salvar estado da rota quando mudar
  useEffect(() => {
    if (isTracking && (rotaAtiva || modoRota)) {
      salvarEstadoRota();
    }
  }, [rotaAtiva, modoRota, isTracking, salvarEstadoRota]);

  // Lidar com mudanças no estado do app
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === "active") {
        console.log("App voltou para primeiro plano");

        if (isTracking) {
          const isTaskRegistered =
            await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
          if (!isTaskRegistered) {
            console.log("Tarefa de background não registrada. Reiniciando...");
            if (rondaId && uid) {
              await startLocationTracking(rondaId, uid);
            }
          }
        }
      }

      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [appState, isTracking, rondaId, uid, startLocationTracking]);

  // Efeito inicial
  useEffect(() => {
    const initialize = async () => {
      console.log("[Init] Iniciando aplicação...");
      
      // 1. Verificar autenticação no Firebase
      const estaAutenticado = await verificarAuthFirebase();
      
      if (!estaAutenticado) {
        const loggedIn = await AsyncStorage.getItem("loggedIn");
        if (loggedIn === "true") {
          console.log("[Init] Usuário acha que está logado mas Firebase não confirma. Redirecionando...");
          Alert.alert(
            "Sessão Expirada",
            "Sua sessão de segurança expirou. Por favor, faça login novamente para continuar.",
            [
              {
                text: "Ok",
                onPress: async () => {
                  await AsyncStorage.removeItem("loggedIn");
                  router.replace("/(auth)/login");
                },
              },
            ],
          );
          return;
        }
      }

      await registerBackgroundTasks();
      await checkAndRequestPermissions();
      await userData();
      await carregarRotasPreDefinidas();
      await verificarRondaAtiva();
    };

    initialize();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // Efeito para recarregar rotas quando o UID mudar
  useEffect(() => {
    if (uid) {
      console.log("UID carregado, recarregando rotas...");
      carregarRotasPreDefinidas();
    }
  }, [uid, carregarRotasPreDefinidas]);

  // Verificar proximidade do ponto atual
  useEffect(() => {
    if (isTracking && location && proximoPonto && modoRota === "predefinida") {
      const proximoPontoComCoordenadas = proximoPonto as PontoColeta;

      if (
        proximoPontoComCoordenadas.latitude &&
        proximoPontoComCoordenadas.longitude
      ) {
        const estaProximo = verificarProximidadeDoLocal(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          {
            latitude: proximoPontoComCoordenadas.latitude,
            longitude: proximoPontoComCoordenadas.longitude,
          },
          0.1,
        );

        const distancia = calcularDistancia(
          location.coords.latitude,
          location.coords.longitude,
          proximoPontoComCoordenadas.latitude,
          proximoPontoComCoordenadas.longitude,
        );

        setEstaProximoDoPonto(estaProximo);
        setDistanciaAtual(distancia);

        if (estaProximo && !proximoPontoComCoordenadas.concluido) {
          console.log(
            `Próximo do ponto ${proximoPonto.sigla}-${proximoPonto.uf}`,
          );
        }
      }
    }
  }, [location, proximoPonto, isTracking, modoRota]);

  // Efeito para limpar estados quando modais forem fechados
  useEffect(() => {
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
      console.error("Erro ao tirar foto:", error);
      Alert.alert("Erro", "Não foi possível acessar a câmera.");
    }
  };

  // Upload de imagem
  const uploadImage = async () => {
    if (!image) return null;

    setUploading(true);
    try {
      const response = await fetch(image);
      const blob = await response.blob();
      const storageRef = ref(
        storage,
        `checkpoints/${rondaId}/${Date.now()}.jpg`,
      );
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error) {
      console.error("Erro no upload:", error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Função auxiliar para gerenciar tarefas de background
  const gerenciarTarefaBackground = async (acao: "iniciar" | "parar") => {
    try {
      const isTaskRegistered =
        await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

      if (acao === "iniciar" && !isTaskRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced, // Reduzir precisão em background
          timeInterval: 120000, // 2 minutos em background
          distanceInterval: 100, // 100 metros em background
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "🚀 Em Ronda",
            notificationBody: "Sua localização está sendo registrada",
            notificationColor: "#4b0082",
          },
        });
        console.log("Tarefa de background iniciada");
      } else if (acao === "parar" && isTaskRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log("Tarefa de background parada");
      }
    } catch (error) {
      console.error(`Erro ao ${acao} tarefa de background:`, error);

      if (
        error instanceof Error &&
        error.message.includes("TaskNotFoundException")
      ) {
        console.log("Tarefa não encontrada - provavelmente já foi removida");
      } else if (acao === "parar") {
        try {
          await BackgroundFetch.unregisterTaskAsync(LOCATION_TASK_NAME);
          console.log("Tarefa forçadamente removida");
        } catch (unregisterError) {
          console.error("Erro ao forçar remoção da tarefa:", unregisterError);
        }
      }
    }
  };

  // Função para verificar se está próximo de um ponto
  const verificarProximidadeDoLocal = (
    localizacaoAtual: { latitude: number; longitude: number } | null,
    pontoAlvo: { latitude: number; longitude: number },
    distanciaMaximaKm: number = 0.1,
  ): boolean => {
    if (!localizacaoAtual) return false;

    const distancia = calcularDistancia(
      localizacaoAtual.latitude,
      localizacaoAtual.longitude,
      pontoAlvo.latitude,
      pontoAlvo.longitude,
    );

    return distancia <= distanciaMaximaKm;
  };

  // Iniciar ronda
  const startTracking = async () => {
    const permissionsGranted = await checkAndRequestPermissions();
    if (!permissionsGranted) return;

    const batteryOk = await checkBatteryOptimizations();
    if (!batteryOk) return;

    setMostrarSelecaoRota(true);
  };

  // Selecionar modo de rota
  const selecionarModoRota = (modo: "livre" | "predefinida") => {
    setModoRota(modo);

    if (modo === "predefinida") {
      setMostrarSelecaoRota(true);
    } else {
      setMostrarSelecaoRota(false);
      setShowKmModal("inicio");
    }
  };

  // Confirmar rota selecionada
  const confirmarRotaSelecionada = (rota: RotaPreDefinida) => {
    setRotaAtiva(rota);
    setProximoPonto(rota.pontos[0]);
    setMostrarSelecaoRota(false);
    setShowKmModal("inicio");
  };

  // Avançar para próximo ponto
  const avancarParaProximoPonto = async () => {
    if (!rotaAtiva || !proximoPonto) return;

    try {
      const pontosAtualizados = rotaAtiva.pontos.map((ponto) =>
        ponto.id === proximoPonto.id
          ? {
            ...ponto,
            concluido: true,
            ativo: false,
            timestamp: new Date().toISOString(),
          }
          : ponto,
      );

      const rotaAtualizada = {
        ...rotaAtiva,
        pontos: pontosAtualizados,
      };

      setRotaAtiva(rotaAtualizada);

      const proximo = pontosAtualizados.find((p) => !p.concluido);

      if (proximo) {
        setProximoPonto(proximo);
        Alert.alert(
          "Próximo Ponto",
          `Siga para: ${proximo.sigla}-${proximo.uf} - ${proximo.descricao}`,
        );
      } else {
        setProximoPonto(null);
        Alert.alert(
          "Rota Concluída",
          "Todos os pontos da rota foram visitados!",
        );
      }
    } catch (error) {
      console.error("Erro ao avançar para próximo ponto:", error);
    }
  };

  const normalizarPlaca = (placa: string) =>
    placa.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  const validarKmComBaseNoUsuario = async (
    uid: string,
    placaDigitada: string,
    kmDigitado: number,
  ): Promise<boolean> => {
    try {
      const userRef = doc(otherDb, "usuarios", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) return true;

      const userData = userSnap.data();

      const ultimaPlaca = userData.ultimaPlaca;
      const ultimoKm = Number(userData.ultimoKm);

      const ultimaPlacaNormalizada = normalizarPlaca(ultimaPlaca || "");
      const placaDigitadaNormalizada = normalizarPlaca(placaDigitada);

      // MESMA PLACA → VALIDAR KM
      if (
        ultimaPlacaNormalizada &&
        ultimaPlacaNormalizada === placaDigitadaNormalizada &&
        !isNaN(ultimoKm)
      ) {
        if (kmDigitado < ultimoKm) {
          Alert.alert(
            "Erro de Quilometragem",
            `KM (${kmDigitado}) menor que o último registrado (${ultimoKm}) para a placa ${ultimaPlaca}`,
          );
          return false;
        }
      }

      // PLACA DIFERENTE → libera

      return true;
    } catch (error) {
      console.error("Erro ao validar KM do usuário:", error);
      return true;
    }
  };

  // Confirmar início da ronda
  const confirmStartTracking = async () => {
    if (!kmInicial || !placaInicial) {
      Alert.alert(
        "Erro",
        "Por favor, informe a quilometragem inicial e a placa do veículo.",
      );
      return;
    }

    if (!uid) {
      Alert.alert("Erro", "UID do usuário não encontrado.");
      return;
    }

    try {
      const kmInicialNumero = Number(kmInicial);

      const continuar = await validarKmComBaseNoUsuario(
        uid,
        placaInicial,
        kmInicialNumero,
      );

      if (!continuar) return;

      const novaRondaId = `ronda_${new Date().getTime()}`;
      const rondaRef = doc(otherDb, "rondas", novaRondaId);
      const userRef = doc(otherDb, "usuarios", uid);

      // const local = await obterMunicipioAtual(
      //location.coords.latitude,
      // location.coords.longitude
      // );

      //let municipioBase = null;

      //if (local) {
      //municipioBase = normalizarTexto(`${local.municipio}-${local.uf}`);
      //console.log("📍 Município inicial:", municipioBase);
      // }

      const imageUrl = await uploadImage();

      const rondaData = {
        nomeRonda: `Ronda_${new Date().toLocaleString()}`,
        inicio: new Date().toISOString(),
        kmInicial: kmInicialNumero,
        placaInicial,
        ultimaLocalizacao: null,
        uid: uid,
        timestamp: new Date().toISOString(),
        imagemInicial: imageUrl,
        modoRota: modoRota,
        //municipioBase,
        //municipiosPercorridos: municipioBase ? [municipioBase] : [],
        //saiuDoMunicipio: null,
        ...(rotaAtiva && {
          rotaPreDefinida: {
            id: rotaAtiva.id,
            nome: rotaAtiva.nome,
            pontosTotais: rotaAtiva.pontos.length,
          },
        }),
      };

      await setDoc(rondaRef, rondaData);

      setRondaId(novaRondaId);
      setRondaDetails(rondaData);
      setIsTracking(true);
      setShowKmModal(null);
      setCheckpoints([]);
      setImage(null);

      await AsyncStorage.setItem("rondaId", novaRondaId);
      await AsyncStorage.setItem("kmInicial", String(kmInicialNumero));
      await AsyncStorage.setItem("placaInicial", placaInicial);
      await salvarEstadoRota();

      // Reset da variável de controle
      ultimaLocalizacaoSalva = null;

      // Iniciar monitoramento de localização
      await startLocationTracking(novaRondaId, uid);

      if (modoRota === "predefinida" && rotaAtiva && proximoPonto) {
        Alert.alert(
          "Rota Iniciada",
          `Rota "${rotaAtiva.nome}" iniciada. Primeiro ponto: ${proximoPonto.sigla}-${proximoPonto.uf}`,
        );
      } else {
        Alert.alert(
          "Ronda Iniciada",
          "Modo de rota livre ativado. Você pode registrar checkpoints livremente.",
        );
      }
    } catch (error) {
      console.error("Erro ao iniciar rastreamento:", error);
      Alert.alert("Erro", "Não foi possível iniciar o rastreamento.");
    }
  };

  // Parar ronda
  const stopTracking = async () => {
    console.log("DEBUG - stopTracking chamado. kmInicial no estado:", kmInicial);
    setShowKmModal("fim");
  };

  // Confirmar parada da ronda
  const confirmStopTracking = async () => {
    if (!kmFinal || !placaFinal) {
      Alert.alert(
        "Erro",
        "Por favor, informe a quilometragem final e a placa do veículo.",
      );
      return;
    }

    if (Number(kmFinal) <= Number(kmInicial)) {
      Alert.alert(
        "Erro",
        "A quilometragem final não pode ser menor que a quilometragem inicial.",
      );
      return;
    }

    try {
      if (subscription) {
        subscription.remove();
        setSubscription(null);
      }

      setIsTracking(false);

      await gerenciarTarefaBackground("parar");
      const userUid = await AsyncStorage.getItem("userUid");
      if (rondaId && userUid) {
        const rondaRef = doc(otherDb, "rondas", rondaId);
        const userRef = doc(otherDb, "usuarios", userUid);

        const distanciaPercorrida = Number(kmFinal) - Number(kmInicial);
        const imageUrl = await uploadImage();

        const pontosConcluidos = rotaAtiva
          ? rotaAtiva.pontos.filter((p) => p.concluido).length
          : 0;

        await Promise.all([
          updateDoc(rondaRef, {
            fim: new Date().toISOString(),
            kmFinal: Number(kmFinal),
            placaFinal,
            distanciaPercorrida,
            imagemFinal: imageUrl,
            ...(rotaAtiva && {
              rotaPreDefinida: {
                id: rotaAtiva.id,
                nome: rotaAtiva.nome,
                pontosTotais: rotaAtiva.pontos.length,
                pontosConcluidos: pontosConcluidos,
              },
            }),
          }),
          updateDoc(userRef, {
            status_ronda: "Parado",
            ultimoKm: Number(kmFinal) || 0,
            ultimaPlaca: placaFinal,
            ultimaAtualizacaoKm: new Date().toISOString(),
          }),
        ]);

        setRondaDetails((prev: any) => ({
          ...prev,
          fim: new Date().toISOString(),
          kmFinal: Number(kmFinal),
          placaFinal,
          distanciaPercorrida,
          imagemFinal: imageUrl,
        }));
      }

      // Limpar variável de controle
      ultimaLocalizacaoSalva = null;

      setTimeout(() => {
        setRondaId(null);
        setRondaDetails(null);
        setKmInicial("");
        setKmFinal("");
        setPlacaInicial("");
        setPlacaFinal("");
        setShowKmModal(null);
        setCheckpoints([]);
        setImage(null);
        setRotaAtiva(null);
        setProximoPonto(null);
        setModoRota(null);
      }, 1000);

      await AsyncStorage.multiRemove([
        "rondaId",
        "kmInicial",
        "placaInicial",
        "modoRota",
      ]);
      await limparEstadoRota();

      Alert.alert("Sucesso", "Ronda finalizada com sucesso!");
    } catch (error) {
      console.error("Erro ao parar rastreamento:", error);

      if (
        error instanceof Error &&
        error.message.includes("TaskNotFoundException")
      ) {
        console.log("Tarefa já foi removida, continuando processo...");
      } else {
        Alert.alert(
          "Aviso",
          "Ronda finalizada, mas houve um problema ao parar alguns serviços.",
        );
      }
    }
  };

  const handleCheckpoint = async () => {
    if (!rondaId || !location) {
      Alert.alert("Erro", "Certifique-se de que o GPS está ativo.");
      return;
    }

    // Se estiver no modo livre e o motivo for "ronda_em_site", detectar site automaticamente
    if (modoRota === "livre" && motivo === "ronda_em_site" && !proximoPonto) {
      try {
        setMostrandoAlertaDetecao(true);

        const sitesProximos = await encontrarSitesProximosComGeohash(
          location.coords.latitude,
          location.coords.longitude,
          10,
        );

        setMostrandoAlertaDetecao(false);

        if (sitesProximos.length > 0) {
          setSitesProximosEncontrados(sitesProximos);

          if (sitesProximos.length === 1) {
            const siteProximo = sitesProximos[0];
            setSiteCode(siteProximo.nome);
            setUf(siteProximo.uf);
            setMotivo("ronda_em_site");

            const distancia = distanceBetween(
              [siteProximo.latitude, siteProximo.longitude],
              [location.coords.latitude, location.coords.longitude],
            );

            Alert.alert(
              "Site Detectado",
              `Site mais próximo encontrado:\n\n${siteProximo.nome}-${siteProximo.uf}\n${siteProximo.endereco}\n\nDistância: ${distancia.toFixed(2)}km`,
              [
                {
                  text: "Usar Outro Site",
                  style: "cancel",
                  onPress: () => setShowCheckpointModal(true),
                },
                {
                  text: "Confirmar",
                  onPress: () => setShowCheckpointModal(true),
                },
              ],
            );
          } else {
            setMostrarSelecaoSites(true);
          }
        } else {
          Alert.alert(
            "Nenhum Site Próximo",
            "Não foi encontrado nenhum site ativo dentro de 10km da sua localização. Você pode registrar manualmente.",
            [
              {
                text: "Registrar Manualmente",
                onPress: () => setShowCheckpointModal(true),
              },
              {
                text: "Cancelar",
                style: "cancel",
              },
            ],
          );
        }
        return;
      } catch (error) {
        console.error("Erro ao detectar site:", error);
        setMostrandoAlertaDetecao(false);
        setShowCheckpointModal(true);
      }
    }

    // Comportamento original para outros casos
    if (proximoPonto) {
      if (
        !siteSelecionadoDaRota &&
        modoRota !== "predefinida" &&
        proximoPonto.latitude &&
        proximoPonto.longitude
      ) {
        const distancia = calcularDistancia(
          location.coords.latitude,
          location.coords.longitude,
          proximoPonto.latitude,
          proximoPonto.longitude,
        );

        setDistanciaAtual(distancia);

        if (distancia > 0.1) {
          Alert.alert(
            "Aviso - Distância do Local",
            `Você está a ${distancia.toFixed(2)} km do ponto ${proximoPonto.sigla}-${proximoPonto.uf}. 
            
  Deseja registrar mesmo assim?`,
            [
              {
                text: "Cancelar",
                style: "cancel",
              },
              {
                text: "Registrar",
                onPress: () => {
                  if (!siteCode || !uf) {
                    setSiteCode(proximoPonto.sigla);
                    setUf(proximoPonto.uf);
                    setMotivo("ronda_em_site");
                  }
                  setShowCheckpointModal(true);
                },
              },
            ],
          );
          return;
        }
      }

      if (!siteCode || !uf) {
        setSiteCode(proximoPonto.sigla);
        setUf(proximoPonto.uf);
        setMotivo("ronda_em_site");
      }
      setShowCheckpointModal(true);
    } else {
      if (motivo === "ronda_em_site") {
        setShowCheckpointModal(true);
      } else if (motivo === "troca_de_veiculo") {
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
      if ((motivo === "ronda_em_site" || proximoPonto) && image) {
        imageUrl = await uploadImage();
      }

      const site = proximoPonto
        ? `${proximoPonto.sigla}-${proximoPonto.uf}`
        : `${siteCode.toUpperCase()}-${uf}`;

      const checkpointData = {
        site,
        motivo: proximoPonto ? "ronda_em_site" : motivo,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        comentario: comment,
        ...(imageUrl && { imageUrl }),
      };

      const checkpointsRef = collection(
        otherDb,
        "rondas",
        rondaId,
        "checkpoints",
      );
      await addDoc(checkpointsRef, checkpointData);

      setCheckpoints((prev) => [...prev, checkpointData]);

      if (proximoPonto) {
        await avancarParaProximoPonto();
        await salvarEstadoRota();
      }

      Alert.alert("Checkpoint adicionado", `Site ${site} salvo com sucesso.`);
      setSiteCode("");
      setUf("");
      setMotivo("");
      setImage(null);
      setComment("");
      setSiteSelecionadoDaRota(false);
      setShowCheckpointModal(false);
    } catch (error) {
      console.error("Erro ao adicionar checkpoint:", error);
      Alert.alert("Erro", "Não foi possível salvar o checkpoint.");
    }
  };

  // Botão de pânico
  const handlePanicButton = () => {
    setShowPanicModal(true);
  };

  // Confirmar checkpoint de pânico
  const confirmPanicCheckpoint = async () => {
    if (!rondaId || !location || !siteCode.trim() || !uf.trim()) {
      Alert.alert(
        "Erro",
        "Informe a sigla do site, a UF e certifique-se de que o GPS está ativo.",
      );
      return;
    }

    try {
      let imageUrl = null;
      if (image) {
        imageUrl = await uploadImage();
      }

      const checkpointData = {
        site: `${siteCode.toUpperCase()}-${uf}`,
        motivo: "reporte_de_incidencia",
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        ...(imageUrl && { imageUrl }),
      };

      const checkpointsRef = collection(
        otherDb,
        "rondas",
        rondaId,
        "checkpoints",
      );
      await addDoc(checkpointsRef, checkpointData);

      setCheckpoints((prev) => [...prev, checkpointData]);

      Alert.alert(
        "Reporte de Incidencia registrado",
        "Checkpoint de Reporte de Incidencia salvo com sucesso.",
      );
      setShowPanicModal(false);
      setSiteCode("");
      setUf("");
      setImage(null);
    } catch (error) {
      console.error(
        "Erro ao adicionar checkpoint de Reporte de Incidencia:",
        error,
      );
      Alert.alert(
        "Erro",
        "Não foi possível salvar o checkpoint de Reporte de Incidencia.",
      );
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
      Alert.alert("Erro", "Nenhuma ronda ativa encontrada.");
      return;
    }

    try {
      let imageUrl = null;
      if (image) {
        imageUrl = await uploadImage();
      }

      const checkpointData = {
        site: "TROCA_VEICULO",
        motivo: "troca_de_veiculo",
        latitude: location?.coords.latitude || 0,
        longitude: location?.coords.longitude || 0,
        timestamp: new Date().toISOString(),
        detalhes: {
          kmAnterior: Number(dados.kmAtual),
          placaAnterior: dados.placaAtual,
          kmNovo: Number(dados.kmNovo),
          placaNovo: dados.placaNovo,
        },
        ...(imageUrl && { imageUrl }),
      };

      const checkpointsRef = collection(
        otherDb,
        "rondas",
        rondaId,
        "checkpoints",
      );
      await addDoc(checkpointsRef, checkpointData);

      const rondaRef = doc(otherDb, "rondas", rondaId);
      await updateDoc(rondaRef, {
        ultimaTrocaVeiculo: {
          timestamp: new Date().toISOString(),
          kmAnterior: Number(dados.kmAtual),
          placaAnterior: dados.placaAtual,
          kmNovo: Number(dados.kmNovo),
          placaNovo: dados.placaNovo,
          imagem: imageUrl,
        },
        placaAtual: dados.placaNovo,
        kmAtual: Number(dados.kmNovo),
      });

      setRondaDetails((prev: any) => ({
        ...prev,
        placaAtual: dados.placaNovo,
        kmAtual: Number(dados.kmNovo),
        ultimaTrocaVeiculo: {
          timestamp: new Date().toISOString(),
          kmAnterior: Number(dados.kmAtual),
          placaAnterior: dados.placaAtual,
          kmNovo: Number(dados.kmNovo),
          placaNovo: dados.placaNovo,
          imagem: imageUrl,
        },
      }));

      setCheckpoints((prev) => [...prev, checkpointData]);

      Alert.alert("Sucesso", "Troca de veículo registrada com sucesso!");
      setShowTrocaVeiculoModal(false);
      setImage(null);
    } catch (error) {
      console.error("Erro ao registrar troca de veículo:", error);
      Alert.alert("Erro", "Não foi possível registrar a troca de veículo.");
    }
  };

  // Função para abrir navegação até o ponto
  const abrirNavegacao = async (ponto: PontoColeta) => {
    if (!ponto.latitude || !ponto.longitude) {
      Alert.alert("Erro", "Coordenadas do ponto não disponíveis.");
      return;
    }

    const destino = `${ponto.latitude},${ponto.longitude}`;
    const label = `${ponto.sigla}-${ponto.uf}`;

    const urls = {
      waze: `https://waze.com/ul?ll=${ponto.latitude},${ponto.longitude}&navigate=yes`,
      googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${ponto.latitude},${ponto.longitude}&travelmode=driving`,
      appleMaps: `http://maps.apple.com/?daddr=${ponto.latitude},${ponto.longitude}&dirflg=d`,
    };

    Alert.alert("Navegar até o local", `Como deseja navegar até ${label}?`, [
      {
        text: "Waze",
        onPress: async () => {
          try {
            const canOpen = await Linking.canOpenURL(urls.waze);
            if (canOpen) {
              await Linking.openURL(urls.waze);
            } else {
              await Linking.openURL(urls.googleMaps);
            }
          } catch (error) {
            console.error("Erro ao abrir Waze:", error);
            Alert.alert("Erro", "Não foi possível abrir o Waze.");
          }
        },
      },
      {
        text: "Google Maps",
        onPress: async () => {
          try {
            await Linking.openURL(urls.googleMaps);
          } catch (error) {
            console.error("Erro ao abrir Google Maps:", error);
            Alert.alert("Erro", "Não foi possível abrir o Google Maps.");
          }
        },
      },
      {
        text: "Cancelar",
        style: "cancel",
      },
    ]);
  };

  // Função para selecionar um site da rota e fazer checkpoint
  const selecionarSiteDaRota = (ponto: PontoColeta) => {
    if (ponto.concluido) {
      Alert.alert(
        "Site já concluído",
        `O site ${ponto.sigla}-${ponto.uf} já foi registrado.`,
      );
      return;
    }

    setSiteCode(ponto.sigla);
    setUf(ponto.uf);
    setMotivo("ronda_em_site");
    setProximoPonto(ponto);
    setSiteSelecionadoDaRota(true);
  };

  // Atualize a função de busca manual para usar Geohash
  const buscarSitesProximosManualmente = async () => {
    if (!location) {
      Alert.alert("Erro", "Localização não disponível.");
      return;
    }

    try {
      setMostrandoAlertaDetecao(true);

      const sitesProximos = await encontrarSitesProximosComGeohash(
        location.coords.latitude,
        location.coords.longitude,
        10,
      );

      setMostrandoAlertaDetecao(false);

      if (sitesProximos.length > 0) {
        setSitesProximosEncontrados(sitesProximos);
        setMostrarSelecaoSites(true);
      } else {
        Alert.alert(
          "Nenhum Site Encontrado",
          "Não há sites ativos dentro de 10km da sua localização.",
        );
      }
    } catch (error) {
      console.error("Erro ao buscar sites:", error);
      setMostrandoAlertaDetecao(false);
      Alert.alert("Erro", "Não foi possível buscar sites próximos.");
    }
  };

  // Função para encontrar múltiplos sites próximos com Geohash
  const encontrarSitesProximosComGeohash = async (
    latitude: number,
    longitude: number,
    limite: number = 10,
  ): Promise<Site[]> => {
    const center: [number, number] = [latitude, longitude];
    const radiusInM = 10 * 1000;
    const bounds = geohashQueryBounds(center, radiusInM);
    const sitesRef = collection(db, "sites");
    const sitesProximos: Site[] = [];
    const seen = new Set<string>();
    const startTime = Date.now();

    console.log(`[Audit] Iniciando busca de sites: [${latitude}, ${longitude}]`);

    const adicionarSiteSeProximo = (
      docSnap: QueryDocumentSnapshot<DocumentData>,
    ) => {
      try {
        if (seen.has(docSnap.id)) return;
        seen.add(docSnap.id);
        const siteData = docSnap.data();
        const lat = parseCoordenada(siteData.Latitude ?? siteData.latitude ?? siteData.Latitude_GVT);
        const lng = parseCoordenada(siteData.Longitude ?? siteData.longitude ?? siteData.Longitude_GVT);

        if (lat === null || lng === null) return;

        const situacao = String(
          siteData.Situacao ?? siteData.situacao ?? siteData.status ?? "",
        ).trim();
        const situacaoNormalizada = normalizarTexto(situacao);
        if (!SITUACOES_SITE_DETECTAVEL.has(situacaoNormalizada)) return;

        const distanceInKm = distanceBetween([lat, lng], center);

        if (distanceInKm <= 10) {
          sitesProximos.push({
            id: docSnap.id,
            nome: siteData.Nome || "",
            sigla: siteData.Sigla || "",
            endereco: siteData.Endereco || "",
            latitude: lat,
            longitude: lng,
            raio: siteData.raio || 0,
            uf: siteData.Estado || "",
            regional: siteData.Regional || "",
            status: situacao,
            createdBy: siteData.createdBy || siteData.created || "",
            idOriginalPerimetro: siteData.idOriginalPerimetro || "",
            dataInicio: siteData.dataInicio || siteData.lastUpdate || null,
            dataFim: siteData.dataFim || null,
            geohash: siteData.geohash || "",
          });
        }
      } catch (err) {
        console.error(`[Audit] Erro ao processar documento ${docSnap.id}:`, err);
      }
    };

    try {
      // 1. Busca por Geohash
      try {
        const geohashStartTime = Date.now();
        const promises = bounds.map((bound) => {
          const q = query(
            sitesRef,
            orderBy("geohash"),
            startAt(bound[0]),
            endAt(bound[1]),
            limit(50),
          );
          return getDocs(q);
        });
        const snapshots = await Promise.all(promises);
        const geohashDuration = Date.now() - geohashStartTime;
        console.log(`[Audit] Geohash finalizado em ${geohashDuration}ms. Docs encontrados: ${snapshots.reduce((acc, s) => acc + s.size, 0)}`);

        for (const snapshot of snapshots) {
          snapshot.docs.forEach(adicionarSiteSeProximo);
        }
      } catch (geohashError: any) {
        console.error("[Audit] Erro na busca por geohash:", geohashError);
        // Propaga o erro se for de permissão para que o catch externo trate
        if (geohashError?.message?.includes("permissions") || geohashError?.code === "permission-denied") {
          throw geohashError;
        }
      }

      // 3. Verificação de Dados (Fallback temporário para teste)
      if (sitesProximos.length === 0) {
        console.log("[Audit] Nenhum site próximo encontrado. Buscando 10 primeiros para verificação...");
        try {
          const verificationQuery = query(sitesRef, limit(10));
          const verificationSnapshot = await getDocs(verificationQuery);
          console.log(`[Audit] Verificação: Encontrados ${verificationSnapshot.size} sites aleatórios.`);

          verificationSnapshot.docs.forEach((docSnap) => {
            if (seen.has(docSnap.id)) return;
            seen.add(docSnap.id);
            const siteData = docSnap.data();
            const lat = parseCoordenada(siteData.Latitude ?? siteData.latitude ?? siteData.Latitude_GVT) || 0;
            const lng = parseCoordenada(siteData.Longitude ?? siteData.longitude ?? siteData.Longitude_GVT) || 0;

            sitesProximos.push({
              id: docSnap.id,
              nome: siteData.Nome || "SEM NOME",
              sigla: siteData.Sigla || "SEM SIGLA",
              endereco: siteData.Endereco || "SEM ENDERECO",
              latitude: lat,
              longitude: lng,
              raio: siteData.raio || 0,
              uf: siteData.Estado || "",
              regional: siteData.Regional || "",
              status: String(siteData.Situacao ?? "SEM STATUS"),
              createdBy: siteData.createdBy || "",
              idOriginalPerimetro: siteData.idOriginalPerimetro || "",
              dataInicio: siteData.dataInicio || null,
              dataFim: siteData.dataFim || null,
              geohash: siteData.geohash || "",
            });
          });
        } catch (verificationError: any) {
          console.error("[Audit] Erro na verificação de sites:", verificationError);
          // Propaga o erro se for de permissão para que o catch externo trate
          if (verificationError?.message?.includes("permissions") || verificationError?.code === "permission-denied") {
            throw verificationError;
          }
        }
      }

      const totalDuration = Date.now() - startTime;
      console.log(`[Audit] Busca completa finalizada em ${totalDuration}ms. Sites encontrados: ${sitesProximos.length}`);

      sitesProximos.sort((a, b) => {
        const distA = distanceBetween([a.latitude, a.longitude], center);
        const distB = distanceBetween([b.latitude, b.longitude], center);
        return distA - distB;
      });

      return sitesProximos.slice(0, limite);
    } catch (error: any) {
      console.error("[Audit] Erro crítico em encontrarSitesProximosComGeohash:", error);
      
      // Se o erro for de permissão insuficiente, redirecionar para login para re-autenticar
      if (error?.message?.includes("Missing or insufficient permissions") || 
          error?.code === "permission-denied") {
        console.log("[Audit] Erro de permissão detectado. Redirecionando para login...");
        Alert.alert(
          "Sessão Expirada",
          "Sua sessão parece ter expirado ou você não tem permissão para acessar estes dados. Por favor, faça login novamente.",
          [
            {
              text: "Ir para Login",
              onPress: async () => {
                await AsyncStorage.removeItem("loggedIn");
                router.replace("/(auth)/login");
              }
            }
          ]
        );
      }
      
      return [];
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.welcomeText}>Bem-vindo(a), {user}.</Text>

        {isTracking ? (
          <TouchableOpacity
            style={[styles.button, styles.buttonStop]}
            onPress={stopTracking}
            disabled={uploading}
          >
            <Text style={styles.buttonText}>Finalizar Ronda</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.rondaSelectionContainer}>
            <Text style={styles.sectionTitle}>Iniciar Ronda</Text>
            <View style={styles.rondaButtonsRow}>
              <TouchableOpacity
                style={[styles.modoRotaButtonHome, { borderColor: "#007BFF" }]}
                onPress={() => selecionarModoRota("livre")}
              >
                <MaterialCommunityIcons
                  name="map-marker-radius"
                  size={32}
                  color="#007BFF"
                />
                <Text style={styles.modoRotaTitleHome}>Rota Livre</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modoRotaButtonHome, { borderColor: "#28a745" }]}
                onPress={() => selecionarModoRota("predefinida")}
              >
                <MaterialCommunityIcons
                  name="map-marker-path"
                  size={32}
                  color="#28a745"
                />
                <Text style={styles.modoRotaTitleHome}>Rota Pré-definida</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Modal de Seleção de Modo de Rota */}
        <Modal
          visible={mostrarSelecaoRota}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              {modoRota === "predefinida" && (
                // Seleção de rota específica (apenas para modo pré-definido)
                <>
                  <Text style={styles.modalTitle}>
                    Selecionar Rota Pré-Definida
                  </Text>

                  {carregandoRotas ? (
                    <View style={styles.carregandoContainer}>
                      <ActivityIndicator size="large" color="#007BFF" />
                      <Text style={styles.carregandoText}>
                        Carregando rotas...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <ScrollView style={styles.rotasList}>
                        {rotasPreDefinidas.length > 0 ? (
                          rotasPreDefinidas.map((rota) => (
                            <TouchableOpacity
                              key={rota.id}
                              style={styles.rotaItem}
                              onPress={() => confirmarRotaSelecionada(rota)}
                            >
                              <Text style={styles.rotaNome}>{rota.nome}</Text>
                              <Text style={styles.rotaPontos}>
                                {rota.pontos.length} pontos •{" "}
                                {rota.pontos
                                  .map((p) => `${p.sigla}-${p.uf}`)
                                  .join(" → ")}
                              </Text>
                              <Text style={styles.rotaStatus}>
                                {rota.ativa ? "Ativa" : "Inativa"}
                              </Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.semRotasContainer}>
                            <MaterialCommunityIcons
                              name="map-marker-off"
                              size={40}
                              color="#999"
                            />
                            <Text style={styles.semRotasText}>
                              Nenhuma rota disponível
                            </Text>
                            <Text style={styles.semRotasSubtext}>
                              Não há rotas pré-definidas cadastradas para o seu
                              usuário.
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
                        <MaterialCommunityIcons
                          name="reload"
                          size={20}
                          color="#fff"
                        />
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
        <Modal
          visible={showKmModal !== null}
          transparent={true}
          animationType="slide"
        >
          <KmModal
            visible={showKmModal !== null}
            type={showKmModal}
            kmValue={showKmModal === "inicio" ? kmInicial : kmFinal}
            kmInicial={kmInicial}
            onKmChange={showKmModal === "inicio" ? setKmInicial : setKmFinal}
            placaValue={showKmModal === "inicio" ? placaInicial : placaFinal}
            onPlacaChange={
              showKmModal === "inicio" ? setPlacaInicial : setPlacaFinal
            }
            image={image}
            onTakeImage={takeImage}
            onCancel={() => {
              setShowKmModal(null);
              setImage(null);
              setRotaAtiva(null);
              setProximoPonto(null);
              setModoRota(null);
            }}
            onConfirm={
              showKmModal === "inicio"
                ? confirmStartTracking
                : confirmStopTracking
            }
            uploading={uploading}
            uid={uid}
            buscarUltimoKmPorPlaca={buscarUltimoKmPorPlaca}
          />
        </Modal>

        {/* Panic Modal */}
        <Modal
          visible={showPanicModal}
          transparent={true}
          animationType="slide"
        >
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
            comment={""}
            onCommentChange={function (text: string): void {
              throw new Error("Function not implemented.");
            }}
          />
        </Modal>

        {/* Checkpoint Modal */}
        <Modal
          visible={showCheckpointModal}
          transparent={true}
          animationType="slide"
        >
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
            onCancel={() => {
              setSiteSelecionadoDaRota(false);
              setShowCheckpointModal(false);
            }}
            onConfirm={confirmCheckpoint}
            uploading={uploading}
            onAutoDetect={buscarSitesProximosManualmente}
            location={location}
          //modoRota={modoRota}
          />
        </Modal>

        {/* Modal de Seleção de Sites Próximos */}
        <Modal
          visible={mostrarSelecaoSites}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { maxHeight: "80%" }]}>
              <Text style={styles.modalTitle}>Selecione o Site</Text>
              <Text style={styles.modalSubtitle}>
                {sitesProximosEncontrados.length} site(s) encontrado(s) próximos
                a você
              </Text>

              <ScrollView
                style={{ maxHeight: 400 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {sitesProximosEncontrados.map((site, index) => {
                  const distancia = distanceBetween(
                    [site.latitude, site.longitude],
                    [location.coords.latitude, location.coords.longitude],
                  );

                  return (
                    <TouchableOpacity
                      key={site.id}
                      style={[
                        styles.siteItem,
                        index === 0 && styles.siteItemMaisProximo,
                      ]}
                      onPress={() => selecionarSite(site)}
                    >
                      <View style={styles.siteInfo}>
                        <Text style={styles.siteNome}>
                          {site.sigla}-{site.uf}
                          {index === 0 && " 🏆"}
                        </Text>
                        <Text style={styles.siteEndereco}>{site.endereco}</Text>
                        <Text style={styles.siteDistancia}>
                          📍 {distancia.toFixed(2)} km de distância
                        </Text>
                        {site.regional && (
                          <Text style={styles.siteRegional}>
                            🏢 {site.regional}
                          </Text>
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
                <Text style={styles.buttonText}>
                  Registrar Site Manualmente
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonCancel, { marginTop: 5 }]}
                onPress={() => {
                  setMostrarSelecaoSites(false);
                  setMostrandoAlertaDetecao(false);
                }}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal de Detecção de Sites */}
        <Modal
          visible={mostrandoAlertaDetecao}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { padding: 30 }]}>
              <ActivityIndicator size="large" color="#007BFF" />
              <Text
                style={[
                  styles.modalTitle,
                  { marginTop: 20, textAlign: "center" },
                ]}
              >
                Detectando Site
              </Text>
              <Text style={[styles.modalSubtitle, { textAlign: "center" }]}>
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
                Modo:{" "}
                {modoRota === "predefinida"
                  ? "Rota Pré-definida"
                  : "Rota Livre"}
              </Text>
              {rotaAtiva && (
                <Text style={styles.rotaAtivaText}>Rota: {rotaAtiva.nome}</Text>
              )}
            </View>

            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={motivo}
                onValueChange={(itemValue) => {
                  setMotivo(itemValue);
                  if (itemValue !== "ronda_em_site") setImage(null);
                }}
                dropdownIconColor="#fff"
                style={styles.picker}
                enabled={!uploading && !proximoPonto}
              >
                <Picker.Item label="Selecione o motivo" value="" color="#999" />
                <Picker.Item
                  label="Ronda em site"
                  value="ronda_em_site"
                  color="#000"
                />
                <Picker.Item
                  label="Abastecimento"
                  value="abastecimento"
                  color="#000"
                />
                <Picker.Item
                  label="Troca de veículo"
                  value="troca_de_veiculo"
                  color="#000"
                />
                <Picker.Item label="Outro" value="outro" color="#000" />
              </Picker>
            </View>

            <TouchableOpacity
              style={[
                styles.buttonCheckpoint,
                !motivo && !proximoPonto ? styles.buttonDisabled : null,
              ]}
              onPress={handleCheckpoint}
              disabled={uploading || (!motivo && !proximoPonto)}
            >
              <Text style={styles.buttonText}>
                {siteCode && uf && motivo === "ronda_em_site"
                  ? `Registrar ${siteCode}-${uf}`
                  : proximoPonto
                    ? `Registrar ${proximoPonto.sigla}-${proximoPonto.uf}`
                    : motivo === "ronda_em_site"
                      ? "Registrar Site"
                      : "Registrar Checkpoint"}
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
                Progresso: {rotaAtiva.pontos.filter((p) => p.concluido).length}{" "}
                / {rotaAtiva.pontos.length}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(rotaAtiva.pontos.filter((p) => p.concluido).length / rotaAtiva.pontos.length) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {proximoPonto && (
              <View
                style={[
                  styles.proximoPontoContainer,
                  estaProximoDoPonto && styles.proximoPontoContainerProximo,
                ]}
              >
                <Text style={styles.proximoPontoTitle}>
                  {estaProximoDoPonto
                    ? "✅ Próximo Ponto (Perto)"
                    : "📍 Próximo Ponto"}
                </Text>
                <Text style={styles.proximoPonto}>
                  {proximoPonto.sigla}-{proximoPonto.uf} -{" "}
                  {proximoPonto.descricao}
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
                  <MaterialCommunityIcons
                    name="navigation"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.navegacaoButtonText}>
                    Navegar até {proximoPonto.sigla}-{proximoPonto.uf}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView
              style={[
                styles.pontosList,
                {
                  height: 300,
                  maxHeight: 300,
                },
              ]}
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              nestedScrollEnabled
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {rotaAtiva.pontos.map((ponto) => (
                <TouchableOpacity
                  key={ponto.id}
                  style={[
                    styles.pontoItem,
                    ponto.concluido && styles.pontoConcluido,
                  ]}
                  onPress={() => selecionarSiteDaRota(ponto)}
                  disabled={ponto.concluido}
                >
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
                  {!ponto.concluido && (
                    <Text style={styles.pontoText}>Toque para registrar</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Informações do modo livre */}
        {isTracking && modoRota === "livre" && !rotaAtiva && (
          <View style={styles.rotaLivreContainer}>
            <Text style={styles.rotaLivreTitle}>Modo Rota Livre</Text>
            <Text style={styles.rotaLivreDescricao}>
              Você está no modo de rota livre. Registre checkpoints conforme
              necessário selecionando o motivo acima.
            </Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{checkpoints.length}</Text>
                <Text style={styles.statLabel}>Checkpoints</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {
                    checkpoints.filter((cp) => cp.motivo === "ronda_em_site")
                      .length
                  }
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
              <Text style={styles.detailValue}>
                {rondaDetails.placaInicial}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Modo:</Text>
              <Text style={styles.detailValue}>
                {rondaDetails.modoRota === "predefinida"
                  ? "Rota Pré-definida"
                  : "Rota Livre"}
              </Text>
            </View>

            {/* Histórico de trocas de veículo */}
            {rondaDetails.ultimaTrocaVeiculo && (
              <View style={styles.trocaVeiculoContainer}>
                <Text style={styles.trocaVeiculoTitle}>
                  Última Troca de Veículo
                </Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>De:</Text>
                  <Text style={styles.detailValue}>
                    {rondaDetails.ultimaTrocaVeiculo.placaAnterior} (KM:{" "}
                    {rondaDetails.ultimaTrocaVeiculo.kmAnterior})
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Para:</Text>
                  <Text style={styles.detailValue}>
                    {rondaDetails.ultimaTrocaVeiculo.placaNovo} (KM:{" "}
                    {rondaDetails.ultimaTrocaVeiculo.kmNovo})
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Data/Hora:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(
                      rondaDetails.ultimaTrocaVeiculo.timestamp,
                    ).toLocaleString()}
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
                  <Text style={styles.detailValue}>
                    {rondaDetails.placaFinal}
                  </Text>
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
                <Text style={styles.checkpointsTitle}>
                  Checkpoints ({checkpoints.length})
                </Text>
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
          <MaterialCommunityIcons
            name="shield-alert-outline"
            size={40}
            color="#fff"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
