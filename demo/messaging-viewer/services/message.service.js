// Message Service
import { apiFetch } from './api.service.js';
import { renderMessages } from './ui.service.js';
import { loadThreadItems, loadThreads, getCounterpartId } from './thread.service.js';
import { emitTyping, emitSupportTyping } from './socket.service.js';
import { setLoading } from '../utils/dom.js';
import { loadSupportChatMessages } from './support.service.js';

export async function sendMessage(panelState, side, els) {
  if (!panelState.activeThread) {
    alert('Önce bir thread seçin');
    return;
  }
  const messageInput = side === 'left' ? els.messageInputLeft : els.messageInputRight;
  const sendBtn = side === 'left' ? els.sendMessageBtnLeft : els.sendMessageBtnRight;

  const text = messageInput.value.trim();
  if (!text) return;

  emitTyping(panelState, false);

  const counterpartId = getCounterpartId(panelState);
  if (!counterpartId) {
    alert('Karşı kullanıcı belirlenemedi.');
    return;
  }

  setLoading(sendBtn, true);
  try {
    await apiFetch('/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipientUserId: counterpartId,
        message: text,
      }),
    }, panelState);
    messageInput.value = '';
    await loadThreadItems(panelState.activeThread.id, panelState, side, els);
    await loadThreads(panelState, side, els);
  } catch (error) {
    console.error(error);
    alert(`Mesaj gönderilemedi: ${error.message}`);
  } finally {
    setLoading(sendBtn, false);
  }
}

export async function markAsRead(messageId, panelState, side, els) {
  try {
    await apiFetch(`/messages/${messageId}/read`, { method: 'POST' }, panelState);
    await Promise.all([
      loadThreadItems(panelState.activeThread.id, panelState, side, els),
      loadThreads(panelState, side, els),
    ]);
  } catch (error) {
    console.error(error);
    alert(`Okundu olarak işaretlenemedi: ${error.message}`);
  }
}

export async function sendSupportChatMessage(panelState, side, els) {
  if (!panelState.supportChat) return;
  
  // Side'a göre doğru elementleri al
  const supportChatInput = side === 'left' ? els.supportChatInputLeft : els.supportChatInputRight;
  const supportChatSend = side === 'left' ? els.supportChatSendLeft : els.supportChatSendRight;
  
  const text = supportChatInput.value.trim();
  if (!text) return;
  const threadId = panelState.supportChat.threadId;
  if (!threadId) return;

  emitSupportTyping(panelState, false);

  setLoading(supportChatSend, true);
  try {
    await apiFetch(`/messages/${threadId}/support-chat`, {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    }, panelState);
    supportChatInput.value = '';
    
    // Support chat messages'ı yeniden yükle (doğrudan support chat endpoint'inden)
    await loadSupportChatMessages(threadId, panelState, side, els, { 
      silent: false, // renderSupportChat çağrılsın
      supportRequestId: panelState.supportChat.requestId 
    });
    
    // Thread items'ı da yeniden yükle ki support request'in messages array'i güncellensin
    // (ama renderMessages çağrılmayacak çünkü support chat açık)
    await loadThreadItems(threadId, panelState, side, els);
  } catch (error) {
    console.error(error);
    alert(`Support chat mesajı gönderilemedi: ${error.message}`);
  } finally {
    setLoading(supportChatSend, false);
  }
}

