import { clientState, dom } from './state.js';

let _sendMessage = null;

const COIN_SVG_SMALL = '<svg class="byte-coin-svg" width="8" height="8" viewBox="0 0 16 16" fill="none"><rect x="4" y="1" width="8" height="14" rx="1" fill="#ffe66d"/><rect x="3" y="2" width="1" height="12" fill="#ffe66d"/><rect x="12" y="2" width="1" height="12" fill="#ffe66d"/><rect x="6" y="3" width="4" height="2" fill="#ffd700"/><rect x="6" y="7" width="4" height="2" fill="#ffd700"/><rect x="6" y="11" width="4" height="2" fill="#ffd700"/><rect x="5" y="1" width="6" height="1" fill="#fff8c4" opacity="0.6"/></svg>';
const COIN_SVG_TOAST = '<svg class="byte-coin-svg" width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="4" y="1" width="8" height="14" rx="1" fill="#ffe66d"/><rect x="3" y="2" width="1" height="12" fill="#ffe66d"/><rect x="12" y="2" width="1" height="12" fill="#ffe66d"/><rect x="6" y="3" width="4" height="2" fill="#ffd700"/><rect x="6" y="7" width="4" height="2" fill="#ffd700"/><rect x="6" y="11" width="4" height="2" fill="#ffd700"/><rect x="5" y="1" width="6" height="1" fill="#fff8c4" opacity="0.6"/></svg>';

export function initQuestsSend(sendFn) {
  _sendMessage = sendFn;
}

export function requestQuests() {
  if (_sendMessage) _sendMessage({ type: 'get-quests' });
}

export function handleQuestsData(msg) {
  if (msg.isGuest) {
    clientState.questData = null;
    clientState.byteCoinsBalance = 0;
    showGuestView();
    return;
  }
  clientState.questData = msg;
  clientState.byteCoinsBalance = msg.balance || 0;
  renderQuestTracker();
  updateBalanceDisplay();
  startCountdownTimer();
}

export function handleQuestProgress(msg) {
  if (!msg.updates || msg.updates.length === 0) return;

  if (clientState.questData && clientState.questData.quests) {
    for (const update of msg.updates) {
      const quest = clientState.questData.quests.find(q => q.id === update.questId);
      if (quest) {
        quest.progress = update.progress;
        quest.completed = update.completed;
        if (update.completed) quest.claimed = true;
      }
      if (update.newBalance !== null && update.newBalance !== undefined) {
        clientState.byteCoinsBalance = update.newBalance;
        if (clientState.questData) clientState.questData.balance = update.newBalance;
      }
    }
  }

  renderQuestTracker();
  updateBalanceDisplay();

  for (const update of msg.updates) {
    if (update.completed) {
      showQuestCompletionToast(update);
    }
  }
}

export function handleBalanceData(msg) {
  clientState.byteCoinsBalance = msg.balance || 0;
  updateBalanceDisplay();
}

export function resetQuestState() {
  clientState.questData = null;
  clientState.byteCoinsBalance = 0;
  if (clientState.questTimerInterval) {
    clearInterval(clientState.questTimerInterval);
    clientState.questTimerInterval = null;
  }
  if (dom.questTrackerList) dom.questTrackerList.innerHTML = '';
  if (dom.questTrackerTimer) dom.questTrackerTimer.innerHTML = '<span class="qt-timer-icon">\u23F1</span> --:--';
  if (dom.qtBalance) dom.qtBalance.textContent = '0';
  if (dom.profileCoinBalance) dom.profileCoinBalance.textContent = '0';
  showGuestView();
}

function showGuestView() {
  if (dom.questTrackerList) dom.questTrackerList.innerHTML = '';
  if (dom.questTrackerLocked) dom.questTrackerLocked.classList.remove('hidden');
  if (dom.profileCoins) dom.profileCoins.classList.add('hidden');
}

function hideGuestView() {
  if (dom.questTrackerLocked) dom.questTrackerLocked.classList.add('hidden');
  if (dom.profileCoins) dom.profileCoins.classList.remove('hidden');
}

export function updateBalanceDisplay() {
  const bal = clientState.byteCoinsBalance || 0;
  const formatted = bal.toLocaleString();
  if (dom.qtBalance) dom.qtBalance.textContent = formatted;
  if (dom.profileCoinBalance) dom.profileCoinBalance.textContent = formatted;
}

