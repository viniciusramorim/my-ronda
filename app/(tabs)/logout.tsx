// app/(tabs)/logout.tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LogoutScreen() {
  const router = useRouter();

  useEffect(() => {
    const logout = async () => {
      await AsyncStorage.removeItem('loggedIn');
      router.replace('/(auth)/login');
    };

    logout();
  }, []);

  return null;
}
