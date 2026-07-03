// app/(tabs)/profile.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function ProfileScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordVisible, setPasswordVisible] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Carregar dados do usuário
  const loadUserData = useCallback(async () => {
    try {
      setLoadingUserData(true);
      const nome = await AsyncStorage.getItem('userName');
      const userUid = await AsyncStorage.getItem('userUid');
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      setUserName(nome);
      setUserUid(userUid);
      setUserEmail(userEmail);
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do usuário');
    } finally {
      setLoadingUserData(false);
    }
  }, []);

  // Carregar dados quando a tela for montada
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Recarregar dados quando a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  const validatePassword = (password: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
    };
  };

  const handleChangePassword = async () => {
    // Validações
    if (!formData.currentPassword.trim()) {
      Alert.alert('Erro', 'Por favor, digite sua senha atual');
      return;
    }

    if (!formData.newPassword.trim()) {
      Alert.alert('Erro', 'Por favor, digite a nova senha');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    const validation = validatePassword(formData.newPassword);
    if (!validation.isValid) {
      Alert.alert(
        'Senha insegura',
        'A senha deve conter:\n• Mínimo 8 caracteres\n• Letra maiúscula\n• Letra minúscula\n• Número\n• Caractere especial'
      );
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      Alert.alert('Erro', 'A nova senha deve ser diferente da atual');
      return;
    }

    setLoading(true);

    try {
      // Simulação de chamada à API
      // Aqui você implementaria a lógica real de troca de senha
      // Exemplo:
      // const response = await api.changePassword({
      //   currentPassword: formData.currentPassword,
      //   newPassword: formData.newPassword,
      //   userUid: userUid
      // });
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      Alert.alert(
        'Sucesso',
        'Senha alterada com sucesso!',
        [
          {
            text: 'OK',
            onPress: () => {
              setModalVisible(false);
              resetForm();
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível alterar a senha. Verifique sua senha atual.');
      console.error('Erro ao alterar senha:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordVisible({
      current: false,
      new: false,
      confirm: false,
    });
  };

  const renderPasswordRequirement = (label: string, isValid: boolean) => (
    <View style={styles.requirementRow}>
      <IconSymbol
        name={isValid ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
        size={16}
        color={isValid ? '#28a745' : '#dc3545'}
      />
      <Text style={[styles.requirementText, { color: isValid ? '#ffffff' : '#ff6b6b' }]}>
        {label}
      </Text>
    </View>
  );

  const handleLogout = async () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Sair',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['loggedIn', 'userName', 'userUid', 'userEmail']);
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Erro ao fazer logout:', error);
              Alert.alert('Erro', 'Não foi possível fazer logout');
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  const validation = validatePassword(formData.newPassword);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <IconSymbol name="person.circle.fill" size={80} color="#a855f7" />
          
          {loadingUserData ? (
            <ActivityIndicator size="small" color="#a855f7" style={styles.loadingIndicator} />
          ) : (
            <>
              <Text style={styles.userName}>
                {userName || 'Usuário'}
              </Text>
              <Text style={styles.userEmail}>
                {userEmail || 'usuario@exemplo.com'}
              </Text>
            </>
          )}
          
        </View>

        <View style={styles.menu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setModalVisible(true)}
          >
            <View style={styles.menuItemLeft}>
              <IconSymbol name="key.fill" size={24} color="#a855f7" />
              <Text style={styles.menuItemText}>Alterar Senha</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#c084fc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              // Recarregar dados do usuário
              loadUserData();
              Alert.alert('Atualizado', 'Dados do usuário recarregados!');
            }}
          >
            <View style={styles.menuItemLeft}>
              <IconSymbol name="arrow.clockwise" size={24} color="#a855f7" />
              <Text style={styles.menuItemText}>Recarregar Dados</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#c084fc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <IconSymbol name="bell.fill" size={24} color="#a855f7" />
              <Text style={styles.menuItemText}>Notificações</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#c084fc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <IconSymbol name="shield.fill" size={24} color="#a855f7" />
              <Text style={styles.menuItemText}>Privacidade</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#c084fc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, styles.logoutButton]} 
            onPress={handleLogout}
          >
            <View style={styles.menuItemLeft}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={24} color="#dc3545" />
              <Text style={[styles.menuItemText, styles.logoutText]}>Sair</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Modal de Troca de Senha */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(false);
            resetForm();
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Alterar Senha</Text>
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <IconSymbol name="xmark" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.userInfoModal}>
                  <Text style={styles.userInfoText}>
                    Usuário: <Text style={styles.userInfoValue}>{userName || 'Carregando...'}</Text>
                  </Text>
                  {userUid && (
                    <Text style={styles.userInfoText}>
                      ID: <Text style={styles.userInfoValue}>{userUid}</Text>
                    </Text>
                  )}
                </View>

                {/* Senha Atual */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Senha Atual</Text>
                  <View style={styles.passwordInput}>
                    <TextInput
                      style={styles.input}
                      value={formData.currentPassword}
                      onChangeText={(text) =>
                        setFormData({ ...formData, currentPassword: text })
                      }
                      secureTextEntry={!passwordVisible.current}
                      placeholder="Digite sua senha atual"
                      placeholderTextColor="#c084fc"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setPasswordVisible({
                          ...passwordVisible,
                          current: !passwordVisible.current,
                        })
                      }
                    >
                      <IconSymbol
                        name={passwordVisible.current ? 'eye.slash.fill' : 'eye.fill'}
                        size={24}
                        color="#c084fc"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Nova Senha */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Nova Senha</Text>
                  <View style={styles.passwordInput}>
                    <TextInput
                      style={styles.input}
                      value={formData.newPassword}
                      onChangeText={(text) =>
                        setFormData({ ...formData, newPassword: text })
                      }
                      secureTextEntry={!passwordVisible.new}
                      placeholder="Digite a nova senha"
                      placeholderTextColor="#c084fc"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setPasswordVisible({
                          ...passwordVisible,
                          new: !passwordVisible.new,
                        })
                      }
                    >
                      <IconSymbol
                        name={passwordVisible.new ? 'eye.slash.fill' : 'eye.fill'}
                        size={24}
                        color="#c084fc"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Validações da Senha */}
                  {formData.newPassword.length > 0 && (
                    <View style={styles.validationContainer}>
                      {renderPasswordRequirement(
                        'Mínimo 8 caracteres',
                        validation.minLength
                      )}
                      {renderPasswordRequirement(
                        'Letra maiúscula',
                        validation.hasUpperCase
                      )}
                      {renderPasswordRequirement(
                        'Letra minúscula',
                        validation.hasLowerCase
                      )}
                      {renderPasswordRequirement(
                        'Pelo menos um número',
                        validation.hasNumbers
                      )}
                      {renderPasswordRequirement(
                        'Pelo menos um caractere especial',
                        validation.hasSpecialChar
                      )}
                    </View>
                  )}
                </View>

                {/* Confirmar Senha */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Confirmar Nova Senha</Text>
                  <View style={styles.passwordInput}>
                    <TextInput
                      style={styles.input}
                      value={formData.confirmPassword}
                      onChangeText={(text) =>
                        setFormData({ ...formData, confirmPassword: text })
                      }
                      secureTextEntry={!passwordVisible.confirm}
                      placeholder="Confirme a nova senha"
                      placeholderTextColor="#c084fc"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setPasswordVisible({
                          ...passwordVisible,
                          confirm: !passwordVisible.confirm,
                        })
                      }
                    >
                      <IconSymbol
                        name={passwordVisible.confirm ? 'eye.slash.fill' : 'eye.fill'}
                        size={24}
                        color="#c084fc"
                      />
                    </TouchableOpacity>
                  </View>
                  {formData.confirmPassword.length > 0 &&
                    formData.newPassword.length > 0 && (
                      <View style={styles.confirmationContainer}>
                        <IconSymbol
                          name={
                            formData.newPassword === formData.confirmPassword
                              ? 'checkmark.circle.fill'
                              : 'xmark.circle.fill'
                          }
                          size={16}
                          color={
                            formData.newPassword === formData.confirmPassword
                              ? '#28a745'
                              : '#dc3545'
                          }
                        />
                        <Text
                          style={[
                            styles.confirmationText,
                            {
                              color:
                                formData.newPassword === formData.confirmPassword
                                  ? '#28a745'
                                  : '#dc3545',
                            },
                          ]}
                        >
                          {formData.newPassword === formData.confirmPassword
                            ? 'Senhas coincidem'
                            : 'Senhas não coincidem'}
                        </Text>
                      </View>
                    )}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.saveButton,
                    (!formData.currentPassword ||
                      !formData.newPassword ||
                      !formData.confirmPassword ||
                      loading ||
                      !validation.isValid ||
                      formData.newPassword !== formData.confirmPassword) &&
                    styles.disabledButton,
                  ]}
                  onPress={handleChangePassword}
                  disabled={
                    !formData.currentPassword ||
                    !formData.newPassword ||
                    !formData.confirmPassword ||
                    loading ||
                    !validation.isValid ||
                    formData.newPassword !== formData.confirmPassword
                  }
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a003f',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#3a004f',
    borderBottomWidth: 1,
    borderBottomColor: '#4a005f',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#ffffff',
  },
  userEmail: {
    fontSize: 16,
    color: '#c084fc',
    marginTop: 4,
  },
  uidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  uidLabel: {
    fontSize: 12,
    color: '#c084fc',
    fontWeight: '600',
  },
  uidValue: {
    fontSize: 12,
    color: '#ffffff',
    flex: 1,
  },
  loadingIndicator: {
    marginTop: 20,
  },
  menu: {
    backgroundColor: '#3a004f',
    marginTop: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#4a005f',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#4a005f',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 17,
    marginLeft: 16,
    color: '#ffffff',
  },
  logoutButton: {
    borderTopWidth: 1,
    borderTopColor: '#4a005f',
    marginTop: 10,
  },
  logoutText: {
    color: '#ff6b6b',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#3a004f',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#4a005f',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalBody: {
    padding: 20,
  },
  userInfoModal: {
    backgroundColor: 'rgba(42, 0, 63, 0.8)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c084fc',
  },
  userInfoText: {
    fontSize: 14,
    color: '#c084fc',
    marginBottom: 4,
  },
  userInfoValue: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#4a005f',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#ffffff',
  },
  passwordInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c084fc',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#2a003f',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 17,
    color: '#ffffff',
  },
  validationContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(42, 0, 63, 0.8)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c084fc',
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  requirementText: {
    fontSize: 14,
    marginLeft: 8,
  },
  confirmationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  confirmationText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '600',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#28a745',
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: 'rgba(170, 170, 170, 0.5)',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
});