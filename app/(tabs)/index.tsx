import { View, StyleSheet, Button, Alert } from 'react-native';
import * as Location from 'expo-location';
import { useState } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';

import { ThemedText } from '@/components/ThemedText';
import { otherDb } from '@/connection/firebaseConfig'; // 🔁 Use sua conexão personalizada

export default function HomeScreen() {
  const [location, setLocation] = useState(null);

  const handleGetLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'É necessário acesso à localização.');
      return;
    }

    const currentLocation = await Location.getCurrentPositionAsync({});
    setLocation(currentLocation);

    const data = {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
      timestamp: new Date().toISOString(),
    };

    try {
      await addDoc(collection(otherDb, 'localizacoes'), data);
      Alert.alert('Localização salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar localização:', error);
      Alert.alert('Erro', 'Não foi possível salvar a localização.');
    }
  };

  const fetchLocalizacoes = async () => {
    try {
      const snapshot = await getDocs(collection(otherDb, 'localizacoes'));
      snapshot.forEach((doc) => {
        console.log(doc.id, '=>', doc.data());
      });
      Alert.alert('Localizações lidas, veja o console.');
    } catch (error) {
      console.error('Erro ao buscar localizações:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText type="title">Tela Inicial</ThemedText>
      <Button title="Obter e Salvar Localização" onPress={handleGetLocation} />
      <Button title="Ler Localizações do Firestore" onPress={fetchLocalizacoes} />
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
});
