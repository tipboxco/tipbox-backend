// Socket Service
import { loadThreadItems, loadThreads } from './thread.service.js';
import { loadSupportChatMessages } from './support.service.js';
import { renderThreads, renderMessages, renderSupportChat } from './ui.service.js';

export function initSocket(panelState, side, els) {
  return new Promise((resolve) => {
    if (panelState.socket) {
      panelState.socket.disconnect();
    }

    panelState.socket = io(panelState.baseUrl, {
      auth: { token: panelState.token },
    });

    panelState.socket.on('connect', () => {
      console.log(`[${side}] Socket connected:`, panelState.socket.id);
      resolve();
      if (panelState.activeThread) {
        joinThread(panelState);
      }
    });

    panelState.socket.on('disconnect', (reason) => {
      console.log(`[${side}] Socket disconnected:`, reason);
      panelState.joinedThreads.clear();
    });

    panelState.socket.on('thread_joined', ({ threadId }) => {
      panelState.joinedThreads.add(threadId);
      console.log(`[${side}] Joined thread:`, threadId);
      // Thread'e katıldığında mesajlar otomatik okundu olarak işaretlendi
      // Mesajları yeniden yükle ki okundu durumları güncellensin
      if (panelState.activeThread?.id === threadId) {
        loadThreadItems(threadId, panelState, side, els);
      }
      if (panelState.supportChat?.threadId === threadId) {
        // Thread items'ı yeniden yükle ki güncel messages array'i gelsin
        loadThreadItems(threadId, panelState, side, els);
      }
      // Thread listesini de güncelle (unread count değişti)
      loadThreads(panelState, side, els);
    });

    panelState.socket.on('thread_left', ({ threadId }) => {
      panelState.joinedThreads.delete(threadId);
      console.log(`[${side}] Left thread:`, threadId);
      if (panelState.activeThread?.id === threadId) {
        renderMessages(panelState, side, els);
      }
      if (panelState.supportChat?.threadId === threadId) {
        renderSupportChat(panelState, side, els);
      }
    });

    panelState.socket.on('new_message', (event) => {
      const context = event.context || 'DM';
      if (context === 'SUPPORT') {
        // SUPPORT mesajı geldiğinde:
        // 1. Thread items'ı yeniden yükle ki support request'in messages array'i güncellensin
        //    (SUPPORT mesajları DM ekranında gösterilmez, sadece support request'in messages array'inde olur)
        if (panelState.activeThread?.id === event.threadId) {
          loadThreadItems(event.threadId, panelState, side, els);
        }
        // 2. Support chat açıksa, support chat messages'ı yeniden yükle
        if (panelState.supportChat?.threadId === event.threadId) {
          loadSupportChatMessages(event.threadId, panelState, side, els, {
            supportRequestId: panelState.supportChat.requestId,
          });
        }
        // 3. Thread listesini güncelle (unread count değişebilir)
        loadThreads(panelState, side, els);
        // NOT: SUPPORT mesajları DM ekranında render edilmez, sadece support chat ekranında
        return;
      }
      // DM mesajı geldiğinde normal akış
      if (panelState.activeThread?.id === event.threadId) {
        loadThreadItems(event.threadId, panelState, side, els);
      } else {
        loadThreads(panelState, side, els);
      }
    });

    panelState.socket.on('message_sent', (event) => {
      if (panelState.activeThread?.id === event.threadId) {
        loadThreadItems(event.threadId, panelState, side, els);
      }
    });

    panelState.socket.on('message_read', (event) => {
      // Mesaj okundu event'i geldiğinde thread'deki mesajları güncelle
      if (panelState.activeThread?.id === event.threadId) {
        // Aktif thread'deki mesajları güncelle
        loadThreadItems(event.threadId, panelState, side, els);
      }
      // Thread listesini de güncelle (unread count değişebilir)
      loadThreads(panelState, side, els);
    });

    panelState.socket.on('user_typing', (event) => {
      const threadId = String(event.threadId);
      const userId = String(event.userId);
      const isTyping = event.isTyping;
      
      console.log(`[${side}] user_typing event received:`, { threadId, userId, isTyping, activeThreadId: String(panelState.activeThread?.id), currentUserId: String(panelState.user?.id) });
      
      if (!panelState.typingThreads.has(threadId)) {
        panelState.typingThreads.set(threadId, new Set());
      }
      const threadTypingUsers = panelState.typingThreads.get(threadId);
      
      if (isTyping) {
        threadTypingUsers.add(userId);
      } else {
        threadTypingUsers.delete(userId);
        if (threadTypingUsers.size === 0) {
          panelState.typingThreads.delete(threadId);
        }
      }
      
      console.log(`[${side}] typingThreads after update:`, Array.from(panelState.typingThreads.entries()).map(([tid, users]) => [tid, Array.from(users)]));
      
      // Aktif thread'de typing indicator göster
      if (String(panelState.activeThread?.id) === threadId) {
        const isCounterpart = userId !== String(panelState.user?.id);
        const typingIndicator = side === 'left' ? els.typingIndicatorLeft : els.typingIndicatorRight;
        console.log(`[${side}] Active thread match, isCounterpart:`, isCounterpart, 'typingIndicator:', !!typingIndicator);
        if (isCounterpart && isTyping) {
          panelState.typingUsers.add(userId);
          if (typingIndicator) {
            typingIndicator.classList.remove('hidden');
            console.log(`[${side}] Typing indicator shown in active thread`);
          } else {
            console.warn(`[${side}] Typing indicator element not found for active thread`);
          }
        } else {
          panelState.typingUsers.delete(userId);
          if (panelState.typingUsers.size === 0) {
            if (typingIndicator) {
              typingIndicator.classList.add('hidden');
              console.log(`[${side}] Typing indicator hidden in active thread`);
            }
          }
        }
      }
      
      // Support chat'te typing indicator göster
      if (String(panelState.supportChat?.threadId) === threadId) {
        const isCounterpart = userId !== String(panelState.user?.id);
        const typingIndicator = side === 'left' ? els.supportTypingIndicatorLeft : els.supportTypingIndicatorRight;
        if (typingIndicator) {
          if (isCounterpart && isTyping) {
            typingIndicator.classList.remove('hidden');
          } else {
            typingIndicator.classList.add('hidden');
          }
        }
      }
      
      // Thread listesinde "yazıyor..." göster
      console.log(`[${side}] Rendering threads with typing state`);
      renderThreads(panelState, side, els);
    });
  });
}

