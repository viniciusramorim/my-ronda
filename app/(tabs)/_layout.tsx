import { Tabs, useRouter } from 'expo-router';
import React, { createContext, useContext, useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Criando um contexto para compartilhar o estado da ronda
const RondaContext = createContext({
  isTracking: false,
  setIsTracking: (value: boolean) => { }
});

export const useRonda = () => useContext(RondaContext);

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [isTracking, setIsTracking] = useState(false);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('loggedIn');
    router.replace('/(auth)/login');
  };

  return (
    <RondaContext.Provider value={{ isTracking, setIsTracking }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: true,
          headerRight: () => (
            !isTracking && (
              <Pressable onPress={handleLogout} style={{ marginRight: 16 }}>
                <Text style={{ color: Colors[colorScheme ?? 'light'].tint, fontWeight: '600' }}>Sair</Text>
              </Pressable>
            )
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
            title: 'Inicio',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
      </Tabs>
    </RondaContext.Provider>
  );
}