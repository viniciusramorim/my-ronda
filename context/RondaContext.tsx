import { createContext, useContext, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { otherDb } from '@/services/firebaseConfig';

interface RondaContextType {
  isTracking: boolean;
  setIsTracking: (value: boolean) => void;
  stopTracking: () => Promise<void>;
}

const RondaContext = createContext<RondaContextType>({
  isTracking: false,
  setIsTracking: () => {},
  stopTracking: async () => {}
});

export const RondaProvider = ({ children }: { children: React.ReactNode }) => {
  const [isTracking, setIsTracking] = useState(false);

  const stopTracking = async () => {
    try {
      const uid = await AsyncStorage.getItem('userUid');
      if (uid) {
        const userRef = doc(otherDb, 'usuarios', uid);
        await updateDoc(userRef, {
          status_ronda: "Parado"
        });
      }
      setIsTracking(false);
      console.log('Ronda finalizada');
    } catch (error) {
      console.error('Erro ao finalizar ronda:', error);
    }
  };

  return (
    <RondaContext.Provider value={{ isTracking, setIsTracking, stopTracking }}>
      {children}
    </RondaContext.Provider>
  );
};

export const useRonda = () => useContext(RondaContext);