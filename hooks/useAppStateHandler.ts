import { useEffect } from 'react';
import { AppState, AppStateStatus, BackHandler } from 'react-native';
import { useRonda } from '@/context/RondaContext'; // Ajuste o caminho conforme necessário

export const useAppStateHandler = () => {
  const { isTracking, stopTracking } = useRonda();

  useEffect(() => {
    let backgroundTimer: NodeJS.Timeout;
    const BACKGROUND_TIMEOUT = 5000; // 5 segundos

    const handleClose = async () => {
      if (isTracking) {
        await stopTracking();
      }
    };

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        // Inicia o timer quando o app vai para segundo plano
        backgroundTimer = setTimeout(handleClose, BACKGROUND_TIMEOUT);
      } else if (nextAppState === 'active') {
        // Cancela o timer se o app voltar para primeiro plano
        clearTimeout(backgroundTimer);
      }
      
      // Mantém a lógica original para estado 'inactive'
      if (nextAppState === 'inactive' && isTracking) {
        await stopTracking();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Para Android - lidar com o botão voltar
    const backAction = () => {
      if (isTracking) {
        stopTracking();
        return true; // Impede o fechamento padrão
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => {
      clearTimeout(backgroundTimer);
      subscription.remove();
      backHandler.remove();
    };
  }, [isTracking, stopTracking]);
};