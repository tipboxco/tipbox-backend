// Thread Service
import { apiFetch } from './api.service.js';
import { renderThreads, renderThreadHeader, renderMessages } from './ui.service.js';
import { joinThread } from './socket.service.js';
import { formatRelative } from '../utils/formatters.js';

export async function loadThreads(panelState, side, els, { search, unreadOnly } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (unreadOnly) params.set('unreadOnly', 'true');
  const query = params.toString() ? `?${params.toString()}` : '';

  try {
    const threads = await apiFetch(`/messages${query}`, {}, panelState);
    panelState.threads = threads || [];
    panelState.filteredThreads = panelState.threads;
    renderThreads(panelState, side, els);
  } catch (error) {
    console.error(error);
    panelState.threads = [];
    panelState.filteredThreads = [];
    renderThreads(panelState, side, els);
  }
}

export async function selectThread(threadId, panelState, side, els) {
  const thread = panelState.threads.find((t) => t.id === threadId);
  if (!thread) return;

  panelState.activeThread = thread;
  const inboxView = side === 'left' ? els.inboxViewLeft : els.inboxViewRight;
  const threadViewContainer = side === 'left' ? els.threadViewContainerLeft : els.threadViewContainerRight;

  inboxView.classList.add('hidden');
  threadViewContainer.classList.remove('hidden');
  renderThreads(panelState, side, els);
  renderThreadHeader(panelState, side, els);

  await loadThreadItems(threadId, panelState, side, els);
  if (panelState.socket && panelState.socket.connected) {
    joinThread(panelState);
    setTimeout(() => {
      renderMessages(panelState, side, els);
    }, 500);
  }
}

export async function loadThreadItems(threadId, panelState, side, els) {
  try {
    const items = await apiFetch(`/messages/${threadId}`, {}, panelState);
    panelState.activeThreadItems = items || [];
    deriveCounterpart(threadId, panelState.activeThreadItems, panelState);
    
    // Eğer support chat açıksa, support request'in messages array'ini güncelle
    if (panelState.supportChat?.requestId) {
      const supportItem = panelState.activeThreadItems.find(
        (item) => item.id === panelState.supportChat.requestId && item.type === 'support-request'
      );
      if (supportItem?.data) {
        panelState.supportChat.data = supportItem.data;
        const { renderSupportChat } = await import('./ui.service.js');
        renderSupportChat(panelState, side, els);
      }
      return;
    }

    // Thread'de support request varsa ve support chat açık değilse, otomatik olarak aç
    // NOT: Bu özellik şu an devre dışı - kullanıcı manuel olarak "Open Support Chat" butonuna tıklayacak
    // Otomatik açma yerine, sadece render et
    // const supportRequestItem = panelState.activeThreadItems.find(
    //   (item) => item.type === 'support-request' && item.data?.threadId && item.data?.status === 'accepted'
    // );
    // 
    // if (supportRequestItem && !panelState.supportChat) {
    //   console.log(`[${side}] Auto-opening support chat for request:`, supportRequestItem.id);
    //   const { openSupportChat } = await import('./support.service.js');
    //   openSupportChat(supportRequestItem.id, panelState, side, els);
    //   return;
    // }

    renderMessages(panelState, side, els);
  } catch (error) {
    console.error(error);
    panelState.activeThreadItems = [];
    // Support chat açık değilse DM ekranına render et
    if (!panelState.supportChat?.requestId) {
      renderMessages(panelState, side, els);
    }
  }
}

function deriveCounterpart(threadId, items, panelState) {
  const senderIds = new Set();
  items.forEach((item) => {
    const senderId = item?.data?.sender?.id;
    if (senderId) senderIds.add(senderId);
  });

  const counterpart = [...senderIds].find((id) => id !== String(panelState.user?.id));
  if (counterpart) {
    panelState.counterpartMap.set(threadId, counterpart);
  }
}

export function getCounterpartId(panelState) {
  if (!panelState.activeThread) return null;
  return (
    panelState.counterpartMap.get(panelState.activeThread.id) ||
    panelState.activeThread?.sender?.id ||
    null
  );
}

export function handleSearch(panelState, side, els) {
  const searchInput = side === 'left' ? els.searchInputLeft : els.searchInputRight;
  const unreadOnlyInput = side === 'left' ? els.unreadOnlyInputLeft : els.unreadOnlyInputRight;

  const query = searchInput.value.trim().toLowerCase();
  const unreadOnly = unreadOnlyInput.checked;

  panelState.filteredThreads = panelState.threads.filter((thread) => {
    if (unreadOnly && !thread.isUnread) return false;
    if (!query) return true;
    return (
      thread.senderName?.toLowerCase().includes(query) ||
      thread.lastMessage?.toLowerCase().includes(query)
    );
  });

  renderThreads(panelState, side, els);
}

export function backToInbox(panelState, side, els) {
  if (panelState.activeThread && panelState.socket) {
    panelState.socket.emit('leave_thread', panelState.activeThread.id);
  }
  
  panelState.activeThread = null;
  const inboxView = side === 'left' ? els.inboxViewLeft : els.inboxViewRight;
  const threadViewContainer = side === 'left' ? els.threadViewContainerLeft : els.threadViewContainerRight;

  inboxView.classList.remove('hidden');
  threadViewContainer.classList.add('hidden');
  renderThreads(panelState, side, els);
}

