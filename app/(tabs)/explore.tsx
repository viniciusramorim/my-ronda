import { StyleSheet, View, FlatList, ActivityIndicator, Button } from 'react-native';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { otherDb } from '@/services/firebaseConfig';

export default function TabTwoScreen() {
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEventos = async () => {
    try {
      if (!refreshing) setLoading(true);
      const querySnapshot = await getDocs(collection(otherDb, 'eventos_ronda'));
      const eventosList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEventos(eventosList);
    } catch (error) {
      console.error('Erro ao buscar eventos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEventos();
  }, []);

  return (
    <View style={styles.container}>
      <ThemedView style={styles.header}>
        <Button title="Atualizar" onPress={() => {
          setRefreshing(true);
          fetchEventos();
        }} />
      </ThemedView>

      {loading ? (
        <ActivityIndicator size="large" color="#999" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={eventos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThemedView style={styles.eventItem}>
              <ThemedText type="defaultSemiBold">Tipo: {item.tipoEvento}</ThemedText>
              <ThemedText>Latitude: {item.latitude}</ThemedText>
              <ThemedText>Longitude: {item.longitude}</ThemedText>
              {item.siglaPredio && <ThemedText>Prédio: {item.siglaPredio}</ThemedText>}
              {item.statusOk !== undefined && (
                <ThemedText>Status: {item.statusOk ? 'OK' : 'Não OK'}</ThemedText>
              )}
              <ThemedText>Data: {new Date(item.timestamp).toLocaleString()}</ThemedText>
            </ThemedView>
          )}
          ListEmptyComponent={<ThemedText>Nenhum evento encontrado.</ThemedText>}
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
    backgroundColor: '#000',
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
    gap: 12,
  },
  eventItem: {
    backgroundColor: 'purple',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
});
