const grpc = require('@grpc/grpc-js'); 
const protoLoader = require('@grpc/proto-loader'); 
const WebSocket = require('ws'); 
const path = require('path'); 
 
// Chemin vers le fichier proto 
const PROTO_PATH = path.join(__dirname, 'chat.proto'); 
 
// Chargement du fichier proto 
const packageDefinition = protoLoader.loadSync(PROTO_PATH, { 
  keepCase: true, 
  longs: String, 
  enums: String, 
  defaults: true, 
  oneofs: true, 
}); 
const chatProto = grpc.loadPackageDefinition(packageDefinition).chat; 
 
// Fonction pour créer un client gRPC 
function createGrpcClient() { 
  return new chatProto.ChatService('localhost:50051', 
grpc.credentials.createInsecure()); 
} 
 
// Création d'un serveur WebSocket servant de reverse proxy 
const wss = new WebSocket.Server({ port: 8080 }); 
console.log('Reverse proxy WebSocket en écoute sur ws://localhost:8080'); 
 
wss.on('connection', (ws) => {
  console.log('Nouveau client WebSocket connecté.');

  // Création d'un client gRPC
  const grpcClient = createGrpcClient();
  
  // Gestion des messages WebSocket
  ws.on('message', (message) => {
    console.log('Message reçu du client WebSocket:', message);
    try {
      const parsed = JSON.parse(message);
      
      // Si le client demande l'historique
      if (parsed.get_chat_history) {
        const roomId = parsed.get_chat_history.room_id;
        grpcClient.GetChatHistory({ room_id: roomId }, (error, response) => {
          if (error) {
            console.error('Erreur lors de la récupération de l\'historique:', error);
            ws.send(JSON.stringify({ error: 'Erreur lors de la récupération de l\'historique' }));
          } else {
            ws.send(JSON.stringify(response));
          }
        });
      } else {
        grpcStream.write(parsed);  // Relayer le message au stream gRPC
      }
    } catch (err) {
      console.error('Erreur lors de la conversion du message JSON:', err);
      ws.send(JSON.stringify({ error: 'Format JSON invalide' }));
    }
  });

  // Relayer les messages reçus du serveur gRPC vers le client WebSocket
  grpcStream.on('data', (chatStreamMessage) => {
    console.log('Message reçu du serveur gRPC:', chatStreamMessage);
    ws.send(JSON.stringify(chatStreamMessage));
  });

  grpcStream.on('end', () => {
    console.log('Stream gRPC terminé.');
    ws.close();
  });

  ws.on('close', () => {
    console.log('Client WebSocket déconnecté, fermeture du stream gRPC.');
    grpcStream.end();
  });
});