export function joinThread(panelState) {
  if (!panelState.socket || !panelState.activeThread) return;
  panelState.socket.emit('join_thread', panelState.activeThread.id);
}

export function emitTyping(panelState, isTyping) {
  if (!panelState.socket || !panelState.activeThread) {
    console.log('emitTyping: socket or activeThread missing', { hasSocket: !!panelState.socket, hasActiveThread: !!panelState.activeThread });
    return;
  }
  
  const threadId = panelState.activeThread.id;
  console.log('emitTyping:', { threadId, isTyping });

  if (isTyping) {
    panelState.socket.emit('typing_start', { threadId });
    
    if (panelState.typingTimeout) {
      clearTimeout(panelState.typingTimeout);
    }
    panelState.typingTimeout = setTimeout(() => {
      emitTyping(panelState, false);
    }, 3000);
  } else {
    panelState.socket.emit('typing_stop', { threadId });
    
    if (panelState.typingTimeout) {
      clearTimeout(panelState.typingTimeout);
      panelState.typingTimeout = null;
    }
  }
}

export function emitSupportTyping(panelState, isTyping) {
  if (!panelState.socket || !panelState.supportChat?.threadId) return;
  
  const threadId = panelState.supportChat.threadId;

  if (isTyping) {
    panelState.socket.emit('typing_start', { threadId });
  } else {
    panelState.socket.emit('typing_stop', { threadId });
  }
}

