import { StyleSheet } from 'react-native';

// Estilos (mantidos iguais do código anterior)
const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#2a003f',
      paddingTop: 40,
      paddingHorizontal: 20,
    },
    scrollContainer: {
      paddingBottom: 100,
    },
    welcomeText: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: '#ffffff',
    },
    button: {
      borderRadius: 5,
      paddingVertical: 15,
      alignItems: 'center',
      marginVertical: 10,
    },
    buttonStart: {
      backgroundColor: '#28a745',
    },
    buttonStop: {
      backgroundColor: '#dc3545',
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 18,
    },
    pickerContainer: {
      borderColor: '#ccc',
      borderWidth: 1,
      borderRadius: 5,
      marginBottom: 15,
    },
    picker: {
      height: 60,
      width: '100%',
      color: '#ffffff',
    },
    detailsContainer: {
      marginTop: 20,
      padding: 10,
      backgroundColor: '#ffffff',
      borderRadius: 5,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 5,
    },
    detailsTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 10,
      color: '#333',
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 5,
    },
    detailLabel: {
      fontWeight: 'bold',
      color: '#333',
    },
    detailValue: {
      color: '#555',
    },
    checkpointsContainer: {
      marginTop: 10,
      padding: 10,
      backgroundColor: '#eef',
      borderRadius: 5,
    },
    checkpointsTitle: {
      fontWeight: 'bold',
      color: '#007BFF',
    },
    checkpointItem: {
      padding: 5,
      borderBottomWidth: 1,
      borderColor: '#ddd',
    },
    checkpointSite: {
      fontWeight: 'bold',
    },
    checkpointMotivo: {
      color: '#555',
    },
    checkpointTime: {
      fontSize: 12,
      color: '#777',
    },
    panicButton: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      backgroundColor: '#dc3545',
      borderRadius: 50,
      padding: 15,
      elevation: 5,
    },
    buttonCheckpoint: {
      backgroundColor: '#007BFF',
      borderRadius: 5,
      paddingVertical: 15,
      alignItems: 'center',
      marginVertical: 10,
    },
    buttonDisabled: {
      backgroundColor: 'rgba(170, 170, 170, 0.5)',
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      backgroundColor: 'white',
      borderRadius: 10,
      padding: 20,
      width: '90%',
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 15,
      textAlign: 'center',
    },
    modoRotaButton: {
      padding: 20,
      borderWidth: 2,
      borderColor: '#e0e0e0',
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 15,
      backgroundColor: '#f8f9fa',
    },
    modoRotaTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 10,
      color: '#333',
    },
    modoRotaDescricao: {
      fontSize: 14,
      color: '#666',
      textAlign: 'center',
      marginTop: 5,
    },
    rotasList: {
      maxHeight: 300,
    },
    rotaItem: {
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },
    rotaNome: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
    },
    rotaPontos: {
      fontSize: 12,
      color: '#666',
      marginTop: 5,
    },
    rotaContainer: {
      marginTop: 20,
      padding: 15,
      backgroundColor: '#f8f9fa',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#dee2e6',
    },
    rotaTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 10,
    },
    progressContainer: {
      marginBottom: 15,
    },
    progressText: {
      fontSize: 14,
      color: '#666',
      marginBottom: 5,
    },
    progressBar: {
      height: 8,
      backgroundColor: '#e9ecef',
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#28a745',
      borderRadius: 4,
    },
    proximoPontoContainer: {
      backgroundColor: '#d1ecf1',
      padding: 10,
      borderRadius: 5,
      marginBottom: 15,
    },
    proximoPontoTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#0c5460',
    },
    proximoPonto: {
      fontSize: 16,
      color: '#0c5460',
      fontWeight: 'bold',
    },
    pontosList: {
      maxHeight: 300,
      marginTop:10,
     
    },
    pontoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },
    pontoConcluido: {
      backgroundColor: '#d4edda',
    },
    pontoText: {
      flex: 1,
      marginLeft: 10,
      color: '#333',
    },
    pontoTime: {
      fontSize: 12,
      color: '#666',
    },
    buttonCancel: {
      backgroundColor: '#6c757d',
      borderRadius: 5,
      padding: 15,
      alignItems: 'center',
      marginTop: 10,
    },
    modoInfoContainer: {
      backgroundColor: '#e7f3ff',
      padding: 10,
      borderRadius: 5,
      marginBottom: 15,
      borderLeftWidth: 4,
      borderLeftColor: '#007BFF',
    },
    modoInfoText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#007BFF',
    },
    rotaAtivaText: {
      fontSize: 14,
      color: '#0056b3',
      marginTop: 5,
    },
    rotaLivreContainer: {
      marginTop: 20,
      padding: 15,
      backgroundColor: '#e7f3ff',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#b3d9ff',
    },
    rotaLivreTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#007BFF',
      marginBottom: 10,
    },
    rotaLivreDescricao: {
      fontSize: 14,
      color: '#0056b3',
      lineHeight: 20,
      marginBottom: 15,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#007BFF',
    },
    statLabel: {
      fontSize: 12,
      color: '#0056b3',
      marginTop: 5,
    },
    trocaVeiculoContainer: {
      marginTop: 10,
      padding: 10,
      backgroundColor: '#fff3cd',
      borderRadius: 5,
      borderLeftWidth: 4,
      borderLeftColor: '#ffc107',
    },
    trocaVeiculoTitle: {
      fontWeight: 'bold',
      color: '#856404',
      marginBottom: 5,
    },
    // Adicione ao seu StyleSheet
    carregandoContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    carregandoText: {
        marginTop: 10,
        color: '#666',
        textAlign: 'center',
    },
    semRotasContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    semRotasText: {
        fontSize: 16,
        color: '#666',
        marginTop: 10,
        textAlign: 'center',
    },
    semRotasSubtext: {
        fontSize: 14,
        color: '#999',
        marginTop: 5,
        textAlign: 'center',
    },
    rotaStatus: {
        fontSize: 12,
        color: '#28a745',
        marginTop: 2,
        fontWeight: 'bold',
    },
    buttonRecarregar: {
        backgroundColor: '#17a2b8',
        borderRadius: 5,
        padding: 15,
        alignItems: 'center',
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    // No seu arquivo styles.js
    proximoPontoContainerProximo: {
        backgroundColor: '#d4edda',
        borderColor: '#c3e6cb',
    },
    distanciaText: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
        fontStyle: 'italic',
    },
    distanciaInfo: {
        marginTop: 8,
    },
    registroPermitidoText: {
        fontSize: 12,
        color: '#28a745',
        marginTop: 2,
        fontWeight: '500',
    },
    avisoDistanciaText: {
        fontSize: 11,
        color: '#ffc107',
        marginTop: 2,
        fontStyle: 'italic',
    },
    // No seu arquivo de estilos, adicione:
    navegacaoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007BFF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 12,
        gap: 8,
    },
    navegacaoButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    // Adicione estes estilos ao seu arquivo de estilos
    modalSubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 15,
    },
    sitesList: {
        maxHeight: 400,
        marginBottom: 10,
    },
    siteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    siteItemMaisProximo: {
        backgroundColor: '#f0f8ff',
        borderLeftWidth: 4,
        borderLeftColor: '#007BFF',
    },
    siteInfo: {
        flex: 1,
    },
    siteNome: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    siteEndereco: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    siteDistancia: {
        fontSize: 12,
        color: '#007BFF',
        marginBottom: 2,
    },
    siteRegional: {
        fontSize: 12,
        color: '#28a745',
    },
    rondaSelectionContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 15,
        borderRadius: 15,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 15,
        textAlign: 'center',
    },
    rondaButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    modoRotaButtonHome: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    modoRotaTitleHome: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 8,
        textAlign: 'center',
    },
});

export default styles;