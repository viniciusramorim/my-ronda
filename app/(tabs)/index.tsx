import { View, StyleSheet, Button, Alert, TextInput } from 'react-native';
import * as Location from 'expo-location';
import { useState } from 'react';
import { doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

import { ThemedText } from '@/components/ThemedText';
import { otherDb } from '@/services/firebaseConfig';

export default function HomeScreen() {
  const [location, setLocation] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [rondaId, setRondaId] = useState<string | null>(null);
  const [siteCode, setSiteCode] = useState<string>(''); // sigla do site

  // Iniciar nova ronda e rastreamento
  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'É necessário acesso à localização.');
      return;
    }

    const novaRondaId = `ronda_${new Date().getTime()}`;
    const rondaRef = doc(otherDb, 'rondas', novaRondaId);
    await setDoc(rondaRef, {
      nomeRonda: `Ronda_${new Date().toLocaleString()}`,
      inicio: new Date().toISOString(),
      ultimaLocalizacao: null,
      checkpoints: [],
    });
    setRondaId(novaRondaId);
    setIsTracking(true);

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
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
          console.log('Localização atualizada no doc da ronda');
        } catch (error) {
          console.error('Erro ao atualizar localização:', error);
        }
      }
    );

    setSubscription(sub);
  };

  // Parar rastreamento
  const stopTracking = async () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
      setIsTracking(false);
      console.log('Rastreamento parado');

      if (rondaId) {
        const rondaRef = doc(otherDb, 'rondas', rondaId);
        await updateDoc(rondaRef, {
          fim: new Date().toISOString(),
        });
      }

      setRondaId(null);
    }
  };

  // Inserir Checkpoint
  const handleCheckpoint = async () => {
    if (!rondaId || !location || !siteCode.trim()) {
      Alert.alert('Erro', 'Informe a sigla do site e certifique-se de que o GPS está ativo.');
      return;
    }

    const rondaRef = doc(otherDb, 'rondas', rondaId);
    try {
      await updateDoc(rondaRef, {
        checkpoints: arrayUnion({
          site: siteCode.toUpperCase(),
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString(),
        }),
      });
      Alert.alert('Checkpoint adicionado', `Site ${siteCode.toUpperCase()} salvo com sucesso.`);
      setSiteCode('');
    } catch (error) {
      console.error('Erro ao adicionar checkpoint:', error);
      Alert.alert('Erro', 'Não foi possível salvar o checkpoint.');
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText type="title">Ronda Digital</ThemedText>

      <Button
        title={isTracking ? "Parar Rastreamento" : "Iniciar Rastreamento"}
        onPress={isTracking ? stopTracking : startTracking}
      />

      {rondaId && (
        <>
          <ThemedText>ID da Ronda: {rondaId}</ThemedText>
          
          <TextInput
            style={styles.input}
            placeholder="Sigla do site (ex: SP001)"
            value={siteCode}
            onChangeText={setSiteCode}
          />

          <Button
            title="Registrar Checkpoint"
            onPress={handleCheckpoint}
            disabled={!siteCode}
          />
        </>
      )}

      {location && (
        <ThemedText>
          Localização atual: {location.coords.latitude}, {location.coords.longitude}
        </ThemedText>
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
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    padding: 10,
    width: '100%',
    maxWidth: 300,
  },
});
