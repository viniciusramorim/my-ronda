import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { otherDb } from '../../services/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

interface KmModalProps {
  visible: boolean;
  type: 'inicio' | 'fim' | null;
  kmValue: string;
  kmInicial: string;
  onKmChange: (text: string) => void;
  placaValue: string;
  onPlacaChange: (text: string) => void;
  image: string | null;
  onTakeImage: () => void;
  onCancel: () => void;
  onConfirm: (tipoRonda: string | null) => void;
  uploading: boolean;

  uid: string | null;
  buscarUltimoKmPorPlaca: (
    uid: string,
    placa: string
  ) => Promise<number | null>;

}

const KmModal: React.FC<KmModalProps> = ({
  visible,
  type,
  kmValue,
  kmInicial,
  onKmChange,
  placaValue,
  onPlacaChange,
  image,
  onTakeImage,
  onCancel,
  onConfirm,
  uploading,
  uid,
  buscarUltimoKmPorPlaca
}) => {
  //campo de classificação de ronda motorizada/qualificada

  const [tipoRonda, setTipoRonda] = React.useState<string | null>(null);
  const [opcoesRonda, setOpcoesRonda] = React.useState<any[]>([]);

  // Função para aplicar a máscara da placa
  const handlePlacaChange = (text: string) => {
    // Remove tudo que não é letra ou número e converte para maiúsculo
    let cleaned = text.replace(/[^A-ZA-z0-9]/g, '').toUpperCase();

    // Aplica a máscara AAA-0000
    if (cleaned.length > 3) {
      cleaned = cleaned.substring(0, 3) + '-' + cleaned.substring(3);
    }

    // Limita o tamanho total (3 letras + 1 hífen + 4 números = 8 caracteres)
    if (cleaned.length > 8) {
      cleaned = cleaned.substring(0, 8);
    }

    onPlacaChange(cleaned);
  };

  
const handleKmChange = (text: string) => {
  const cleaned = text.replace(/\D/g, "");
  onKmChange(cleaned);
};


  // Função para aplicar a máscara do KM (100.000)
  {/*const handleKmChange = (text: string) => {
    // Remove tudo que não é número, exceto ponto
    let cleaned = text.replace(/[^\d.]/g, '');
    
    // Remove pontos extras, mantendo apenas o último
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limita para apenas 1 ponto decimal
    if ((cleaned.match(/\./g) || []).length > 1) {
      cleaned = cleaned.replace(/\.+$/, '');
    }
    
    // Limita a 6 números antes do ponto e 3 depois (formato: 999999.999)
    const numberParts = cleaned.split('.');
    if (numberParts[0].length > 6) {
      numberParts[0] = numberParts[0].substring(0, 6);
    }
    if (numberParts[1] && numberParts[1].length > 3) {
      numberParts[1] = numberParts[1].substring(0, 3);
    }
    
    cleaned = numberParts.join('.');
    
    onKmChange(cleaned);
  };

  // Função para formatar o valor do KM para exibição (adiciona separadores de milhar)
  const formatKmDisplay = (value: string) => {
    if (!value) return value;
    
    const parts = value.split('.');
    let integerPart = parts[0];
    
    // Adiciona separadores de milhar
    if (integerPart.length > 3) {
      integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    
    return parts[1] ? integerPart + ',' + parts[1] : integerPart;
  };*/}

  const formatKmDisplay = (value: string) => {
    if (!value) return "";
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };
 
  
const normalizarKm = (valor: string): number => {
  if (!valor) return NaN;

  const somenteNumeros = valor.replace(/\D/g, "");

  const numero = Number(somenteNumeros);

  return isNaN(numero) ? NaN : numero;
};


  const handleConfirmPress = async () => {
    if (!kmValue.trim()) {
      Alert.alert('Erro', 'O campo KM é obrigatório.');
      return;
    }


    const kmAtual = normalizarKm(kmValue);
    const kmIni = normalizarKm(kmInicial);


    if (Number.isNaN(kmAtual) || kmAtual < 0) {
      Alert.alert('Erro', 'O KM deve ser um número inteiro válido.');
      return;
    }


    if (uid) {
      const ultimoKm = await buscarUltimoKmPorPlaca(uid, placaValue);

      if (ultimoKm !== null && kmAtual < ultimoKm) {
        Alert.alert(
          'Erro de Quilometragem',
          `O KM informado (${kmAtual}) é menor que o último registrado para esta placa (${ultimoKm}).`
        );
        return;
      }
    }

    // VERIFICAÇÃO DE KM FINAL
    if (type === 'fim') {

  // ✅ GARANTE QUE KM INICIAL EXISTE
  if (!kmInicial) {
    Alert.alert("Erro", "KM inicial não encontrado.");
    return;
  }

  if (isNaN(kmIni)) {
    Alert.alert("Erro", "KM inicial inválido.");
    return;
  }

  if (kmAtual < 0) {
    Alert.alert('Erro', 'KM final não pode ser negativo.');
    return;
  }

  if (kmAtual <= kmIni) {
    Alert.alert(
      'Erro de quilometragem',
      `O KM final (${kmAtual}) deve ser maior que o KM inicial (${kmIni}).`
    );
    return;
  }

  const diferenca = kmAtual - kmIni;

  //  DEBUG 
  console.log("KM INICIAL:", kmIni);
  console.log("KM FINAL:", kmAtual);
  console.log("DIFERENÇA:", diferenca);

  //  BLOQUEIO
  if (!isNaN(diferenca) && diferenca >= 1500) {
    Alert.alert(
      'Bloqueado',
      `Limite máximo de 1500 km ultrapassado (${diferenca}).`
    );
    return;
  }

  // ALERTA
  if (!isNaN(diferenca) && diferenca > 1000) {
    Alert.alert(
      'Atenção',
      `Percorrido ${diferenca} km. Deseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => onConfirm(tipoRonda) }
      ]
    );
    return;
  }
}
    onConfirm(tipoRonda);
  };


  if (!visible || !type) return null;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>
          {type === 'inicio' ? 'Quilometragem Inicial' : 'Quilometragem Final'}
        </Text>

        <TextInput
          style={styles.modalInput}
          placeholder={`Digite o KM ${type === 'inicio' ? 'inicial' : 'final'} (ex: 100.000)`}
          placeholderTextColor="#999"
          keyboardType="numeric"
          value={kmValue}
          onChangeText={handleKmChange}
          editable={!uploading}
        />

        <TextInput
          style={styles.modalInput}
          placeholder="Placa do Veículo (AAA-0000)"
          placeholderTextColor="#999"
          value={placaValue}
          onChangeText={handlePlacaChange}
          editable={!uploading}
          maxLength={8}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={styles.imageButton}
          onPress={onTakeImage}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>
            {image ? 'Alterar Imagem' : 'Adicionar Imagem'}
          </Text>
        </TouchableOpacity>

        {image && (
          <Image
            source={{ uri: image }}
            style={styles.imagePreview}
          />
        )}

        {uploading && (
          <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 10 }} />
        )}

        <View style={styles.modalButtonContainer}>
          <TouchableOpacity
            style={[styles.modalButton, styles.modalButtonCancel]}
            onPress={onCancel}
            disabled={uploading}
          >
            <Text style={styles.modalButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modalButton, styles.modalButtonConfirm]}
            onPress={handleConfirmPress}
            disabled={uploading}
          >
            <Text style={styles.modalButtonText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Estilos do componente (mantidos os mesmos)
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  imageButton: {
    backgroundColor: '#007BFF',
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 5,
    marginBottom: 10,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
    padding: 10,
    borderRadius: 5,
  },
  modalButtonCancel: {
    backgroundColor: '#dc3545',
  },
  modalButtonConfirm: {
    backgroundColor: '#28a745',
  },
  modalButtonText: {
    color: '#fff',
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#333",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },

  checkboxSelected: {
    width: 14,
    height: 14,
    backgroundColor: "#28a745",
    borderRadius: 3,
  },

  checkboxLabel: {
    fontSize: 15,
  },
});

export default KmModal;