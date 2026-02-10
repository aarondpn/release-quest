let wss = null;
const wsToPlayer = new Map();
const wsToLobby = new Map();

function init(server) {
  wss = server;
}

function broadcast(msg, exclude) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client !== exclude && client.readyState === 1) {
      client.send(data);
    }
  });
}

function broadcastToLobby(lobbyId, msg, exclude) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client !== exclude && client.readyState === 1 && wsToLobby.get(client) === lobbyId) {
      client.send(data);
    }
  });
}

function send(ws, msg) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

module.exports = { init, broadcast, broadcastToLobby, send, wsToPlayer, wsToLobby };
