import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { firebase, otherDb } from '@/services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Platform, Linking } from 'react-native';

// Interface para a versão do app
interface AppVersion {
  version: string;
  buildNumber: string;
  mandatory: boolean;
  downloadUrl: string;
  releaseNotes: string;
  timestamp: any;
}

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingVersion, setCheckingVersion] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<AppVersion | null>(null);

  // Obter versão atual do app
  const getCurrentVersion = () => {
    try {
      const version = Constants.expoConfig?.version || '2.1.0';
      const buildNumber = Constants.expoConfig?.ios?.buildNumber || 
                         Constants.expoConfig?.android?.versionCode || 
                         '171125';
      return { version, buildNumber: buildNumber.toString() };
    } catch (error) {
      return { version: '2.1.0', buildNumber: '171125' };
    }
  };

  // Comparar versões
  const compareVersions = (version1: string, version2: string): number => {
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0;
      const num2 = v2[i] || 0;

      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }

    return 0;
  };

  // Verificar atualizações disponíveis
  const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion?: AppVersion }> => {
    try {
      const currentVersion = getCurrentVersion();
      console.log('Versão atual:', currentVersion);

      const platform = Platform.OS; // 'android' ou 'ios'
      const versionDocRef = doc(otherDb, 'app_versions', platform);
      const versionDoc = await getDoc(versionDocRef);

      if (!versionDoc.exists()) {
        console.log('Nenhuma configuração de versão encontrada no Firestore');
        return { hasUpdate: false };
      }

      const latestVersion = versionDoc.data() as AppVersion;
      console.log('Última versão disponível:', latestVersion);

      const hasUpdate = compareVersions(currentVersion.version, latestVersion.version) < 0;

      return { hasUpdate, latestVersion };
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
      return { hasUpdate: false };
    }
  };

  // Verificar versão ao carregar a tela
  useEffect(() => {
    const verifyVersion = async () => {
      try {
        const { hasUpdate, latestVersion } = await checkForUpdates();
        setUpdateAvailable(hasUpdate);
        setLatestVersion(latestVersion || null);
        
        if (hasUpdate && latestVersion) {
          showUpdateAlert(latestVersion);
        }
      } catch (error) {
        console.error('Erro na verificação de versão:', error);
      } finally {
        setCheckingVersion(false);
      }
    };

    verifyVersion();
  }, []);

  // Mostrar alerta de atualização obrigatória
  const showUpdateAlert = (versionInfo: AppVersion) => {
    const title = versionInfo.mandatory 
      ? '📱 Atualização Obrigatória' 
      : '🚀 Nova Versão Disponível';
    
    const message = `Uma nova versão do app está disponível!\n\n` +
                   `Versão: ${versionInfo.version}\n\n` +
                   `Novidades:\n${versionInfo.releaseNotes}\n\n` +
                   `${versionInfo.mandatory ? 'Você precisa atualizar para continuar usando o app.' : 'Recomendamos atualizar para obter as melhores funcionalidades.'}`;

    const buttons = [
      {
        text: '📥 Atualizar Agora',
        onPress: () => {
          Linking.openURL(versionInfo.downloadUrl).catch(() => {
            Alert.alert('Erro', 'Não foi possível abrir o link de download.');
          });
        }
      }
    ];

    // Se não for obrigatório, permite pular (mas não recomendo para produção)
    if (!versionInfo.mandatory) {
      buttons.push({
        text: '⚠️ Ignorar',
        style: 'cancel',
        onPress: () => {
          // Permite login mesmo com atualização disponível (não obrigatória)
          setUpdateAvailable(false);
        }
      });
    }

    Alert.alert(title, message, buttons, { 
      cancelable: !versionInfo.mandatory,
      onDismiss: () => {
        if (versionInfo.mandatory) {
          // Se for obrigatório e usuário tentou fechar, mostra novamente
          showUpdateAlert(versionInfo);
        }
      }
    });
  };

  const validarEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

  const handleLogin = async () => {
    // Bloquear login se houver atualização obrigatória
    if (updateAvailable && latestVersion?.mandatory) {
      showUpdateAlert(latestVersion);
      return;
    }

    if (!validarEmail(email)) {
      Alert.alert('Erro', 'Email inválido.');
      return;
    }
    
    if (senha.length < 4) {
      Alert.alert('Erro', 'Senha deve ter pelo menos 4 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const cred = await firebase.auth().signInWithEmailAndPassword(email, senha);
      const uid = cred.user?.uid;
      if (!uid) throw new Error('UID não encontrado');

      const docSnap = await getDoc(doc(otherDb, 'usuarios', uid));
      if (!docSnap.exists()) throw new Error('Usuário não encontrado no banco');

      const user = docSnap.data();
      await AsyncStorage.multiSet([
        ['loggedIn', 'true'],
        ['userEmail', cred.user?.email ?? ''],
        ['userName', user?.nome ?? 'usuário'],
        ['userNivel', user?.nivel ?? ''],
        ['userUid', uid]
      ]);

      router.replace('/');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erro ao fazer login', err.message);
    } finally {
      setLoading(false);
    }
  };

  const podeLogar = validarEmail(email) && senha.length >= 4 && !checkingVersion;
  const currentVersion = getCurrentVersion();

  // Se estiver verificando versão, mostrar loading
  if (checkingVersion) {
    return (
      <View style={styles.container}>
        <Image
          source={require('@/assets/images/logo_ronda.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>Verificando atualizações...</Text>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.version}>{currentVersion.version}.{currentVersion.buildNumber}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/logo_ronda.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Banner de atualização disponível (não obrigatória) */}
      {updateAvailable && !latestVersion?.mandatory && (
        <TouchableOpacity 
          style={styles.updateBanner}
          onPress={() => latestVersion && showUpdateAlert(latestVersion)}
        >
          <Ionicons name="cloud-download-outline" size={20} color="#fff" />
          <Text style={styles.updateBannerText}>
            Nova versão {latestVersion?.version} disponível
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>
      )}

      <Text style={styles.subtitle}>Acesse sua conta</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor="#aaa"
        editable={!updateAvailable || !latestVersion?.mandatory}
      />

      <View style={styles.senhaContainer}>
        <TextInput
          placeholder="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry={!mostrarSenha}
          style={styles.inputSenha}
          placeholderTextColor="#aaa"
          editable={!updateAvailable || !latestVersion?.mandatory}
        />
        <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)} style={styles.icon}>
          <Ionicons name={mostrarSenha ? 'eye-off' : 'eye'} size={24} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Mensagem de bloqueio para atualização obrigatória */}
      {updateAvailable && latestVersion?.mandatory && (
        <View style={styles.blockedMessage}>
          <Ionicons name="warning-outline" size={24} color="#ff6b6b" />
          <Text style={styles.blockedText}>
            Atualização obrigatória. Faça o download da versão {latestVersion.version} para continuar.
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleLogin}
        style={[
          styles.loginButton, 
          (!podeLogar || loading || (updateAvailable && latestVersion?.mandatory)) && styles.loginButtonDisabled
        ]}
        disabled={!podeLogar || loading || (updateAvailable && latestVersion?.mandatory)}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.loginButtonText}>
            {updateAvailable && latestVersion?.mandatory ? 'Atualização Obrigatória' : 'Entrar'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Botão de atualização se houver versão disponível */}
      {updateAvailable && (
        <TouchableOpacity
          style={styles.updateButton}
          onPress={() => latestVersion && showUpdateAlert(latestVersion)}
        >
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.updateButtonText}>Baixar Atualização</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.version}>
        v{currentVersion.version}.{currentVersion.buildNumber}
        {updateAvailable && ` • Nova: v${latestVersion?.version}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1a0033',
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 28,
  },
  version: {
    fontSize: 14,
    color: '#575c63',
    marginTop: 20,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 10,
    backgroundColor: '#2e0a4a',
    color: '#fff',
  },
  senhaContainer: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 10,
    backgroundColor: '#2e0a4a',
  },
  inputSenha: {
    flex: 1,
    padding: 12,
    color: '#fff',
  },
  icon: {
    padding: 12,
  },
  loginButton: {
    backgroundColor: '#6200ee',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginTop: 10,
  },
  loginButtonDisabled: {
    backgroundColor: '#444',
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffa500',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  updateBannerText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    marginRight: 4,
    flex: 1,
  },
  blockedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  blockedText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
    width: '100%',
    justifyContent: 'center',
    maxWidth: 300,
  },
  updateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
});