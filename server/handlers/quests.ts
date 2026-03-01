import type { MessageHandler } from './types.ts';
import * as network from '../network.ts';
import * as db from '../db.ts';
import * as quests from '../quests.ts';
import type { ServerMessage } from '../types.ts';

/** Bridge for spread objects into ServerMessage */
function asServerMessage(msg: Record<string, unknown>): ServerMessage {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return msg as unknown as ServerMessage;
}

export const handleGetQuests: MessageHandler = ({ ws, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info?.userId) {
    network.send(ws, { type: 'quests-data', quests: null, isGuest: true });
    return;
  }
  quests.getOrAssignQuests(info.userId).then(data => {
    network.send(ws, asServerMessage({ type: 'quests-data', ...data, isGuest: false }));
  }).catch(() => {
    network.send(ws, { type: 'quests-data', quests: [], isGuest: false });
  });
};

export const handleGetBalance: MessageHandler = ({ ws, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info?.userId) {
    network.send(ws, { type: 'balance-data', balance: 0 });
    return;
  }
  db.getCurrencyBalance(info.userId).then(({ balance }) => {
    network.send(ws, { type: 'balance-data', balance });
  }).catch(() => {
    network.send(ws, { type: 'balance-data', balance: 0 });
  });
};
