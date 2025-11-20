// Support Service
import { apiFetch } from './api.service.js';
import { renderSupportChat } from './ui.service.js';
import { setLoading } from '../utils/dom.js';
import { formatTime, escapeHtml } from '../utils/formatters.js';

function getCounterpartId(panelState) {
  if (!panelState.activeThread) return null;
  return (
    panelState.counterpartMap.get(panelState.activeThread.id) ||
    panelState.activeThread?.sender?.id ||
    null
  );
}

export async function openSupportChat(requestId, panelState, side, els, { threadId: directThreadId, supportRequestData: directRequestData } = {}) {
  // Eğer direkt threadId ve requestData verilmişse (support request listesinden açılıyorsa)
  // DM thread ve items yüklemeye gerek yok
  if (directThreadId && directRequestData) {
    console.log(`[${side}] Opening support chat directly from support request list:`, {
      requestId,
      threadId: directThreadId,
      status: directRequestData.status
    });
    
    // Pending veya declined durumlarında threadId olmamalı, bu durumda açma
    const status = directRequestData.status || 'pending';
    if (status === 'pending' || status === 'declined') {
      alert('Support chat henüz açılamaz. Request accept edilmesi gerekiyor.');
      return;
    }
    
    // Direkt support chat'i aç
    await openSupportChatDirectly(requestId, directThreadId, directRequestData, panelState, side, els);
    return;
  }
  
  // DM thread içinden açılıyorsa (eski mantık)
  const supportItem = panelState.activeThreadItems.find(
    (item) => item.id === requestId && item.type === 'support-request'
  );
  if (!supportItem || !panelState.activeThread?.id) {
    alert('Support request bulunamadı veya thread açık değil.');
    return;
  }
  
  let supportRequestData = supportItem.data;
  let threadId = supportRequestData?.threadId;
  
  // Thread ID yoksa ama status accepted ise, thread items'ı yeniden yükle
  if (!threadId && supportRequestData?.status === 'accepted') {
    console.log(`[${side}] ThreadId yok ama status accepted, thread items yeniden yükleniyor...`);
    const { loadThreadItems } = await import('./thread.service.js');
    await loadThreadItems(panelState.activeThread.id, panelState, side, els);
    
    // Yeniden support item'ı bul
    const updatedSupportItem = panelState.activeThreadItems.find(
      (item) => item.id === requestId && item.type === 'support-request'
    );
    if (updatedSupportItem?.data) {
      supportRequestData = updatedSupportItem.data;
      threadId = supportRequestData.threadId;
    }
  }
  
  // Thread ID hala yoksa hata ver
  if (!threadId) {
    alert('Support chat henüz açılamaz. Request accept edilmesi gerekiyor.');
    return;
  }
  
  // Pending veya declined durumlarında threadId olmamalı, bu durumda açma
  const status = supportRequestData?.status || 'pending';
  if (status === 'pending' || status === 'declined') {
    alert('Support chat henüz açılamaz. Request accept edilmesi gerekiyor.');
    return;
  }
  
  // ThreadId varsa ve pending/declined değilse açılabilir
  // (active, accepted, completed, awaiting_completion, finalized durumlarında)
  
  await openSupportChatDirectly(requestId, threadId, supportRequestData, panelState, side, els);
}

