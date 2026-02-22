import { dom, clientState } from './state.ts';
import { isPremium, renderIcon } from './avatars.ts';
import type { SendMessageFn } from './client-types.ts';
import type { ChatBroadcastMsg } from '../../shared/messages.ts';

let _sendMessage: SendMessageFn | null = null;
let isChatOpen = false;
let unreadCount = 0;

export function initChatSend(fn: SendMessageFn): void { _sendMessage = fn; }

export function initChat(): void {
  dom.chatSendBtn!.addEventListener('click', sendChat);
  dom.chatInput!.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') sendChat();
  });
  dom.chatToggleBtn!.addEventListener('click', toggleChat);
  dom.chatHandle!.addEventListener('click', () => closeChat());

  // On mobile, adjust chat panel when virtual keyboard opens/closes
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (!isChatOpen) return;
      const offset = window.innerHeight - window.visualViewport!.height;
      dom.chatPanel!.style.bottom = offset + 'px';
    });
  }
}

function sendChat(): void {
  if (!_sendMessage) return;
  const text = dom.chatInput!.value.trim();
  if (!text) return;
  _sendMessage({ type: 'chat-message', message: text });
  dom.chatInput!.value = '';
}

export function handleChatBroadcast(msg: ChatBroadcastMsg): void {
  const el = document.createElement('div');

  if (msg.system) {
    el.className = 'chat-msg-system';
    el.textContent = msg.message;
  } else {
    el.className = 'chat-msg';

    const icon = document.createElement('span');
    icon.className = 'chat-msg-icon';
    if (msg.playerIcon && isPremium(msg.playerIcon)) {
      icon.innerHTML = renderIcon(msg.playerIcon, 14);
    } else {
      icon.textContent = msg.playerIcon || '';
    }
    el.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'chat-msg-name';
    name.style.color = msg.playerColor || '#ccc';
    name.textContent = msg.playerName || '';
    el.appendChild(name);

    const text = document.createElement('span');
    text.className = 'chat-msg-text';
    text.textContent = msg.message;
    el.appendChild(text);

    const time = document.createElement('span');
    time.className = 'chat-msg-time';
    const d = new Date(msg.timestamp);
    time.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    el.appendChild(time);
  }

  dom.chatMessages!.appendChild(el);

  // Auto-scroll to bottom
  dom.chatMessages!.scrollTop = dom.chatMessages!.scrollHeight;

  // Update unread badge if chat is closed
  if (!isChatOpen) {
    unreadCount++;
    dom.chatBadge!.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    dom.chatBadge!.classList.remove('hidden');
  }
}

/** Enable the chat system (show toggle button, keep panel closed) */
export function showChat(): void {
  if (!dom.chatToggleBtn) return;
  dom.chatToggleBtn.classList.remove('hidden');
  updateInputState();
}

/** Fully remove chat (toggle + panel) */
export function hideChat(): void {
  if (dom.chatPanel) dom.chatPanel.classList.add('hidden');
  if (dom.chatToggleBtn) dom.chatToggleBtn.classList.add('hidden');
  isChatOpen = false;
}

export function clearChat(): void {
  if (dom.chatMessages) dom.chatMessages.innerHTML = '';
  unreadCount = 0;
  if (dom.chatBadge) {
    dom.chatBadge.classList.add('hidden');
    dom.chatBadge.textContent = '0';
  }
}

function openChat(): void {
  dom.chatPanel!.classList.remove('hidden');
  dom.chatToggleBtn!.classList.add('hidden');
  isChatOpen = true;
  unreadCount = 0;
  dom.chatBadge!.classList.add('hidden');
  dom.chatBadge!.textContent = '0';
  updateInputState();
}

function closeChat(): void {
  dom.chatPanel!.classList.add('hidden');
  dom.chatPanel!.style.bottom = '';
  dom.chatToggleBtn!.classList.remove('hidden');
  isChatOpen = false;
}

function toggleChat(): void {
  if (dom.chatPanel!.classList.contains('hidden')) {
    openChat();
  } else {
    closeChat();
  }
}

function updateInputState(): void {
  if (!clientState.isLoggedIn) {
    dom.chatInput!.disabled = true;
    dom.chatSendBtn!.disabled = true;
    dom.chatInput!.placeholder = 'Log in to chat';
    dom.chatInput!.parentElement!.classList.add('chat-disabled');
  } else {
    dom.chatInput!.disabled = false;
    dom.chatSendBtn!.disabled = false;
    dom.chatInput!.placeholder = 'Type a message...';
    dom.chatInput!.parentElement!.classList.remove('chat-disabled');
  }
}
