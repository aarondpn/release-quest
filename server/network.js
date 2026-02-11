let wss = null;
const wsToPlayer = new Map();
const wsToLobby = new Map();
const lobbyClients = new Map();

function init(server) {
  wss = server;
}

function addClientToLobby(lobbyId, ws) {
  let set = lobbyClients.get(lobbyId);
  if (!set) {
    set = new Set();
    lobbyClients.set(lobbyId, set);
  }
  set.add(ws);
}

function removeClientFromLobby(lobbyId, ws) {
  const set = lobbyClients.get(lobbyId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) {
      lobbyClients.delete(lobbyId);
    }
  }
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
  const set = lobbyClients.get(lobbyId);
  if (!set) return;
  const data = JSON.stringify(msg);
  for (const client of set) {
    if (client !== exclude && client.readyState === 1) {
      client.send(data);
    }
  }
}

function send(ws, msg) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

module.exports = { init, broadcast, broadcastToLobby, send, wsToPlayer, wsToLobby, lobbyClients, addClientToLobby, removeClientFromLobby };
