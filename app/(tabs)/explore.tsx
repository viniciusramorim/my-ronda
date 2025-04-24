import { StyleSheet, View, FlatList, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { otherDb } from '@/services/firebaseConfig';

export default function TabTwoScreen() {
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [rondas, setRondas] = useState<any[]>([]);
  const [selectedRondaId, setSelectedRondaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Função para buscar todas as rondas
  const fetchRondas = async () => {
    try {
      const querySnapshot = await getDocs(collection(otherDb, 'rondas'));
      const rondasList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRondas(rondasList);
    } catch (error) {
      console.error('Erro ao buscar rondas:', error);
    }
  };

  // Função para buscar os checkpoints da ronda selecionada
  const fetchCheckpoints = async (rondaId: string) => {
    try {
      setLoading(true);
      if (!refreshing) setLoading(true);
      const querySnapshot = await getDocs(collection(otherDb, 'rondas', rondaId, 'checkpoints'));
      const checkpointsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCheckpoints(checkpointsList);
    } catch (error) {
      console.error('Erro ao buscar checkpoints:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRondas(); // Carregar as rondas quando o componente for montado
  }, []);

  // Atualizar os checkpoints sempre que a ronda for alterada
  useEffect(() => {
    if (selectedRondaId) {
      fetchCheckpoints(selectedRondaId);
    }
  }, [selectedRondaId]);

  return (
    <View style={styles.container}>
      {/* Picker para selecionar a ronda */}
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedRondaId}
          onValueChange={(itemValue) => setSelectedRondaId(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Selecione uma Ronda" value={null} />
          {rondas.map((ronda) => (
            <Picker.Item key={ronda.id} label={ronda.nomeRonda} value={ronda.id} />
          ))}
        </Picker>
      </View>

      {/* Lista de checkpoints */}
      {loading ? (
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={checkpoints}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThemedView style={styles.eventItem}>
              <ThemedText style={styles.eventText} type="defaultSemiBold">Site: {item.site}</ThemedText>
              <ThemedText style={styles.eventText}>Motivo: {item.motivo}</ThemedText>
              <ThemedText style={styles.eventText}>Latitude: {item.latitude}</ThemedText>
              <ThemedText style={styles.eventText}>Longitude: {item.longitude}</ThemedText>
              <ThemedText style={styles.eventText}>Data: {new Date(item.timestamp).toLocaleString()}</ThemedText>
            </ThemedView>
          )}
          ListEmptyComponent={<ThemedText style={styles.emptyText}>Nenhum evento encontrado.</ThemedText>}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1a0033',
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
    gap: 12,
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
    marginBottom: 16,
  },
  picker: {
    color: '#fff',
    backgroundColor: '#3a005c',
    height: 50,
  },
  eventItem: {
    backgroundColor: '#5e1a8f',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  eventText: {
    color: '#fff',
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    marginTop: 20,
  },
});
