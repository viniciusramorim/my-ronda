// hooks/useVersionCheck.ts
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { VersionService } from '@/services/versionService';

export const useVersionCheck = (checkOnStart: boolean = true) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const checkForUpdates = async (force: boolean = false) => {
    try {
      setCheckingUpdate(true);
      await VersionService.performUpdateCheck(force);
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    if (checkOnStart) {
      // Verificar atualizações quando o app inicia
      checkForUpdates();
    }

    // Verificar atualizações quando o app volta para foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkForUpdates();
      }
    });

    return () => subscription.remove();
  }, [checkOnStart]);

  return { checkingUpdate, checkForUpdates };
};