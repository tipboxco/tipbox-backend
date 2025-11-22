// Socket Service
import { loadSupportChatMessages, loadSupportRequests } from './support.service.js';
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

      if (panelState.activeThread?.id === threadId) {
        markAllActiveThreadMessagesRead(panelState);
        renderMessages(panelState, side, els);
        const thread = panelState.threads.find((t) => t.id === threadId);
        if (thread) {
          thread.isUnread = false;
          thread.unreadCount = 0;
          renderThreads(panelState, side, els);
        }
      }

      if (panelState.supportChat?.threadId === threadId) {
        renderSupportChat(panelState, side, els);
      }
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
      console.log(`[${side}] new_message event received:`, event);
      handleRealtimeMessage(panelState, side, els, event);
    });

    panelState.socket.on('message_sent', (event) => {
      console.log(`[${side}] message_sent event received:`, event);
      handleRealtimeMessage(panelState, side, els, event, { isSender: true });
    });

    panelState.socket.on('message_read', (event) => {
      applyMessageReadState(panelState, side, els, event);
    });

    panelState.socket.on('support_request_accepted', async (event) => {
      console.log(`[${side}] Support request accepted event:`, event);
      const { requestId, threadId } = event;
      
      // Support request item'ını bul ve threadId'yi güncelle
      const supportItem = panelState.activeThreadItems.find(
        (item) => item.id === requestId && item.type === 'support-request'
      );
      
      if (supportItem && supportItem.data) {
        supportItem.data.status = 'accepted';
        supportItem.data.threadId = threadId;
        renderMessages(panelState, side, els);
      }
      
      // Aktif thread'deki items'ı yeniden yükle (threadId güncellemesi için)
      if (panelState.activeThread?.id) {
        const { loadThreadItems } = await import('./thread.service.js');
        await loadThreadItems(panelState.activeThread.id, panelState, side, els);
      }
      
      // Thread listesini de güncelle (support request'in durumu değişti)
      const { loadThreads } = await import('./thread.service.js');
      await loadThreads(panelState, side, els);

      await loadSupportRequests(panelState, side, els);
    });

    panelState.socket.on('support_request_rejected', async (event) => {
      console.log(`[${side}] Support request rejected event:`, event);
      const { requestId } = event;
      
      // Support request item'ını bul ve status'u güncelle
      const supportItem = panelState.activeThreadItems.find(
        (item) => item.id === requestId && item.type === 'support-request'
      );
      
      if (supportItem && supportItem.data) {
        supportItem.data.status = 'rejected';
        renderMessages(panelState, side, els);
      }
      
      // Eğer aktif thread'de değilse, thread items'ı yeniden yükle
      if (panelState.activeThread?.id) {
        const { loadThreadItems } = await import('./thread.service.js');
        await loadThreadItems(panelState.activeThread.id, panelState, side, els);
      }

      await loadSupportRequests(panelState, side, els);
    });

    panelState.socket.on('support_request_cancelled', async (event) => {
      console.log(`[${side}] Support request cancelled event:`, event);
      const { requestId } = event;

      const supportItem = panelState.activeThreadItems.find(
        (item) => item.id === requestId && item.type === 'support-request'
      );

      if (supportItem && supportItem.data) {
        supportItem.data.status = 'canceled';
        supportItem.data.threadId = null;
        renderMessages(panelState, side, els);
      }

      if (panelState.activeThread?.id) {
        const { loadThreadItems } = await import('./thread.service.js');
        await loadThreadItems(panelState.activeThread.id, panelState, side, els);
      }

      await loadSupportRequests(panelState, side, els);
    });

    panelState.socket.on('support_request_reported', (event) => {
      console.log(`[${side}] Support request reported event:`, event);
      const currentUserId = String(panelState.user?.id);
      if (event.reporterId === currentUserId) {
        alert('Raporunuz alındı. Destek ekibimiz kısa sürede inceleyecek.');
      } else {
        console.warn(`[${side}] Karşı kullanıcı support request'i raporladı:`, event.category);
      }
    });

    panelState.socket.on('support_request_closed', async (event) => {
      console.log(`[${side}] Support request closed event:`, event);
      const { requestId, status, userId, rating } = event;

      // Support chat açıksa ve bu request için ise, UI'ı güncelle
      if (panelState.supportChat?.data?.requestId === requestId) {
        panelState.supportChat.data.status = status;
        // Eğer current user close yaptıysa, isClosedByCurrentUser flag'i ekle
        if (userId === String(panelState.user?.id)) {
          panelState.supportChat.data.isClosedByCurrentUser = true;
        }
        renderSupportChat(panelState, side, els);
      }

      // Support request listesini güncelle
      await loadSupportRequests(panelState, side, els);

      // Eğer thread view açıksa, thread items'ı güncelle
      if (panelState.activeThread?.id) {
        const { loadThreadItems } = await import('./thread.service.js');
        await loadThreadItems(panelState.activeThread.id, panelState, side, els);
      }
    });

    panelState.socket.on('user_typing', (event) => {
      const threadId = event.threadId;
      const userId = event.userId;
      const isTyping = event.isTyping;
      
      console.log(`[${side}] user_typing event received:`, { threadId, userId, isTyping, activeThreadId: panelState.activeThread?.id, currentUserId: panelState.user?.id });
      
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
      if (panelState.activeThread?.id === threadId) {
        const isCounterpart = userId !== panelState.user?.id;
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
      if (panelState.supportChat?.threadId === threadId) {
        const isCounterpart = userId !== panelState.user?.id;
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
  if (!panelState.socket || !panelState.supportChat?.threadId) {
    console.log('emitSupportTyping: socket or supportChat missing', { hasSocket: !!panelState.socket, hasSupportChat: !!panelState.supportChat });
    return;
  }
  
  const threadId = panelState.supportChat.threadId;
  console.log('emitSupportTyping:', { threadId, isTyping });

  if (isTyping) {
    panelState.socket.emit('typing_start', { threadId });
    
    if (panelState.supportTypingTimeout) {
      clearTimeout(panelState.supportTypingTimeout);
    }
    panelState.supportTypingTimeout = setTimeout(() => {
      emitSupportTyping(panelState, false);
    }, 3000);
  } else {
    panelState.socket.emit('typing_stop', { threadId });
    
    if (panelState.supportTypingTimeout) {
      clearTimeout(panelState.supportTypingTimeout);
      panelState.supportTypingTimeout = null;
    }
  }
}

async function handleRealtimeMessage(panelState, side, els, event, { isSender = false } = {}) {
  const context = event.context || 'DM';
  const threadId = String(event.threadId || ''); // String'e çevir
  const activeThreadId = panelState.activeThread?.id ? String(panelState.activeThread.id) : null;
  const isActiveThread = activeThreadId === threadId;
  const currentUserId = String(panelState.user?.id);

  console.log(`[${side}] handleRealtimeMessage:`, { 
    context, 
    threadId, 
    activeThreadId, 
    isActiveThread, 
    messageType: event.messageType,
    senderId: event.senderId,
    currentUserId,
    isSender,
    eventMessageId: event.messageId,
    activeThreadItemsCount: panelState.activeThreadItems?.length || 0 
  });
  
  // Thread ID yoksa veya geçersizse işlem yapma
  if (!threadId || threadId === 'undefined' || threadId === 'null') {
    console.warn(`[${side}] Invalid threadId in event:`, event);
    return;
  }

  if (context === 'SUPPORT') {
    // Support chat mesajlarını support chat state'ine ekle
    appendSupportMessageState(panelState, event);
    
    // Eğer support chat açıksa ve bu thread için ise, render et
    if (panelState.supportChat?.threadId && String(panelState.supportChat.threadId) === threadId) {
      renderSupportChat(panelState, side, els);
    }
    
    // Support mesajları DM feed'inde görünmemeli - sadece support chat ekranında görünür
    // updateThreadPreviewState çağrısını kaldırdık - support mesajları thread preview'ını güncellememeli
    // Support request feed'i ayrı bir feed ve thread preview güncellemesine ihtiyaç yok
    return;
  }

  // Sadece normal DM mesajları için real-time state güncellemesi yap
  if (event.messageType === 'message' || (!event.messageType && context === 'DM')) {
    const messageItem = buildFeedItemFromEvent(panelState, event);
    console.log(`[${side}] DM message item built:`, { 
      hasMessageItem: !!messageItem, 
      messageId: event.messageId,
      isActiveThread,
      messageItemId: messageItem?.id,
      isSender: isSender || event.senderId === currentUserId 
    });
    
    if (messageItem) {
      // Mesaj gönderici tarafından gönderildiyse (`message_sent` event'i), 
      // aktif thread kontrolü yapmadan mesajı ekle (optimistic mesajı gerçek mesajla değiştir)
      const isOwnMessage = isSender || event.senderId === currentUserId;
      
      // Mesajı aktif thread'e ekleme mantığı:
      // 1. Eğer aktif thread'deyse (thread ID eşleşiyorsa) -> ekle (hem kendi mesajımız hem gelen mesajlar için)
      // 2. Eğer kendi mesajımızsa ve aktif thread varsa -> ekle (mesajı gönderdiğimizde aktif thread'de olmalıyız)
      // NOT: Gelen mesajlar için de aktif thread kontrolü yapılıyor (isActiveThread = true ise eklenir)
      const shouldAddToActiveThread = isActiveThread || (isOwnMessage && activeThreadId);
      
      if (shouldAddToActiveThread) {
        // Aktif thread'deyse veya kendi mesajımızsa ekle
        console.log(`[${side}] Adding message to active thread (isOwnMessage: ${isOwnMessage}, isActiveThread: ${isActiveThread}):`, messageItem.id);
      upsertActiveThreadItem(panelState, messageItem);
      renderMessages(panelState, side, els);
        
        // Aktif thread için preview güncelleme (mesaj gönderildiğinde veya alındığında)
        // Sadece thread state'te varsa güncelle
        const threadIndex = panelState.threads.findIndex((t) => String(t.id) === threadId);
        if (threadIndex !== -1) {
          updateThreadPreviewState(panelState, side, els, event, {
            isSender: isOwnMessage,
          });
        }
      } else {
        console.log(`[${side}] Message not in active thread (isOwnMessage: ${isOwnMessage}, isActiveThread: ${isActiveThread}, activeThreadId: ${activeThreadId}), updating thread preview only`);
        // Aktif thread değilse, preview güncelle
    updateThreadPreviewState(panelState, side, els, event, {
          isSender: isOwnMessage,
    });
      }
    } else {
      console.warn(`[${side}] Failed to build message item from event:`, event);
    }
    return;
  }

  const isOwnGeneric = isSender || event.senderId === currentUserId;

  if (event.messageType === 'support-request') {
    const supportItem = buildSupportRequestItemFromEvent(panelState, event);
    if (!supportItem) return;

    const shouldAdd = isActiveThread || (isOwnGeneric && activeThreadId);
    if (shouldAdd) {
      upsertActiveThreadItem(panelState, supportItem);
      renderMessages(panelState, side, els);
    }

    updateThreadPreviewState(panelState, side, els, event, {
      isSender: isOwnGeneric,
      isSupport: true,
    });
    return;
  }

  if (event.messageType === 'send-tips') {
    const tipsItem = buildTipsItemFromEvent(panelState, event);
    if (!tipsItem) return;

    const shouldAdd = isActiveThread || (isOwnGeneric && activeThreadId);
    if (shouldAdd) {
      upsertActiveThreadItem(panelState, tipsItem);
      renderMessages(panelState, side, els);
    }

    updateThreadPreviewState(panelState, side, els, event, {
      isSender: isOwnGeneric,
    });
    return;
  }
}

function buildFeedItemFromEvent(panelState, event) {
  const sender = buildSenderMeta(panelState, event.threadId, event.senderId);
  if (!sender) return null;

  return {
    id: event.messageId,
    type: 'message',
    data: {
      id: event.messageId,
      sender,
      lastMessage: event.message,
      timestamp: event.timestamp,
      isUnread: event.senderId !== String(panelState.user?.id),
    },
  };
}

function buildSupportRequestItemFromEvent(panelState, event) {
  const sender = buildSenderMeta(panelState, event.threadId, event.senderId);
  if (!sender) return null;

  return {
    id: event.messageId,
    type: 'support-request',
    data: {
      id: event.messageId,
      sender,
      type: event.type || 'GENERAL',
      message: event.message,
      amount: event.amount || 0,
      status: event.status || 'pending',
      timestamp: event.timestamp,
      threadId: null, // Thread henüz oluşturulmadı (accept edilene kadar)
    },
  };
}

function buildTipsItemFromEvent(panelState, event) {
  const sender = buildSenderMeta(panelState, event.threadId, event.senderId);
  if (!sender) return null;

  return {
    id: event.messageId,
    type: 'send-tips',
    data: {
      id: event.messageId,
      sender,
      amount: event.amount || 0,
      message: event.message,
      timestamp: event.timestamp,
    },
  };
}

function buildSenderMeta(panelState, threadId, senderId) {
  const isCurrentUser = String(panelState.user?.id) === String(senderId);
  if (isCurrentUser) {
    const user = panelState.user || {};
    const profile = user.profile || {};
    return {
      id: String(user.id),
      senderName: profile.displayName || user.email || 'You',
      senderTitle: profile.title || '',
      senderAvatar: profile.avatarUrl || '',
    };
  }

  // Thread ID'leri string olarak karşılaştır
  const threadIdStr = String(threadId);
  const thread =
    panelState.threads.find((t) => String(t.id) === threadIdStr) ||
    (panelState.activeThread?.id && String(panelState.activeThread.id) === threadIdStr ? panelState.activeThread : null);

  if (!thread) {
    // Thread bulunamazsa, minimal sender bilgisi döndür (mesajı eklemek için yeterli)
    console.warn(`[buildSenderMeta] Thread not found for threadId: ${threadIdStr}, senderId: ${senderId}, using minimal sender info`);
    return {
      id: String(senderId),
      senderName: 'User',
      senderTitle: '',
      senderAvatar: '',
    };
  }

  return {
    id: String(senderId),
    senderName: thread.senderName || 'User',
    senderTitle: thread.senderTitle || '',
    senderAvatar: thread.senderAvatar || '',
  };
}

function getTimestampFromItem(item) {
  if (!item || !item.data) return 0;
  // Tüm item tipleri için timestamp data.timestamp altında
  return new Date(item.data.timestamp || 0).getTime();
}

function upsertActiveThreadItem(panelState, newItem) {
  const currentItems = panelState.activeThreadItems || [];
  console.log(`upsertActiveThreadItem called with:`, { 
    newItemId: newItem.id, 
    newItemType: newItem.type,
    currentItemsCount: currentItems.length 
  });
  
  // Duplicate kontrolü: Aynı ID'ye sahip mesajı kaldır
  const normalized = currentItems.filter((item) => item.id !== newItem.id);
  console.log(`After duplicate filter:`, { count: normalized.length });
  
  // Gerçek mesajı ekle (optimistic mesaj yok, sadece socket'ten gelen mesajlar)
  normalized.push(newItem);
  
  // En eski önce sırala (WhatsApp tarzı - en yeni en altta)
  normalized.sort((a, b) => {
    const ta = getTimestampFromItem(a);
    const tb = getTimestampFromItem(b);
    return ta - tb;
  });
  
  console.log(`Final items count:`, normalized.length);
  panelState.activeThreadItems = normalized;
}

function updateThreadPreviewState(panelState, side, els, event, { isSender = false, isSupport = false } = {}) {
  const eventThreadId = String(event.threadId);
  const activeThreadId = panelState.activeThread?.id ? String(panelState.activeThread.id) : null;
  const isActiveThread = activeThreadId === eventThreadId;
  const currentUserId = String(panelState.user?.id);
  const isIncoming = event.senderId !== currentUserId;

  // Thread ID'leri string olarak karşılaştır
  const threadIndex = panelState.threads.findIndex((t) => String(t.id) === eventThreadId);
  
  console.log(`[${side}] updateThreadPreviewState:`, { 
    eventThreadId, 
    activeThreadId, 
    isActiveThread, 
    threadIndex, 
    isSender,
    isIncoming,
    totalThreads: panelState.threads.length 
  });

  // Support request için özel mesaj oluştur
  let previewMessage = event.message;
  if (event.messageType === 'support-request') {
    previewMessage = `🎧 Support Request: ${event.message || 'No message'}`;
  } else if (event.messageType === 'send-tips') {
    previewMessage = `🎁 TIPS: ${event.amount || 0} TIPS - ${event.message || 'No message'}`;
  }

  let thread;
  
  if (threadIndex === -1) {
    // Thread state'te yoksa, DM mesajları için thread oluşturma
    // Support mesajları için minimal thread objesi oluştur
    if (isSupport) {
      // Support request için minimal thread objesi oluştur
    const sender = buildSenderMeta(panelState, event.threadId, event.senderId);
    thread = {
      id: event.threadId,
      senderName: sender?.senderName || 'User',
      senderTitle: sender?.senderTitle || '',
      senderAvatar: sender?.senderAvatar || '',
        lastMessage: '[Support]',
      timestamp: event.timestamp,
      isUnread: isIncoming && !isActiveThread,
      unreadCount: isIncoming && !isActiveThread ? 1 : 0,
    };
    // Thread'i listenin başına ekle
    panelState.threads.unshift(thread);
      console.log(`[${side}] New support thread created in preview:`, thread);
    } else {
      // DM mesajları için thread state'te yoksa, thread'i yükle
      // Ama aktif thread ise (mesaj gönderdiğimiz thread), preview güncelleme yapma
      if (isActiveThread) {
        console.log(`[${side}] Thread not found in state but is active thread, skipping preview update`);
        return;
      }
      // Aktif thread değilse, thread listesini yeniden yükle
      console.log(`[${side}] Thread not found in state, reloading thread list:`, eventThreadId);
      import('./thread.service.js').then(({ loadThreads }) => {
        loadThreads(panelState, side, els).catch((error) => {
          console.error(`[${side}] Failed to load threads:`, error);
        });
      });
      // Thread yüklenene kadar preview güncelleme yapma
      return;
    }
  } else {
    thread = panelState.threads[threadIndex];
    thread.lastMessage = previewMessage;
    thread.timestamp = event.timestamp;
    thread.isUnread = isIncoming && !isActiveThread;
    thread.unreadCount = thread.isUnread ? (thread.unreadCount || 0) + 1 : 0;

    // Thread'i listenin başına taşı
    panelState.threads.splice(threadIndex, 1);
    panelState.threads.unshift(thread);
    console.log(`[${side}] Thread preview updated:`, { id: thread.id, lastMessage: thread.lastMessage });
  }

  panelState.filteredThreads = panelState.threads;
  renderThreads(panelState, side, els);
  console.log(`[${side}] Threads rendered, total threads:`, panelState.threads.length);
}

function appendSupportMessageState(panelState, event) {
  // TIPS mesajlarını support chat'e ekleme - sadece SUPPORT context'li mesajlar
  const messageText = event.message || '';
  const messageType = event.messageType;
  const isTipsMessage = messageType === 'send-tips' || messageType === 'TIPS' ||
    (messageText.includes('Sent') && messageText.includes('TIPS'));
  
  if (isTipsMessage) {
    console.log(`[Support Chat] Ignoring TIPS message in support chat:`, event.messageId);
    return; // TIPS mesajlarını support chat'e ekleme
  }

  const newMessage = {
    id: event.messageId,
    senderId: event.senderId,
    message: event.message,
    timestamp: event.timestamp,
  };

  // Duplicate kontrolü: Eğer mesaj zaten varsa ekleme
  const existingItems = panelState.supportChatItems || [];
  const messageExists = existingItems.some((item) => item.id === event.messageId);
  
  if (!messageExists) {
    // Gerçek mesajı ekle (optimistic mesaj yok, sadece socket'ten gelen mesajlar)
    panelState.supportChatItems = [...existingItems, newMessage].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    // Aktif thread içerisindeki support request kartını da güncelle
    if (panelState.activeThreadItems?.length) {
      const supportItem = panelState.activeThreadItems.find(
        (item) => item.type === 'support-request' && item.id === panelState.supportChat?.requestId,
      );
      if (supportItem) {
        supportItem.data = supportItem.data || {};
        supportItem.data.messages = supportItem.data.messages || [];
        // DM thread'deki messages array'inde de duplicate kontrolü yap
        const dmMessageExists = supportItem.data.messages.some((msg) => msg.id === event.messageId);
        if (!dmMessageExists) {
          supportItem.data.messages.push(newMessage);
        }
      }
    }
  }
}

function applyMessageReadState(panelState, side, els, event) {
  const isActiveThread = panelState.activeThread?.id === event.threadId;
  if (isActiveThread) {
    panelState.activeThreadItems = panelState.activeThreadItems.map((item) => {
      if (item.type !== 'message') return item;
      if (item.id === event.messageId) {
        return {
          ...item,
          data: {
            ...item.data,
            isUnread: false,
          },
        };
      }
      return item;
    });

    renderMessages(panelState, side, els);
  }

  const thread = panelState.threads.find((t) => t.id === event.threadId);
  if (thread) {
    thread.isUnread = false;
    thread.unreadCount = 0;
    renderThreads(panelState, side, els);
  }
  // Thread state'te yoksa, socket event'leri zaten thread'i ekleyecek, GET isteği atmaya gerek yok
}

function markAllActiveThreadMessagesRead(panelState) {
  panelState.activeThreadItems = panelState.activeThreadItems.map((item) => {
    if (item.type !== 'message') return item;
    return {
      ...item,
      data: {
        ...item.data,
        isUnread: false,
      },
    };
  });
}