async function openSupportChatDirectly(requestId, threadId, supportRequestData, panelState, side, els) {
  
  // Önceki support chat'in mesajlarını temizle (farklı request için açılıyorsa)
  const previousThreadId = panelState.supportChat?.threadId;
  if (previousThreadId && previousThreadId !== threadId) {
    console.log(`[${side}] Different support chat opening, clearing previous messages. Previous: ${previousThreadId}, New: ${threadId}`);
    panelState.supportChatItems = [];
    if (panelState.socket) {
      panelState.socket.emit('leave_thread', previousThreadId);
    }
  }
  
  // Eğer DM thread açık değilse, önce inbox'u gizle ve thread view'i göster
  const inboxView = side === 'left' ? els.inboxViewLeft : els.inboxViewRight;
  const threadViewContainer = side === 'left' ? els.threadViewContainerLeft : els.threadViewContainerRight;
  
  if (!panelState.activeThread) {
    // Inbox'u gizle ve thread view container'ı göster (support chat için)
    inboxView.classList.add('hidden');
    threadViewContainer.classList.remove('hidden');
    
    // Active thread yoksa, support request'ten gelen bilgilerle bir dummy thread oluştur
    // (sadece support chat için gerekli)
    // Support request listesinden geldiğinde fromUserId/toUserId olmayabilir
    panelState.activeThread = {
      id: threadId, // Support thread ID'sini kullan
      senderName: supportRequestData.userName || 'Support',
      senderTitle: supportRequestData.userTitle || '',
      sender: {
        id: supportRequestData.fromUserId || supportRequestData.toUserId || threadId, // Fallback olarak threadId kullan
      },
    };
  }
  
  panelState.supportChat = {
    requestId,
    threadId: threadId,
    parentThreadId: panelState.activeThread?.id,
    data: supportRequestData,
  };
  
  // Support chat items'ı temizle - API'den yeniden yüklenecek
  panelState.supportChatItems = [];
  
  // Side'a göre doğru elementleri al
  const threadView = side === 'left' ? els.threadViewLeft : els.threadViewRight;
  const supportChatView = side === 'left' ? els.supportChatViewLeft : els.supportChatViewRight;
  const requestSupportBtn = side === 'left' ? els.requestSupportBtnLeft : els.requestSupportBtnRight;
  const sendTipsBtn = side === 'left' ? els.sendTipsBtnLeft : els.sendTipsBtnRight;
  const messageInput = side === 'left' ? els.messageInputLeft : els.messageInputRight;
  const sendMessageBtn = side === 'left' ? els.sendMessageBtnLeft : els.sendMessageBtnRight;
  
  // DM ekranındaki butonları ve input'u gizle (Support Chat'te bu elementler olmamalı)
  requestSupportBtn.classList.add('hidden');
  sendTipsBtn.classList.add('hidden');
  messageInput.classList.add('hidden');
  sendMessageBtn.classList.add('hidden');
  
  // DM ekranını sola kaydır (eğer açıksa)
  if (panelState.activeThread?.id && panelState.activeThread.id !== threadId) {
    threadView.classList.add('slide-left');
  } else {
    // Direkt support chat açılıyorsa, thread view'i gizle
    threadView.classList.add('hidden');
  }
  
  // Support chat ekranını göster ve aktif et
  supportChatView.classList.remove('hidden');
  // Kısa bir gecikme ile animasyonu tetikle
  setTimeout(() => {
    supportChatView.classList.add('active');
  }, 10);
  
  renderSupportChat(panelState, side, els);
  
  if (panelState.supportChat?.threadId) {
    loadSupportChatMessages(
      panelState.supportChat.threadId,
      panelState,
      side,
      els,
      {
        silent: false,
        supportRequestId: requestId,
      },
    );
  }
}

