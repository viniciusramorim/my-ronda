import { Tabs } from 'expo-router';
import React, { createContext, useContext, useState } from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';

// Criando um contexto para compartilhar o estado da ronda
const RondaContext = createContext({
  isTracking: false,
  setIsTracking: (value: boolean) => { }
});

export const useRonda = () => useContext(RondaContext);

export default function TabLayout() {
  const [isTracking, setIsTracking] = useState(false);

  return (
    <RondaContext.Provider value={{ isTracking, setIsTracking }}>
      <Tabs
        screenOptions={{
          headerShown: false,
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
        <Tabs.Screen
          name="logout"
          options={{
            title: 'Sair',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="chevron.right" color={color} />,
          }}
        />
      </Tabs>
    </RondaContext.Provider>
  );
}