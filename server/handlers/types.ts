import type { WebSocket } from 'ws';
import type { PlayerInfo } from '../types.ts';

export interface HandlerContext<TMsg = any> {
  ws: WebSocket;
  msg: TMsg;
  pid: string;
  playerInfo: Map<string, PlayerInfo>;
  wss: any;
}

export type MessageHandler<TMsg = any> = (ctx: HandlerContext<TMsg>) => Promise<void> | void;
