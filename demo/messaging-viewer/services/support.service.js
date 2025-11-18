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

export function openSupportChat(requestId, panelState, side, els) {
  const supportItem = panelState.activeThreadItems.find(
    (item) => item.id === requestId && item.type === 'support-request'
  );
  if (!supportItem) return;
  
  // Support request'in messages array'ini kullan (zaten thread response'unda geliyor)
  const supportRequestData = supportItem.data;
  const supportMessages = supportRequestData?.messages || [];
  
  panelState.supportChat = {
    requestId,
    threadId: panelState.activeThread?.id,
    data: supportRequestData,
  };
  
  // Mesajları data.messages'dan al (API çağrısı yapmadan)
  panelState.supportChatItems = supportMessages;
  
  // Side'a göre doğru elementleri al
  const threadView = side === 'left' ? els.threadViewLeft : els.threadViewRight;
  const supportChatView = side === 'left' ? els.supportChatViewLeft : els.supportChatViewRight;
  
  // DM ekranını sola kaydır
  threadView.classList.add('slide-left');
  
  // Support chat ekranını göster ve aktif et
  supportChatView.classList.remove('hidden');
  // Kısa bir gecikme ile animasyonu tetikle
  setTimeout(() => {
    supportChatView.classList.add('active');
  }, 10);
  
  if (panelState.socket && panelState.supportChat?.threadId) {
    panelState.socket.emit('join_thread', panelState.supportChat.threadId);
  }
  
  renderSupportChat(panelState, side, els);
}

export function closeSupportChatPanel(panelState, side, els) {
  if (panelState.supportChat?.threadId && panelState.socket) {
    panelState.socket.emit('leave_thread', panelState.supportChat.threadId);
  }
  
  // Side'a göre doğru elementleri al
  const threadView = side === 'left' ? els.threadViewLeft : els.threadViewRight;
  const supportChatView = side === 'left' ? els.supportChatViewLeft : els.supportChatViewRight;
  const supportMessages = side === 'left' ? els.supportMessagesLeft : els.supportMessagesRight;
  
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
  try {
    // Support request ID varsa query parametresi olarak ekle
    const queryParams = new URLSearchParams({ limit: '500' });
    if (supportRequestId) {
      queryParams.set('supportRequestId', supportRequestId);
    }
    const result = await apiFetch(`/messages/${threadId}/support-chat?${queryParams.toString()}`, {}, panelState);
    panelState.supportChatItems = Array.isArray(result) ? result : [];
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
    const threadService = await import('./thread.service.js');
    await threadService.loadThreadItems(panelState.activeThread.id, panelState, side, els);
    await threadService.loadThreads(panelState, side, els);
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

  const button = els.tipsForm.querySelector('button');
  setLoading(button, true);
  try {
    await apiFetch('/messages/tips', {
      method: 'POST',
      body: JSON.stringify({
        senderUserId: String(panelState.user?.id),
        recipientUserId: counterpartId,
        amount: amountValue,
        message: els.tipsMessage.value || '',
        timestamp: new Date().toISOString(),
      }),
    }, panelState);
    closeTipsModalUI(els);
    const threadService = await import('./thread.service.js');
    await threadService.loadThreadItems(panelState.activeThread.id, panelState, side, els);
    await threadService.loadThreads(panelState, side, els);
  } catch (error) {
    console.error(error);
    alert(`TIPS gönderilemedi: ${error.message}`);
  } finally {
    setLoading(button, false);
  }
}

