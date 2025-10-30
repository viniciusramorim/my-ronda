// app/(tabs)/routes.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  Alert,
  ScrollView,
  Image,
  FlatList,
  Modal
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

// Tipos
interface RouteLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  toleranceRadius: number;
  required: boolean;
}

interface RouteCheckpoint {
  location: RouteLocation;
  photo?: string;
  comment?: string;
  checkedAt?: Date;
  isVerified: boolean;
}

interface Route {
  id: string;
  name: string;
  checkpoints: RouteCheckpoint[];
  status: 'pending' | 'in-progress' | 'completed';
  scheduledDate: Date;
  priority: 'high' | 'medium' | 'low';
}

// Função para adicionar dias a uma data
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Função para formatar data
const formatDate = (date: Date) => {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Função para formatar data curta
const formatShortDate = (date: Date) => {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  });
};

// Função para verificar se é hoje
const isToday = (date: Date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

// Função para verificar se é amanhã
const isTomorrow = (date: Date) => {
  const tomorrow = addDays(new Date(), 1);
  return date.toDateString() === tomorrow.toDateString();
};

// Função para verificar se é depois de amanhã
const isDayAfterTomorrow = (date: Date) => {
  const dayAfterTomorrow = addDays(new Date(), 2);
  return date.toDateString() === dayAfterTomorrow.toDateString();
};

// Dados fictícios com datas
const mockRoutes: Route[] = [
  {
    id: '1',
    name: 'Rota de Entrega Matinal',
    status: 'in-progress',
    scheduledDate: new Date(), // Hoje
    priority: 'high',
    checkpoints: [
      {
        location: {
          id: 'loc1',
          name: 'Shopping Center Norte',
          latitude: -23.5505,
          longitude: -46.6333,
          address: 'Av. Paulista, 1000 - São Paulo',
          toleranceRadius: 50,
          required: true
        },
        isVerified: false
      },
      {
        location: {
          id: 'loc2',
          name: 'Edifício Corporate',
          latitude: -23.5510,
          longitude: -46.6340,
          address: 'Rua Augusta, 500 - São Paulo',
          toleranceRadius: 30,
          required: true
        },
        isVerified: false
      }
    ]
  },
  {
    id: '2',
    name: 'Rota de Visitas Técnicas',
    status: 'pending',
    scheduledDate: addDays(new Date(), 1), // Amanhã
    priority: 'medium',
    checkpoints: [
      {
        location: {
          id: 'loc3',
          name: 'Cliente A - Sede',
          latitude: -23.5530,
          longitude: -46.6360,
          address: 'Rua Bela Vista, 250 - São Paulo',
          toleranceRadius: 25,
          required: true
        },
        isVerified: false
      }
    ]
  },
  {
    id: '3',
    name: 'Rota de Coleta',
    status: 'pending',
    scheduledDate: addDays(new Date(), 2), // Depois de amanhã
    priority: 'low',
    checkpoints: [
      {
        location: {
          id: 'loc4',
          name: 'Centro de Distribuição',
          latitude: -23.5540,
          longitude: -46.6370,
          address: 'Av. República, 800 - São Paulo',
          toleranceRadius: 40,
          required: true
        },
        isVerified: false
      }
    ]
  },
  {
    id: '4',
    name: 'Rota de Auditoria',
    status: 'pending',
    scheduledDate: addDays(new Date(), 3), // 3 dias
    priority: 'medium',
    checkpoints: [
      {
        location: {
          id: 'loc5',
          name: 'Filial Leste',
          latitude: -23.5550,
          longitude: -46.6380,
          address: 'Rua Consolação, 1500 - São Paulo',
          toleranceRadius: 35,
          required: true
        },
        isVerified: false
      }
    ]
  },
  {
    id: '5',
    name: 'Rota Especial',
    status: 'pending',
    scheduledDate: addDays(new Date(), -1), // Ontem (atrasada)
    priority: 'high',
    checkpoints: [
      {
        location: {
          id: 'loc6',
          name: 'Centro Logístico',
          latitude: -23.5560,
          longitude: -46.6390,
          address: 'Alameda Santos, 2000 - São Paulo',
          toleranceRadius: 60,
          required: true
        },
        isVerified: false
      }
    ]
  }
];

// Opções de filtro
type DateFilter = 'all' | 'today' | 'tomorrow' | 'week' | 'overdue';

export default function RoutesScreen() {
  const [routes, setRoutes] = useState<Route[]>(mockRoutes);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<RouteCheckpoint | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'details'>('list');
  const [forceAllow, setForceAllow] = useState(false);
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [selectedCheckpointDetail, setSelectedCheckpointDetail] = useState<RouteCheckpoint | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [showDateFilter, setShowDateFilter] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos da localização para verificar os locais');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      Location.watchPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 1
      }, (location) => {
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      });

    } catch (error) {
      console.error('Erro ao obter localização:', error);
    }
  };

  // Filtragem das rotas por data
  const getFilteredRoutes = () => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const weekEnd = addDays(today, 7);

    switch (dateFilter) {
      case 'today':
        return routes.filter(route => isToday(route.scheduledDate));
      
      case 'tomorrow':
        return routes.filter(route => isTomorrow(route.scheduledDate));
      
      case 'week':
        return routes.filter(route => 
          route.scheduledDate >= today && route.scheduledDate <= weekEnd
        );
      
      case 'overdue':
        return routes.filter(route => route.scheduledDate < today && route.status !== 'completed');
      
      case 'all':
      default:
        return routes;
    }
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return '#DC3545';
      case 'medium': return '#FFC107';
      case 'low': return '#28A745';
      default: return '#6C757D';
    }
  };

  const getPriorityIcon = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getDateBadge = (date: Date) => {
    if (isToday(date)) return { text: 'HOJE', color: '#DC3545', bgColor: '#FFE6E6' };
    if (isTomorrow(date)) return { text: 'AMANHÃ', color: '#FFC107', bgColor: '#FFF9E6' };
    if (isDayAfterTomorrow(date)) return { text: 'DEPOIS DE AMANHÃ', color: '#17A2B8', bgColor: '#E6F7FF' };
    
    if (date < new Date()) return { text: 'ATRASADA', color: '#FFFFFF', bgColor: '#DC3545' };
    
    return { text: formatShortDate(date), color: '#6C757D', bgColor: '#F8F9FA' };
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleSelectRoute = (route: Route) => {
    setSelectedRoute(route);
    const nextCheckpoint = route.checkpoints.find(cp => !cp.isVerified) || route.checkpoints[0];
    setCurrentCheckpoint(nextCheckpoint);
    setComment('');
    setPhoto(null);
    setForceAllow(false);
    setView('details');
  };

  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para tirar fotos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    }
  };

  const verifyLocation = () => {
    if (!currentCheckpoint || !currentLocation) return false;

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      currentCheckpoint.location.latitude,
      currentCheckpoint.location.longitude
    );

    return distance <= currentCheckpoint.location.toleranceRadius;
  };

  const completeCheckpoint = () => {
    if (!selectedRoute || !currentCheckpoint) return;

    const isAtLocation = verifyLocation();
    const distance = getDistanceToCheckpoint();
    
    if (!isAtLocation && !forceAllow) {
      Alert.alert(
        'Fora do Local',
        `Você está a ${distance.toFixed(0)} metros do ponto necessário (tolerância: ${currentCheckpoint.location.toleranceRadius}m). Deseja marcar mesmo assim?`,
        [
          {
            text: 'Cancelar',
            style: 'cancel'
          },
          {
            text: 'Marcar Fora do Local',
            style: 'default',
            onPress: () => {
              setForceAllow(true);
              Alert.alert(
                'Confirmação',
                'Você está marcando este checkpoint fora do local permitido. Esta ação será registrada. Confirmar?',
                [
                  {
                    text: 'Cancelar',
                    style: 'cancel'
                  },
                  {
                    text: 'Confirmar',
                    onPress: () => actuallyCompleteCheckpoint(distance)
                  }
                ]
              );
            }
          }
        ]
      );
      return;
    }

    actuallyCompleteCheckpoint(distance);
  };

  const actuallyCompleteCheckpoint = (distance: number) => {
    if (!selectedRoute || !currentCheckpoint) return;

    const isAtLocation = verifyLocation();
    
    if (!photo) {
      Alert.alert('Foto necessária', 'Por favor, tire uma foto do local.');
      return;
    }

    let finalComment = comment;
    if (!isAtLocation) {
      const distanceNote = ` [Marcado fora do local - Distância: ${distance.toFixed(0)}m]`;
      finalComment = comment ? comment + distanceNote : distanceNote;
    }

    const updatedCheckpoints = selectedRoute.checkpoints.map(cp => 
      cp.location.id === currentCheckpoint.location.id 
        ? {
            ...cp,
            photo,
            comment: finalComment,
            checkedAt: new Date(),
            isVerified: true
          }
        : cp
    );

    const updatedRoute: Route = {
      ...selectedRoute,
      checkpoints: updatedCheckpoints,
      status: updatedCheckpoints.every(cp => cp.isVerified) ? 'completed' : 'in-progress'
    };

    const updatedRoutes = routes.map(r => 
      r.id === updatedRoute.id ? updatedRoute : r
    );

    setRoutes(updatedRoutes);
    setSelectedRoute(updatedRoute);
    setForceAllow(false);

    const nextCheckpoint = updatedCheckpoints.find(cp => !cp.isVerified);
    
    if (nextCheckpoint) {
      setCurrentCheckpoint(nextCheckpoint);
      setComment('');
      setPhoto(null);
      
      if (!isAtLocation) {
        Alert.alert(
          'Checkpoint Marcado (Fora do Local)', 
          `Próximo: ${nextCheckpoint.location.name}\n\n⚠️ Atenção: O checkpoint anterior foi marcado fora do local permitido.`
        );
      } else {
        Alert.alert('Sucesso!', `Checkpoint verificado. Próximo: ${nextCheckpoint.location.name}`);
      }
    } else {
      if (!isAtLocation) {
        Alert.alert(
          'Rota Concluída (Com Observações)',
          'Você completou a rota! ⚠️ Alguns checkpoints foram marcados fora do local.'
        );
      } else {
        Alert.alert('Parabéns!', 'Você completou toda a rota com sucesso! ✅');
      }
      setView('list');
    }
  };

  const getDistanceToCheckpoint = () => {
    if (!currentCheckpoint || !currentLocation) return 0;
    
    return calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      currentCheckpoint.location.latitude,
      currentCheckpoint.location.longitude
    );
  };

  const viewCheckpointDetails = (checkpoint: RouteCheckpoint) => {
    setSelectedCheckpointDetail(checkpoint);
    setShowCheckpointModal(true);
  };

  const isAtLocation = verifyLocation();
  const distance = getDistanceToCheckpoint();

  const getDistanceColor = () => {
    if (isAtLocation) return '#28A745';
    if (distance <= currentCheckpoint?.location.toleranceRadius * 2) return '#FFC107';
    return '#DC3545';
  };

  const getDistanceStatus = () => {
    if (isAtLocation) return '✅ No local correto';
    
    if (distance <= currentCheckpoint?.location.toleranceRadius * 1.5) {
      return `⚠️ Perto (${distance.toFixed(0)}m)`;
    } else if (distance <= currentCheckpoint?.location.toleranceRadius * 3) {
      return `🔶 Longe (${distance.toFixed(0)}m)`;
    } else {
      return `❌ Muito Longe (${distance.toFixed(0)}m)`;
    }
  };

  // Componente do Filtro de Data
  const DateFilterComponent = () => (
    <View style={styles.filterContainer}>
      <TouchableOpacity 
        style={styles.filterButton}
        onPress={() => setShowDateFilter(!showDateFilter)}
      >
        <Text style={styles.filterButtonText}>
          📅 {getFilterLabel(dateFilter)}
        </Text>
      </TouchableOpacity>

      {showDateFilter && (
        <View style={styles.filterDropdown}>
          <TouchableOpacity 
            style={[styles.filterOption, dateFilter === 'today' && styles.filterOptionActive]}
            onPress={() => {
              setDateFilter('today');
              setShowDateFilter(false);
            }}
          >
            <Text style={[styles.filterOptionText, dateFilter === 'today' && styles.filterOptionTextActive]}>
              📅 Hoje
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterOption, dateFilter === 'tomorrow' && styles.filterOptionActive]}
            onPress={() => {
              setDateFilter('tomorrow');
              setShowDateFilter(false);
            }}
          >
            <Text style={[styles.filterOptionText, dateFilter === 'tomorrow' && styles.filterOptionTextActive]}>
              📅 Amanhã
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterOption, dateFilter === 'week' && styles.filterOptionActive]}
            onPress={() => {
              setDateFilter('week');
              setShowDateFilter(false);
            }}
          >
            <Text style={[styles.filterOptionText, dateFilter === 'week' && styles.filterOptionTextActive]}>
              📅 Esta Semana
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterOption, dateFilter === 'overdue' && styles.filterOptionActive]}
            onPress={() => {
              setDateFilter('overdue');
              setShowDateFilter(false);
            }}
          >
            <Text style={[styles.filterOptionText, dateFilter === 'overdue' && styles.filterOptionTextActive]}>
              ⚠️ Atrasadas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterOption, dateFilter === 'all' && styles.filterOptionActive]}
            onPress={() => {
              setDateFilter('all');
              setShowDateFilter(false);
            }}
          >
            <Text style={[styles.filterOptionText, dateFilter === 'all' && styles.filterOptionTextActive]}>
              📋 Todas
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const getFilterLabel = (filter: DateFilter) => {
    switch (filter) {
      case 'today': return 'Hoje';
      case 'tomorrow': return 'Amanhã';
      case 'week': return 'Esta Semana';
      case 'overdue': return 'Atrasadas';
      case 'all': return 'Todas';
      default: return 'Filtrar';
    }
  };

  // Modal de Detalhes do Checkpoint
  const CheckpointDetailModal = () => (
    <Modal
      visible={showCheckpointModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setShowCheckpointModal(false)}
          >
            <Text style={styles.modalCloseText}>✕ Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Detalhes do Checkpoint</Text>
        </View>

        <ScrollView style={styles.modalContent}>
          {selectedCheckpointDetail && (
            <>
              <Text style={styles.modalCheckpointName}>
                {selectedCheckpointDetail.location.name}
              </Text>
              <Text style={styles.modalAddress}>
                {selectedCheckpointDetail.location.address}
              </Text>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>📅 Data e Hora</Text>
                <Text style={styles.modalSectionText}>
                  {selectedCheckpointDetail.checkedAt 
                    ? selectedCheckpointDetail.checkedAt.toLocaleString('pt-BR')
                    : 'Não verificado'
                  }
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>📍 Status</Text>
                <Text style={[
                  styles.modalSectionText,
                  { color: selectedCheckpointDetail.isVerified ? '#28A745' : '#DC3545' }
                ]}>
                  {selectedCheckpointDetail.isVerified ? '✅ Verificado' : '❌ Pendente'}
                </Text>
              </View>

              {selectedCheckpointDetail.photo && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>📸 Foto do Local</Text>
                  <Image 
                    source={{ uri: selectedCheckpointDetail.photo }} 
                    style={styles.modalPhoto}
                    resizeMode="cover"
                  />
                </View>
              )}

              {selectedCheckpointDetail.comment && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>💬 Comentário</Text>
                  <View style={styles.commentBox}>
                    <Text style={styles.commentText}>
                      {selectedCheckpointDetail.comment}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>🎯 Informações do Local</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Latitude:</Text>
                    <Text style={styles.infoValue}>
                      {selectedCheckpointDetail.location.latitude.toFixed(6)}
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Longitude:</Text>
                    <Text style={styles.infoValue}>
                      {selectedCheckpointDetail.location.longitude.toFixed(6)}
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Tolerância:</Text>
                    <Text style={styles.infoValue}>
                      {selectedCheckpointDetail.location.toleranceRadius}m
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Obrigatório:</Text>
                    <Text style={styles.infoValue}>
                      {selectedCheckpointDetail.location.required ? 'Sim' : 'Não'}
                    </Text>
                  </View>
                </View>
              </View>

              {selectedCheckpointDetail.comment?.includes('[Marcado fora do local') && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    ⚠️ Este checkpoint foi marcado fora do local permitido
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  // View: Lista de Rotas
  if (view === 'list') {
    const filteredRoutes = getFilteredRoutes();

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Rotas Disponíveis</Text>
        </View>
        
        <DateFilterComponent />

        {!currentLocation && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Aguardando localização...
            </Text>
          </View>
        )}

        {currentLocation && (
          <View style={styles.locationBox}>
            <Text style={styles.locationText}>
              📍 Localização ativa - {getFilteredRoutes().length} rotas encontradas
            </Text>
          </View>
        )}

        {filteredRoutes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              📭 Nenhuma rota encontrada para {getFilterLabel(dateFilter).toLowerCase()}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Tente alterar o filtro de data
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredRoutes}
            renderItem={({ item }) => {
              const dateBadge = getDateBadge(item.scheduledDate);
              return (
                <TouchableOpacity 
                  style={styles.routeCard}
                  onPress={() => handleSelectRoute(item)}
                >
                  <View style={styles.routeHeader}>
                    <View style={styles.routeTitleContainer}>
                      <Text style={styles.routeName}>{item.name}</Text>
                      <Text style={[styles.priorityBadge, { color: getPriorityColor(item.priority) }]}>
                        {getPriorityIcon(item.priority)} {item.priority.toUpperCase()}
                      </Text>
                    </View>
                    <View style={[styles.dateBadge, { backgroundColor: dateBadge.bgColor }]}>
                      <Text style={[styles.dateBadgeText, { color: dateBadge.color }]}>
                        {dateBadge.text}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.routeDate}>
                    📅 {formatDate(item.scheduledDate)}
                  </Text>
                  
                  <Text style={styles.routeStatus}>
                    Status: {item.status === 'pending' ? '🟡 Pendente' : 
                            item.status === 'in-progress' ? '🟠 Em Andamento' : '🟢 Concluída'}
                  </Text>
                  <Text style={styles.checkpointsCount}>
                    ✅ {item.checkpoints.filter(cp => cp.isVerified).length} / {item.checkpoints.length} verificados
                  </Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill,
                        { 
                          width: `${(item.checkpoints.filter(cp => cp.isVerified).length / item.checkpoints.length) * 100}%` 
                        }
                      ]} 
                    />
                  </View>
                </TouchableOpacity>
              );
            }}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
          />
        )}
        <CheckpointDetailModal />
      </View>
    );
  }

  // View: Detalhes da Rota
  if (!selectedRoute || !currentCheckpoint) {
    return (
      <View style={styles.container}>
        <Text>Carregando...</Text>
        <CheckpointDetailModal />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setView('list')}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{selectedRoute.name}</Text>
        </View>

        {/* Informações da Rota */}
        <View style={styles.routeInfoCard}>
          <Text style={styles.routeInfoDate}>
            📅 {formatDate(selectedRoute.scheduledDate)}
          </Text>
          <Text style={[styles.routeInfoPriority, { color: getPriorityColor(selectedRoute.priority) }]}>
            {getPriorityIcon(selectedRoute.priority)} Prioridade {selectedRoute.priority}
          </Text>
        </View>

        {/* Resto do código da tela de detalhes permanece igual */}
        <View style={styles.checkpointCard}>
          <Text style={styles.checkpointName}>{currentCheckpoint.location.name}</Text>
          <Text style={styles.address}>{currentCheckpoint.location.address}</Text>
          
          <View style={styles.locationInfo}>
            <Text style={[styles.distance, { color: getDistanceColor() }]}>
              📍 Distância: {distance.toFixed(0)} metros
              <Text style={styles.tolerance}>
                (Tolerância: {currentCheckpoint.location.toleranceRadius}m)
              </Text>
            </Text>
            <Text style={[styles.status, { color: getDistanceColor() }]}>
              {getDistanceStatus()}
            </Text>
            
            {!isAtLocation && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Você está fora do raio permitido. 
                  {forceAllow ? ' Modo forçado ativado - pode marcar.' : ' Pode marcar forçadamente se necessário.'}
                </Text>
              </View>
            )}
          </View>

          {/* Seção de Foto */}
          <Text style={styles.sectionTitle}>📸 Foto do Local {!isAtLocation && '(Obrigatória)'}</Text>
          <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoButtonText}>Tirar Foto</Text>
                <Text style={styles.photoSubtext}>Toque para capturar</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Seção de Comentário */}
          <Text style={styles.sectionTitle}>
            💬 Comentário {!currentCheckpoint.location.required && '(Opcional)'}
            {!isAtLocation && ' - Recomendado explicar motivo'}
          </Text>
          <TextInput
            style={styles.commentInput}
            placeholder={
              isAtLocation 
                ? "Adicione um comentário sobre este local..." 
                : "Explique por que está marcando fora do local (recomendado)..."
            }
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
          />

          {/* Botão de Verificação */}
          <TouchableOpacity 
            style={[
              styles.verifyButton,
              (!photo) && styles.verifyButtonDisabled,
              !isAtLocation && styles.verifyButtonWarning
            ]}
            onPress={completeCheckpoint}
            disabled={!photo}
          >
            <Text style={styles.verifyButtonText}>
              {!photo 
                ? '📸 Tire uma foto primeiro' 
                : isAtLocation 
                  ? '✅ Verificar Checkpoint' 
                  : forceAllow
                    ? '⚠️ Confirmar Fora do Local'
                    : `🚫 Marcar Fora do Local (${distance.toFixed(0)}m)`
              }
            </Text>
          </TouchableOpacity>

          {!isAtLocation && !forceAllow && (
            <Text style={styles.helperText}>
              💡 Dica: Se não consegue chegar ao local, tire uma foto do local à distância e explique no comentário.
            </Text>
          )}
        </View>

        {/* Progresso da Rota */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Progresso da Rota</Text>
          <Text style={styles.progressText}>
            {selectedRoute.checkpoints.filter(cp => cp.isVerified).length} / {selectedRoute.checkpoints.length} concluídos
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${(selectedRoute.checkpoints.filter(cp => cp.isVerified).length / selectedRoute.checkpoints.length) * 100}%` 
                }
              ]} 
            />
          </View>
          
          {/* Lista de Checkpoints */}
          <Text style={styles.checkpointsListTitle}>Checkpoints:</Text>
          {selectedRoute.checkpoints.map((checkpoint, index) => (
            <TouchableOpacity 
              key={checkpoint.location.id} 
              style={[
                styles.checkpointItem,
                checkpoint.isVerified && styles.verifiedCheckpointItem
              ]}
              onPress={() => checkpoint.isVerified && viewCheckpointDetails(checkpoint)}
              disabled={!checkpoint.isVerified}
            >
              <View style={styles.checkpointIndicator}>
                {checkpoint.isVerified ? (
                  <Text style={styles.verifiedIcon}>✅</Text>
                ) : checkpoint.location.id === currentCheckpoint.location.id ? (
                  <Text style={styles.currentIcon}>🟠</Text>
                ) : (
                  <Text style={styles.pendingIcon}>⭕</Text>
                )}
              </View>
              <View style={styles.checkpointInfo}>
                <Text style={[
                  styles.checkpointItemName,
                  checkpoint.isVerified && styles.verifiedText,
                  checkpoint.location.id === currentCheckpoint.location.id && styles.currentText
                ]}>
                  {checkpoint.location.name}
                  {checkpoint.location.id === currentCheckpoint.location.id && ' (Atual)'}
                </Text>
                {checkpoint.checkedAt && (
                  <Text style={styles.checkpointTime}>
                    Verificado: {checkpoint.checkedAt.toLocaleTimeString()}
                    {checkpoint.comment?.includes('[Marcado fora do local') && ' ⚠️ Fora do local'}
                  </Text>
                )}
                {checkpoint.isVerified && (
                  <Text style={styles.viewDetailsText}>
                    👆 Toque para ver detalhes e foto
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Informações de Localização Atual */}
        {currentLocation && (
          <View style={styles.locationCard}>
            <Text style={styles.locationTitle}>📍 Sua Localização Atual</Text>
            <Text style={styles.locationCoords}>
              Lat: {currentLocation.latitude.toFixed(6)}
            </Text>
            <Text style={styles.locationCoords}>
              Lng: {currentLocation.longitude.toFixed(6)}
            </Text>
          </View>
        )}
      </ScrollView>
      <CheckpointDetailModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  // Filtro de Data
  filterContainer: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 1000,
  },
  filterButton: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  filterOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterOptionActive: {
    backgroundColor: '#007AFF',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#333',
  },
  filterOptionTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  // Estilos dos cards de rota
  routeCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  routeTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  routeName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  priorityBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  routeDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  routeInfoCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeInfoDate: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  routeInfoPriority: {
    fontSize: 14,
    fontWeight: '600',
  },
  routeStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  checkpointsCount: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  emptyState: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  // Resto dos estilos permanecem iguais...
  warningBox: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  warningText: {
    color: '#856404',
    textAlign: 'center',
    fontSize: 12,
  },
  locationBox: {
    backgroundColor: '#D1ECF1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0CA789',
  },
  locationText: {
    color: '#0C5460',
    textAlign: 'center',
    fontSize: 12,
  },
  list: {
    paddingBottom: 20,
  },
  checkpointCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checkpointName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  locationInfo: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  distance: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  tolerance: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'normal',
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
    color: '#333',
  },
  photoButton: {
    height: 200,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
  },
  photoPlaceholder: {
    alignItems: 'center',
  },
  photoButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photoSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 20,
    backgroundColor: 'white',
    fontSize: 14,
  },
  verifyButton: {
    backgroundColor: '#28A745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  verifyButtonDisabled: {
    backgroundColor: '#6C757D',
  },
  verifyButtonWarning: {
    backgroundColor: '#FFC107',
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  progressCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#007AFF',
  },
  checkpointsListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  checkpointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  verifiedCheckpointItem: {
    backgroundColor: '#F8FFF8',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  checkpointIndicator: {
    width: 30,
    alignItems: 'center',
  },
  verifiedIcon: {
    fontSize: 16,
  },
  currentIcon: {
    fontSize: 16,
  },
  pendingIcon: {
    fontSize: 16,
  },
  checkpointInfo: {
    flex: 1,
  },
  checkpointItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  verifiedText: {
    color: '#28A745',
  },
  currentText: {
    color: '#FD7E14',
    fontWeight: 'bold',
  },
  checkpointTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  viewDetailsText: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  locationCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  locationCoords: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalCheckpointName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    textAlign: 'center',
  },
  modalAddress: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  modalSectionText: {
    fontSize: 14,
    color: '#666',
  },
  modalPhoto: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  commentBox: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
});