import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (loaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [loaded, fontError]);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const logged = await AsyncStorage.getItem('loggedIn');
        setIsLoggedIn(logged === 'true');
      } catch {
        setIsLoggedIn(false);
      }
    };
    checkLogin();
  }, []);

  if ((!loaded && !fontError) || isLoggedIn === null) {
    return null; // Ou um componente de carregamento
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {isLoggedIn ? (
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        )}
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}