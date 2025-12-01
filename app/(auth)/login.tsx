import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { firebase, otherDb } from '@/services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versaoValida, setVersaoValida] = useState(true);
  const [versaoInfo, setVersaoInfo] = useState<any>(null);

  // Versão atual do app - use Constants ou uma versão hardcoded
  const currentAppVersion = Constants.expoConfig?.version || "2.1.0.171125";

  // Verificar versão ao carregar a tela
  useEffect(() => {
    verificarVersaoApp();
  }, []);

  const verificarVersaoApp = async () => {
    try {
      const versaoDoc = await getDoc(doc(otherDb, 'app_versions', 'android'));
      
      if (versaoDoc.exists()) {
        const versaoData = versaoDoc.data();
        setVersaoInfo(versaoData);
        
        // Verificar se a versão atual é compatível
        if (versaoData.version !== currentAppVersion) {
          setVersaoValida(false);
          
          // Se for obrigatória, mostrar alerta imediatamente
          if (versaoData.mandatory) {
            mostrarAlertaVersao(versaoData);
          }
        } else {
          setVersaoValida(true);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar versão:', error);
      // Em caso de erro, permite continuar (não bloqueia o app)
      setVersaoValida(true);
    }
  };

  const mostrarAlertaVersao = (versaoData: any) => {
    const botoes = [
      {
        text: 'Baixar Agora',
        onPress: () => {
          if (versaoData.downloadUrl) {
            Linking.openURL(versaoData.downloadUrl);
          }
        }
      }
    ];

    // Adiciona botão "Ignorar" apenas se não for obrigatório
    if (!versaoData.mandatory) {
      botoes.push({ 
        text: 'Ignorar', 
        style: 'cancel' as const 
      });
    }

    Alert.alert(
      'Atualização Necessária',
      `Uma nova versão do aplicativo está disponível (${versaoData.version}).\n\n${versaoData.releasesNotes || ''}`,
      botoes,
      { cancelable: !versaoData.mandatory }
    );

    console.log('Alerta de versão exibido');
  };

  const validarEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

  const handleLogin = async () => {
    // Bloquear login se a versão for inválida e obrigatória
    if (versaoInfo?.mandatory && !versaoValida) {
      mostrarAlertaVersao(versaoInfo);
      return;
    }

    if (!validarEmail(email)) return Alert.alert('Erro', 'Email inválido.');
    if (senha.length < 4) return Alert.alert('Erro', 'Senha deve ter pelo menos 4 caracteres.');

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

  const podeLogar = validarEmail(email) && senha.length >= 4 && versaoValida;

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/logo_ronda.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.subtitle}>Acesse sua conta</Text>

      {/* Alerta de versão desatualizada */}
      {!versaoValida && versaoInfo && (
        <View style={styles.versaoAlerta}>
          <Ionicons name="warning" size={20} color="#ffcc00" />
          <Text style={styles.versaoAlertaText}>
            {versaoInfo.mandatory 
              ? 'Atualização obrigatória disponível' 
              : 'Nova versão disponível'}
          </Text>
          <TouchableOpacity 
            onPress={() => mostrarAlertaVersao(versaoInfo)}
            style={styles.versaoBotao}
          >
            <Text style={styles.versaoBotaoText}>Ver</Text>
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor="#aaa"
      />

      <View style={styles.senhaContainer}>
        <TextInput
          placeholder="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry={!mostrarSenha}
          style={styles.inputSenha}
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)} style={styles.icon}>
          <Ionicons name={mostrarSenha ? 'eye-off' : 'eye'} size={24} color="#ccc" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleLogin}
        style={[styles.loginButton, (!podeLogar || loading) && styles.loginButtonDisabled]}
        disabled={!podeLogar || loading}
      >
        <Text style={styles.loginButtonText}>
          {loading ? 'Entrando...' : 'Entrar'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.version}>{currentAppVersion}</Text>
    </View>
  );
}

// Os styles permanecem os mesmos...
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 28,
  },
  version: {
    fontSize: 16,
    color: '#575c63',
    marginTop: 28,
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
  },
  loginButtonDisabled: {
    backgroundColor: '#444',
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  versaoAlerta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#332200',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  versaoAlertaText: {
    color: '#ffcc00',
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
  versaoBotao: {
    backgroundColor: '#ffcc00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  versaoBotaoText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
});