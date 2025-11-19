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

export async function openSupportChat(requestId, panelState, side, els) {
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
  
  // Thread ID hala yoksa veya status accepted değilse hata ver
  if (!threadId) {
    alert('Support chat henüz açılamaz. Request accept edilmesi gerekiyor.');
    return;
  }
  
  if (supportRequestData?.status !== 'accepted') {
    alert('Support request henüz accept edilmedi.');
    return;
  }
  
  // Önceki support chat'in mesajlarını temizle (farklı request için açılıyorsa)
  const previousThreadId = panelState.supportChat?.threadId;
  if (previousThreadId && previousThreadId !== threadId) {
    console.log(`[${side}] Different support chat opening, clearing previous messages. Previous: ${previousThreadId}, New: ${threadId}`);
    panelState.supportChatItems = [];
    if (panelState.socket) {
      panelState.socket.emit('leave_thread', previousThreadId);
    }
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
  
  // DM ekranını sola kaydır
  threadView.classList.add('slide-left');
  
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
  if (panelState.supportChat?.threadId && panelState.socket) {
    panelState.socket.emit('leave_thread', panelState.supportChat.threadId);
  }
  
  // Side'a göre doğru elementleri al
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
  
  // DM ekranını geri getir
  threadView.classList.remove('slide-left');
  
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
  try {
    await apiFetch('/messages/support-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, panelState);
    closeSupportModalUI(els);
    
    // POST isteği başarılı olduktan sonra thread items'ı yeniden yükle (GET isteği ile)
    // Bu sayede support request kalıcı olarak eklenir ve sayfadan çıkıp tekrar girince görünür
    if (panelState.activeThread?.id) {
      const { loadThreadItems } = await import('./thread.service.js');
      await loadThreadItems(panelState.activeThread.id, panelState, side, els);
    }
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
    
    // POST isteği başarılı olduktan sonra thread items'ı yeniden yükle (GET isteği ile)
    // Bu sayede tips kalıcı olarak eklenir ve sayfadan çıkıp tekrar girince görünür
    if (panelState.activeThread?.id) {
      const { loadThreadItems } = await import('./thread.service.js');
      await loadThreadItems(panelState.activeThread.id, panelState, side, els);
    }
  } catch (error) {
    console.error(error);
    alert(`TIPS gönderilemedi: ${error.message}`);
  } finally {
    setLoading(button, false);
  }
}

