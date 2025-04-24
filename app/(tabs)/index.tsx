import { View, StyleSheet, Button, Alert, TextInput, TouchableOpacity, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { doc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';

import { ThemedText } from '@/components/ThemedText';
import { otherDb } from '@/services/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen() {
  const [location, setLocation] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [rondaId, setRondaId] = useState<string | null>(null);
  const [siteCode, setSiteCode] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('Ronda em site');
  const [user, setUser] = useState<string | null>('');
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    userData(); // Carregar os dados do usuário e o UID
  }, []);

  const userData = async () => {
    let nome = await AsyncStorage.getItem('userName');
    let userUid = await AsyncStorage.getItem('userUid'); // Recupera o UID
    setUser(nome);
    setUid(userUid);
  };

  const startTracking = async () => {
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
    await setDoc(rondaRef, {
      nomeRonda: `Ronda_${new Date().toLocaleString()}`,
      inicio: new Date().toISOString(),
      ultimaLocalizacao: null,
      uid: uid, // Armazenando o UID do usuário
      timestamp: new Date().toISOString(), // Adicionando o timestamp
    });
    setRondaId(novaRondaId);
    setIsTracking(true);

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 15000,
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
        } catch (error) {
          console.error('Erro ao atualizar localização:', error);
        }
      }
    );

    setSubscription(sub);
  };

  const stopTracking = async () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
      setIsTracking(false);

      if (rondaId) {
        const rondaRef = doc(otherDb, 'rondas', rondaId);
        await updateDoc(rondaRef, {
          fim: new Date().toISOString(),
        });
      }

      setRondaId(null);
    }
  };

  const handleCheckpoint = async () => {
    if (!rondaId || !location || !siteCode.trim()) {
      Alert.alert('Erro', 'Informe a sigla do site e certifique-se de que o GPS está ativo.');
      return;
    }

    try {
      const checkpointsRef = collection(otherDb, 'rondas', rondaId, 'checkpoints');
      await addDoc(checkpointsRef, {
        site: siteCode.toUpperCase(),
        motivo,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
      });

      Alert.alert('Checkpoint adicionado', `Site ${siteCode.toUpperCase()} salvo com sucesso.`);
      setSiteCode('');
      setMotivo('Ronda em site');
    } catch (error) {
      console.error('Erro ao adicionar checkpoint:', error);
      Alert.alert('Erro', 'Não foi possível salvar o checkpoint.');
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText>Bem-vindo(a) {user}.</ThemedText>

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

      {rondaId && (
        <>
          <ThemedText>ID da Ronda: {rondaId}</ThemedText>

          <TextInput
            style={styles.input}
            placeholder="Sigla do site (ex: SP001)"
            value={siteCode}
            onChangeText={setSiteCode}
          />

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={motivo}
              onValueChange={(itemValue) => setMotivo(itemValue)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 16,
    alignItems: 'center',
    backgroundColor: '#2a003f', // fundo roxo escuro
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
    backgroundColor: '#03dac5', // verde-água
  },
  buttonStop: {
    backgroundColor: '#cf6679', // vermelho suave
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonCheckpoint: {
    backgroundColor: '#6200ee', // roxo padrão Material
  },
  buttonDisabled: {
    backgroundColor: '#555', // cinza desativado
  },
});