export function closeSupportChatPanel(panelState, side, els) {
  // Support chat bilgilerini sakla (null yapmadan önce)
  const supportChatThreadId = panelState.supportChat?.threadId;
  const parentThreadId = panelState.supportChat?.parentThreadId;
  const activeThreadId = panelState.activeThread?.id;
  
  if (supportChatThreadId && panelState.socket) {
    panelState.socket.emit('leave_thread', supportChatThreadId);
  }
  
  // Side'a göre doğru elementleri al
  const inboxView = side === 'left' ? els.inboxViewLeft : els.inboxViewRight;
  const threadViewContainer = side === 'left' ? els.threadViewContainerLeft : els.threadViewContainerRight;
  const threadView = side === 'left' ? els.threadViewLeft : els.threadViewRight;
  const supportChatView = side === 'left' ? els.supportChatViewLeft : els.supportChatViewRight;
  const supportMessages = side === 'left' ? els.supportMessagesLeft : els.supportMessagesRight;
  const requestSupportBtn = side === 'left' ? els.requestSupportBtnLeft : els.requestSupportBtnRight;
  const sendTipsBtn = side === 'left' ? els.sendTipsBtnLeft : els.sendTipsBtnRight;
  const messageInput = side === 'left' ? els.messageInputLeft : els.messageInputRight;
  const sendMessageBtn = side === 'left' ? els.sendMessageBtnLeft : els.sendMessageBtnRight;
  
  // DM ekranındaki butonları ve input'u tekrar göster
  requestSupportBtn.classList.remove('hidden');
  sendTipsBtn.classList.remove('hidden');
  messageInput.classList.remove('hidden');
  sendMessageBtn.classList.remove('hidden');
  
  // Support chat ekranını kapat
  supportChatView.classList.remove('active');
  
  // DM ekranını geri getir (eğer gizlenmişse)
  threadView.classList.remove('hidden');
  threadView.classList.remove('slide-left');
  
  // Eğer support chat direkt listesinden açıldıysa (activeThread dummy ise), inbox'a dön
  // Support chat'te parentThreadId yoksa veya activeThread.id support thread ID'sine eşitse, 
  // bu durumda support request listesinden direkt açıldı demektir
  const isFromList = !parentThreadId || 
                     (activeThreadId === supportChatThreadId && 
                      !panelState.threads.find(t => t.id === activeThreadId));
  
  if (isFromList) {
    // Support request listesinden açıldıysa, inbox'a dön
    console.log(`[${side}] Support chat was opened from list, returning to inbox`);
    inboxView.classList.remove('hidden');
    threadViewContainer.classList.add('hidden');
    panelState.activeThread = null;
  }
  
  // Animasyon bitince support chat view'i gizle
  setTimeout(() => {
    supportChatView.classList.add('hidden');
    supportMessages.innerHTML = '';
  }, 300);
  
  panelState.supportChat = null;
  panelState.supportChatItems = [];
}

