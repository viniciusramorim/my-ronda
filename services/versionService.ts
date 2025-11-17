// services/versionService.ts
import { doc, getDoc } from 'firebase/firestore';
import { otherDb } from './firebaseConfig';
import { Alert, Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppVersion {
  version: string;
  buildNumber: string;
  mandatory: boolean;
  downloadUrl: string;
  releaseNotes: string;
  timestamp: any;
}

const VERSION_COLLECTION = 'app_versions';
const CURRENT_PLATFORM = Platform.OS; // 'android' ou 'ios'

export class VersionService {
  // Obter versão atual do app
  static async getCurrentVersion(): Promise<{ version: string; buildNumber: string }> {
    try {
      const version = Application.nativeApplicationVersion || '1.0.0';
      const buildNumber = Application.nativeBuildVersion || '1';
      
      return { version, buildNumber };
    } catch (error) {
      console.error('Erro ao obter versão atual:', error);
      return { version: '1.0.0', buildNumber: '1' };
    }
  }

  // Verificar se há nova versão disponível
  static async checkForUpdates(): Promise<{ hasUpdate: boolean; latestVersion?: AppVersion }> {
    try {
      const currentVersion = await this.getCurrentVersion();
      console.log('Versão atual:', currentVersion);

      // Buscar versão mais recente no Firestore
      const versionDocRef = doc(otherDb, VERSION_COLLECTION, CURRENT_PLATFORM);
      const versionDoc = await getDoc(versionDocRef);

      if (!versionDoc.exists()) {
        console.log('Nenhuma configuração de versão encontrada no Firestore');
        return { hasUpdate: false };
      }

      const latestVersion = versionDoc.data() as AppVersion;
      console.log('Última versão disponível:', latestVersion);

      // Comparar versões
      const hasUpdate = this.compareVersions(currentVersion.version, latestVersion.version) > 0;

      return { hasUpdate, latestVersion };
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
      return { hasUpdate: false };
    }
  }

  // Comparar versões (retorna 1 se version1 > version2, -1 se version1 < version2, 0 se iguais)
  static compareVersions(version1: string, version2: string): number {
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0;
      const num2 = v2[i] || 0;

      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }

    return 0;
  }

  // Mostrar diálogo de atualização
  static async showUpdateDialog(latestVersion: AppVersion): Promise<void> {
    return new Promise((resolve) => {
      const buttons = [
        {
          text: 'Atualizar Agora',
          onPress: () => {
            this.downloadUpdate(latestVersion.downloadUrl);
            resolve();
          }
        }
      ];

      // Se não for obrigatório, adicionar botão "Mais Tarde"
      if (!latestVersion.mandatory) {
        buttons.push({
          text: 'Mais Tarde',
          style: 'cancel',
          onPress: () => resolve()
        });
      }

      Alert.alert(
        'Nova Versão Disponível! 🚀',
        `Versão ${latestVersion.version}\n\n${latestVersion.releaseNotes}`,
        buttons,
        { cancelable: !latestVersion.mandatory }
      );
    });
  }

  // Abrir URL para download
  static async downloadUpdate(downloadUrl: string): Promise<void> {
    try {
      const canOpen = await Linking.canOpenURL(downloadUrl);
      if (canOpen) {
        await Linking.openURL(downloadUrl);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir o link de download.');
      }
    } catch (error) {
      console.error('Erro ao abrir URL de download:', error);
      Alert.alert('Erro', 'Não foi possível iniciar o download.');
    }
  }

  // Verificar se já mostrou o alerta para esta versão
  static async hasShownAlertForVersion(version: string): Promise<boolean> {
    try {
      const shownVersion = await AsyncStorage.getItem('lastShownUpdateVersion');
      return shownVersion === version;
    } catch (error) {
      return false;
    }
  }

  // Marcar que o alerta foi mostrado para esta versão
  static async markAlertAsShown(version: string): Promise<void> {
    try {
      await AsyncStorage.setItem('lastShownUpdateVersion', version);
    } catch (error) {
      console.error('Erro ao salvar versão do alerta:', error);
    }
  }

  // Verificação completa de atualizações
  static async performUpdateCheck(forceCheck: boolean = false): Promise<boolean> {
    try {
      const { hasUpdate, latestVersion } = await this.checkForUpdates();

      if (hasUpdate && latestVersion) {
        // Se for verificação forçada ou ainda não mostrou o alerta para esta versão
        if (forceCheck || !(await this.hasShownAlertForVersion(latestVersion.version))) {
          await this.showUpdateDialog(latestVersion);
          await this.markAlertAsShown(latestVersion.version);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Erro na verificação de atualizações:', error);
      return false;
    }
  }
}