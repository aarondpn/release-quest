import type { MessageHandler } from './types.ts';
import type { ServerMessage } from '../../shared/messages.ts';
import * as network from '../network.ts';
import * as db from '../db.ts';
import * as quests from '../quests.ts';

export const handleGetQuests: MessageHandler = ({ ws, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info?.userId) {
    network.send(ws, { type: 'quests-data', quests: null, isGuest: true });
    return;
  }
  quests.getOrAssignQuests(info.userId).then(data => {
    network.send(ws, { type: 'quests-data', ...data, isGuest: false } as ServerMessage);
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