function renderQuestTracker() {
  const data = clientState.questData;
  if (!data || !data.quests) {
    showGuestView();
    return;
  }
  hideGuestView();

  const list = dom.questTrackerList;
  if (!list) return;
  list.innerHTML = '';

  const dailyQuests = data.quests.filter(q => q.type === 'daily');
  const weeklyQuests = data.quests.filter(q => q.type === 'weekly');

  if (dailyQuests.length > 0) {
    const section = document.createElement('div');
    section.className = 'quest-section';
    const header = document.createElement('div');
    header.className = 'quest-section-header daily-header';
    header.textContent = 'DAILY';
    section.appendChild(header);
    for (const quest of dailyQuests) {
      section.appendChild(createQuestRow(quest));
    }
    list.appendChild(section);
  }

  if (weeklyQuests.length > 0) {
    const section = document.createElement('div');
    section.className = 'quest-section';
    const header = document.createElement('div');
    header.className = 'quest-section-header weekly-header';
    header.textContent = 'WEEKLY';
    section.appendChild(header);
    for (const quest of weeklyQuests) {
      section.appendChild(createQuestRow(quest));
    }
    list.appendChild(section);
  }
}

function createQuestRow(quest) {
  const row = document.createElement('div');
  const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));
  const almost = !quest.completed && pct >= 80;

  row.className = 'quest-row' + (quest.completed ? ' quest-done' : '') + (almost ? ' quest-almost' : '');

  // Icon
  const icon = document.createElement('span');
  icon.className = 'quest-icon';
  icon.textContent = quest.icon;

  // Info column
  const info = document.createElement('div');
  info.className = 'quest-info';

  const titleRow = document.createElement('div');
  titleRow.className = 'quest-title-row';
  const title = document.createElement('span');
  title.className = 'quest-title';
  title.textContent = quest.title;
  titleRow.appendChild(title);

  // Description
  const desc = document.createElement('div');
  desc.className = 'quest-desc';
  desc.textContent = quest.description;

  const progressWrap = document.createElement('div');
  progressWrap.className = 'quest-progress-wrap';

  const progressBar = document.createElement('div');
  progressBar.className = 'quest-progress-bar';
  const fill = document.createElement('div');
  fill.className = 'quest-progress-fill' + (quest.completed ? ' quest-progress-complete' : '');
  fill.style.width = pct + '%';
  progressBar.appendChild(fill);

  const progressText = document.createElement('span');
  progressText.className = 'quest-progress-text';
  progressText.textContent = quest.completed ? '\u2714' : quest.progress + '/' + quest.target;

  progressWrap.appendChild(progressBar);
  progressWrap.appendChild(progressText);

  info.appendChild(titleRow);
  info.appendChild(desc);
  info.appendChild(progressWrap);

  // Reward badge
  const reward = document.createElement('div');
  reward.className = 'quest-reward-badge';
  reward.innerHTML = '+' + quest.reward + ' ' + COIN_SVG_SMALL;

  row.appendChild(icon);
  row.appendChild(info);
  row.appendChild(reward);

  return row;
}

function startCountdownTimer() {
  if (clientState.questTimerInterval) {
    clearInterval(clientState.questTimerInterval);
  }

  function update() {
    const data = clientState.questData;
    if (!data || !dom.questTrackerTimer) return;

    const now = Date.now();
    const dailyEnd = data.dailyResetAt ? new Date(data.dailyResetAt).getTime() : 0;
    const nextReset = dailyEnd;

    if (nextReset <= now) {
      dom.questTrackerTimer.innerHTML = '<span class="qt-timer-icon">\u23F1</span> RESETTING\u2026';
      if (_sendMessage) {
        setTimeout(() => _sendMessage({ type: 'get-quests' }), 2000);
      }
      return;
    }

    const diff = nextReset - now;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);

    let timeStr;
    if (hours > 0) {
      timeStr = hours + 'h ' + mins + 'm';
    } else {
      timeStr = mins + 'm';
    }
    dom.questTrackerTimer.innerHTML = '<span class="qt-timer-icon">\u23F1</span> ' + timeStr;
  }

  update();
  clientState.questTimerInterval = setInterval(update, 60000);
}

function showQuestCompletionToast(update) {
  const toast = document.createElement('div');
  toast.className = 'quest-toast';
  toast.innerHTML =
    '<span class="quest-toast-icon">' + update.icon + '</span>' +
    '<span class="quest-toast-text">QUEST COMPLETE!</span>' +
    '<span class="quest-toast-reward">+' + update.reward + ' ' + COIN_SVG_TOAST + '</span>';

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('quest-toast-show');
  });

  setTimeout(() => {
    toast.classList.add('quest-toast-hide');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
}
