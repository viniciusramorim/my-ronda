import { Tabs, useRouter } from 'expo-router';
import { Platform, Pressable, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { RondaProvider } from '@/context/RondaContext';
import { useAppStateHandler } from '@/hooks/useAppStateHandler';

export default function TabLayout() {
  useAppStateHandler(); // Isso ativará o listener em toda a aplicação
  const colorScheme = useColorScheme();
  const router = useRouter();

  const handleLogout = async () => {
    await AsyncStorage.removeItem('loggedIn');
    router.replace('/(auth)/login');
  };

  return (
    <RondaProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={handleLogout} style={{ marginRight: 16 }}>
              <Text style={{ 
                color: Colors[colorScheme ?? 'light'].tint, 
                fontWeight: '600'
              }}>
                Sair
              </Text>
            </Pressable>
          ),
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
          }),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Eventos de Ronda',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Histórico',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="clock.fill" color={color} />,
          }}
        />
      </Tabs>
    </RondaProvider>
  );
}