export async function loadSupportChatMessages(threadId, panelState, side, els, { silent, supportRequestId } = {}) {
  if (!threadId) {
    if (!silent) {
      alert('Support chat thread ID bulunamadı.');
    }
    return;
  }
  try {
    // Artık GET /messages/:threadId endpoint'i hem DM hem Support Chat için kullanılıyor
    // Thread'in is_support_thread değerine göre otomatik olarak doğru veri döndürülüyor
    const queryParams = new URLSearchParams({ limit: '500' });
    // supportRequestId artık kullanılmıyor - threadId zaten doğru support thread'i belirtiyor
    
    console.log(`[${side}] loadSupportChatMessages called with threadId: ${threadId}`);
    
    // GET /messages/:threadId endpoint'ini kullan (thread tipine göre otomatik filtreleme yapılır)
    const result = await apiFetch(
      `/messages/${threadId}?${queryParams.toString()}`,
      {},
      panelState,
    );

    // Backend direkt MessageFeedItem[] döndürüyor (support thread için sadece message item'ları)
    const messages = Array.isArray(result) ? result : [];
    
    // Thread ID'yi güncelle (eğer gerekirse)
    if (panelState.supportChat && threadId) {
      panelState.supportChat.threadId = threadId;
    }

    // Backend support thread için sadece type: "message" item'ları döndürüyor (TIPS ve support-request yok)
    // MessageFeedItem formatı: { id, type, data: { id, sender, lastMessage, timestamp, isUnread } }
    const normalizedItems = messages
      .filter((item) => {
        // Sadece type: "message" item'larını al (backend zaten filtrelemiş ama ekstra kontrol)
        if (item.type !== 'message') {
          console.log(`[${side}] Filtering out non-message item from support chat:`, item.type, item.id);
          return false;
        }
        // TIPS mesajlarını filtrele (ekstra güvenlik)
        const messageText = item.data?.lastMessage ?? item.data?.message ?? '';
        const messageType = item.data?.messageType || item.type;
        const isTipsMessage = messageType === 'send-tips' || messageType === 'TIPS' ||
          (messageText.includes('Sent') && messageText.includes('TIPS'));
        
        if (isTipsMessage) {
          console.log(`[${side}] Filtering out TIPS message from support chat:`, item.id);
          return false;
        }
        return true;
      })
      .map((item) => {
        // MessageFeedItem formatından SupportChatMessage formatına dönüştür
        const data = item.data || {};
        const senderInfo = data.sender || {};
        return {
          id: data.id || item.id,
          senderId: senderInfo.id || '',
          senderName: senderInfo.senderName || '',
          senderTitle: senderInfo.senderTitle || '',
          message: data.lastMessage || data.message || '',
          timestamp: data.timestamp || item.timestamp,
        };
      });

    // Thread ID kontrolü: Eğer thread ID değiştiyse (farklı support chat açıldıysa), mesajları temizle
    const currentThreadId = panelState.supportChat?.threadId;
    if (currentThreadId && threadId && currentThreadId !== threadId) {
      console.log(`[${side}] Thread ID changed, clearing messages. Old: ${currentThreadId}, New: ${threadId}`);
      panelState.supportChatItems = [];
      // Thread ID'yi güncelle
      if (panelState.supportChat) {
        panelState.supportChat.threadId = threadId;
      }
    }

    // Mevcut mesajları koru ve duplicate kontrolü yap
    const existingItems = panelState.supportChatItems || [];
    // Temp mesajları (optimistic) hariç tut
    const realExistingItems = existingItems.filter((item) => !item.id.startsWith('temp-'));
    const existingIds = new Set(realExistingItems.map((item) => item.id));
    
    // API'den gelen yeni mesajları ekle (duplicate olmayanlar)
    const newItems = normalizedItems.filter((item) => !existingIds.has(item.id));
    
    // Tüm mesajları birleştir ve sırala (temp mesajlar kaldırıldı, gerçek mesajlar eklendi)
    if (normalizedItems.length > 0) {
      // Eğer API'den mesaj geldiyse, temp mesajları koru ve gerçek mesajları ekle
      panelState.supportChatItems = [...realExistingItems, ...newItems].sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
    } else if (normalizedItems.length === 0 && realExistingItems.length === 0) {
      // Eğer API'den mesaj gelmediyse ve mevcut mesaj yoksa, boş array bırak
      panelState.supportChatItems = [];
    }
    if (panelState.socket && panelState.supportChat?.threadId) {
      panelState.socket.emit('join_thread', panelState.supportChat.threadId);
    }
    if (!silent) {
      renderSupportChat(panelState, side, els);
    }
  } catch (error) {
    console.error(error);
    if (!silent) {
      const errorMessage = error.message || 'Support chat yüklenemedi';
      if (errorMessage.includes('getSupportChatMessages is not a function')) {
        alert('Backend güncelleniyor, lütfen bekleyin...');
      } else {
        alert(`Support chat yüklenemedi: ${errorMessage}`);
      }
    }
  }
}

export function openSupportModal(panelState, side) {
  if (!panelState.activeThread) {
    alert('Önce bir thread seçin');
    return;
  }
  return { panelState, side };
}

export function closeSupportModalUI(els) {
  els.supportModal.classList.add('hidden');
  els.supportForm.reset();
}

