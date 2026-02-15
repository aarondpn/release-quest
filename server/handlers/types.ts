import type { WebSocket } from 'ws';
import type { PlayerInfo } from '../types.ts';

export interface HandlerContext {
  ws: WebSocket;
  msg: any;
  pid: string;
  playerInfo: Map<string, PlayerInfo>;
  wss: any;
}

export type MessageHandler = (ctx: HandlerContext) => Promise<void> | void;
