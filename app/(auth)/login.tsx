import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { firebase, otherDb } from '@/services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  const validarEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

  const handleLogin = async () => {
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

  const podeLogar = validarEmail(email) && senha.length >= 4;

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/logo_ronda.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.subtitle}>Acesse sua conta</Text>

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
});