export async function submitSupportRequest(event, activePanel, els) {
  event.preventDefault();
  if (!activePanel) return;
  const { panelState, side } = activePanel;
  const counterpartId = getCounterpartId(panelState);
  if (!counterpartId) {
    alert('Karşı kullanıcı belirlenemedi.');
    return;
  }
  const payload = {
    senderUserId: String(panelState.user?.id),
    recipientUserId: counterpartId,
    type: els.supportType.value,
    message: els.supportMessage.value.trim(),
    amount: String(Number(els.supportAmount.value || 0)),
    status: 'pending',
    timestamp: new Date().toISOString(),
  };
  if (!payload.message) {
    alert('Lütfen mesaj girin');
    return;
  }
  const button = els.supportForm.querySelector('button');
  setLoading(button, true);
  const socketPayload = {
    threadId: panelState.activeThread?.id || null,
    recipientUserId: counterpartId,
    type: payload.type,
    message: payload.message,
    amount: Number(els.supportAmount.value || 0),
  };

  if (panelState.socket) {
    const errorHandler = (error) => {
      setLoading(button, false);
      alert(`Destek talebi oluşturulamadı: ${error.reason || 'Bilinmeyen hata'}`);
    };

    panelState.socket.once('support_request_error', errorHandler);
    panelState.socket.emit('create_support_request', socketPayload, (response) => {
      panelState.socket.off('support_request_error', errorHandler);
      setLoading(button, false);
      if (response?.error) {
        alert(`Destek talebi oluşturulamadı: ${response.error}`);
        return;
      }
      closeSupportModalUI(els);
    });

    setTimeout(() => {
      panelState.socket?.off('support_request_error', errorHandler);
    }, 5000);
    return;
  }

  try {
    await apiFetch('/messages/support-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, panelState);
    closeSupportModalUI(els);
  } catch (error) {
    console.error(error);
    alert(`Destek talebi oluşturulamadı: ${error.message}`);
  } finally {
    setLoading(button, false);
  }
}

export function openTipsModal(panelState, side) {
  if (!panelState.activeThread) {
    alert('Önce bir thread seçin');
    return;
  }
  return { panelState, side };
}

export function closeTipsModalUI(els) {
  els.tipsModal.classList.add('hidden');
  els.tipsForm.reset();
}

export async function acceptSupportRequest(requestId, panelState, side, els) {
  try {
    const result = await apiFetch(
      `/messages/support-requests/${requestId}/accept`,
      { method: 'POST' },
      panelState
    );
    
    // Socket event'i gelecek, thread ID'yi güncelle
    console.log(`[${side}] Support request accepted:`, result);
    
    // Thread items'ı yeniden yükle
    if (panelState.activeThread?.id) {
      const { loadThreadItems } = await import('./thread.service.js');
      await loadThreadItems(panelState.activeThread.id, panelState, side, els);
    }
  } catch (error) {
    console.error(error);
    alert(`Support request accept edilemedi: ${error.message}`);
  }
}

export async function rejectSupportRequest(requestId, panelState, side, els) {
  if (!confirm('Support request\'i reddetmek istediğinize emin misiniz?')) {
    return;
  }
  
  try {
    await apiFetch(
      `/messages/support-requests/${requestId}/reject`,
      { method: 'POST' },
      panelState
    );
    
    // Socket event'i gelecek, thread items'ı güncelle
    console.log(`[${side}] Support request rejected`);
    
    // Thread items'ı yeniden yükle
    if (panelState.activeThread?.id) {
      const { loadThreadItems } = await import('./thread.service.js');
      await loadThreadItems(panelState.activeThread.id, panelState, side, els);
    }
  } catch (error) {
    console.error(error);
    alert(`Support request reject edilemedi: ${error.message}`);
  }
}

export async function submitTips(event, activePanel, els) {
  event.preventDefault();
  if (!activePanel) return;
  const { panelState, side } = activePanel;
  const counterpartId = getCounterpartId(panelState);
  if (!counterpartId) {
    alert('Karşı kullanıcı belirlenemedi.');
    return;
  }
  const amountValue = Number(els.tipsAmount.value || 0);
  if (!amountValue || amountValue <= 0) {
    alert('Geçerli bir TIPS miktarı girin');
    return;
  }

  const tipsMessage = els.tipsMessage.value?.trim() || '';
  if (!tipsMessage) {
    alert('Lütfen bir mesaj girin');
    return;
  }

  const button = els.tipsForm.querySelector('button');
  setLoading(button, true);
  const socketPayload = {
    threadId: panelState.activeThread?.id || null,
    recipientUserId: counterpartId,
    amount: amountValue,
    message: tipsMessage,
  };

  if (panelState.socket) {
    const errorHandler = (error) => {
      setLoading(button, false);
      alert(`TIPS gönderilemedi: ${error.reason || 'Bilinmeyen hata'}`);
    };

    panelState.socket.once('tips_send_error', errorHandler);
    panelState.socket.emit('send_tips', socketPayload, (response) => {
      panelState.socket.off('tips_send_error', errorHandler);
      setLoading(button, false);
      if (response?.error) {
        alert(`TIPS gönderilemedi: ${response.error}`);
        return;
      }
      closeTipsModalUI(els);
    });

    setTimeout(() => {
      panelState.socket?.off('tips_send_error', errorHandler);
    }, 5000);
    return;
  }

  try {
    await apiFetch('/messages/tips', {
      method: 'POST',
      body: JSON.stringify({
        senderUserId: String(panelState.user?.id),
        recipientUserId: counterpartId,
        amount: amountValue,
        message: tipsMessage,
        timestamp: new Date().toISOString(),
      }),
    }, panelState);
    closeTipsModalUI(els);
  } catch (error) {
    console.error(error);
    alert(`TIPS gönderilemedi: ${error.message}`);
  } finally {
    setLoading(button, false);
  }
}

// Load support requests list
export async function loadSupportRequests(panelState, side, els, { status, search } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const query = params.toString() ? `?${params.toString()}` : '';

  try {
    const requests = await apiFetch(`/messages/support-requests${query}`, {}, panelState);
    panelState.supportRequests = requests || [];
    panelState.filteredSupportRequests = panelState.supportRequests;
    renderSupportRequests(panelState, side, els);
  } catch (error) {
    console.error(error);
    panelState.supportRequests = [];
    panelState.filteredSupportRequests = [];
    renderSupportRequests(panelState, side, els);
  }
}

// Handle support request search and filter
export function handleSupportRequestSearch(panelState, side, els) {
  const searchInput = side === 'left' ? els.searchSupportRequestsInputLeft : els.searchSupportRequestsInputRight;
  const filterButtons = side === 'left' ? els.filterButtonsLeft : els.filterButtonsRight;
  
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  // Get active filter button
  let statusValue = '';
  if (filterButtons) {
    const activeButton = filterButtons.querySelector('.filter-btn.active');
    if (activeButton) {
      statusValue = activeButton.dataset.status || '';
    }
  }
  
  let filtered = [...panelState.supportRequests];
  
  // Filter by status
  if (statusValue) {
    filtered = filtered.filter(req => {
      if (statusValue === 'pending') return req.status === 'pending';
      if (statusValue === 'active') return req.status === 'active' || req.status === 'accepted';
      if (statusValue === 'completed') return req.status === 'completed' || req.status === 'awaiting_completion';
      if (statusValue === 'finalized') return req.status === 'finalized';
      if (statusValue === 'declined') return req.status === 'declined';
      return true;
    });
  }
  
  // Filter by search term
  if (searchTerm) {
    filtered = filtered.filter(req => {
      const userName = (req.userName || '').toLowerCase();
      const userTitle = (req.userTitle || '').toLowerCase();
      const description = (req.requestDescription || '').toLowerCase();
      return userName.includes(searchTerm) || userTitle.includes(searchTerm) || description.includes(searchTerm);
    });
  }
  
  panelState.filteredSupportRequests = filtered;
  renderSupportRequests(panelState, side, els);
}

// Render support requests list
export function renderSupportRequests(panelState, side, els) {
  const supportRequestsList = side === 'left' ? els.supportRequestsListLeft : els.supportRequestsListRight;

  if (!panelState.filteredSupportRequests.length) {
    supportRequestsList.innerHTML = '<div class="empty-state">Support request yok</div>';
    return;
  }

  const html = panelState.filteredSupportRequests
    .map((request) => {
      const status = request.status || 'pending';
      const hasThreadId = !!request.threadId && request.threadId !== null && request.threadId !== 'null';
      
      // Pending ve declined durumlarında threadId olmamalı (henüz accept edilmemiş)
      // Sadece active, accepted, completed, finalized durumlarında threadId varsa butonu göster
      const canShowChatButton = hasThreadId && 
                                status !== 'pending' && 
                                status !== 'declined';
      
      // Debug: Eğer pending durumunda threadId varsa log'a yaz (backend hatası olabilir)
      if (status === 'pending' && hasThreadId) {
        console.warn('[Support Request] Warning: Pending request has threadId:', {
          requestId: request.id,
          status,
          threadId: request.threadId,
          userName: request.userName
        });
      }
      
      // ThreadId varsa VE pending/declined değilse tıklanabilir
      const isClickable = canShowChatButton;
      
      // Status class ve text
      const statusClass = status === 'active' ? 'active' : 
                         status === 'accepted' ? 'active' :
                         status === 'pending' ? 'pending' : 
                         status === 'completed' ? 'completed' : 
                         status === 'awaiting_completion' ? 'completed' :
                         status === 'declined' ? 'declined' : 
                         status === 'finalized' ? 'finalized' :
                         'pending';
      
      const statusText = status === 'active' ? 'Active' : 
                        status === 'accepted' ? 'Active' :
                        status === 'pending' ? 'Pending' : 
                        status === 'completed' ? 'Awaiting Completion' : 
                        status === 'awaiting_completion' ? 'Awaiting Completion' :
                        status === 'declined' ? 'Declined' :
                        status === 'finalized' ? 'Finalized' :
                        status || 'Unknown';
      
      // Avatar için ilk harfleri al
      const avatarText = (request.userName || '?').slice(0, 2).toUpperCase();
      
      // Kullanıcı adı ve başlık
      const userName = escapeHtml(request.userName || 'Unknown');
      const userTitle = escapeHtml((request.userTitle || '').substring(0, 30)) + (request.userTitle && request.userTitle.length > 30 ? '...' : '');
      
      // Açıklama metni
      const description = escapeHtml(request.requestDescription || '—');
      const truncatedDescription = description.length > 100 ? description.substring(0, 100) + '...' : description;
      
      // Clickable class ekle - threadId yoksa veya pending/declined ise tıklanamaz
      const clickableClass = isClickable ? '' : 'not-clickable';
      
      return `
        <div class="support-request-card ${statusClass} ${clickableClass}" data-request-id="${request.id}">
          <div class="support-request-avatar ${statusClass}">${avatarText}</div>
          <div class="support-request-content">
            <div class="support-request-header">
              <div class="support-request-user-info">
                <span class="support-request-name">${userName}</span>
                <span class="support-request-title">${userTitle || 'Technology Enthusiast'}</span>
              </div>
              ${canShowChatButton ? `<button class="support-chat-btn" data-support-chat="${request.threadId}" data-request-id="${request.id}">Sohbete Git</button>` : ''}
            </div>
            <div class="support-request-body">
              <div class="support-request-status">
                <span class="status-dot ${statusClass}"></span>
                <span class="status-text">${statusText}</span>
              </div>
              <p class="support-request-description">${truncatedDescription}</p>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  supportRequestsList.innerHTML = html;

  // Add click handlers for support chat buttons (only for clickable requests)
  supportRequestsList.querySelectorAll('[data-support-chat]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent card click
      const threadId = btn.dataset.supportChat;
      const requestId = btn.dataset.requestId;
      
      if (!threadId || !requestId) {
        console.error('[Support Request] Missing threadId or requestId:', { threadId, requestId });
        return;
      }
      
      // Support request listesinden direkt açılıyor
      // Request'i bul ve direkt support chat'i aç
      const supportRequest = panelState.filteredSupportRequests.find(req => req.id === requestId);
      if (!supportRequest) {
        console.error('[Support Request] Request not found in list:', requestId);
        alert('Support request bulunamadı.');
        return;
      }
      
      // Direkt support chat'i aç (DM thread'e gerek yok)
      await openSupportChat(requestId, panelState, side, els, {
        threadId: threadId,
        supportRequestData: {
          userName: supportRequest.userName,
          userTitle: supportRequest.userTitle,
          requestDescription: supportRequest.requestDescription,
          status: supportRequest.status,
          threadId: threadId,
          type: supportRequest.type || 'GENERAL',
          amount: supportRequest.amount || 0,
        },
      });
    });
  });
  
  // Make non-clickable cards visually disabled
  supportRequestsList.querySelectorAll('.support-request-card.not-clickable').forEach((card) => {
    card.style.cursor = 'not-allowed';
    card.style.opacity = '0.7';
  });
}

