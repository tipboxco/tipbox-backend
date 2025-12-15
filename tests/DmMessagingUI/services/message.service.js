// Message Service
import { apiFetch } from './api.service.js';
import { loadThreadItems, loadThreads, getCounterpartId } from './thread.service.js';
import { emitTyping, emitSupportTyping } from './socket.service.js';
import { setLoading } from '../utils/dom.js';
import { renderSupportChat, renderMessages } from './ui.service.js';

export async function sendMessage(panelState, side, els) {
  if (!panelState.activeThread) {
    alert('Önce bir thread seçin');
    return;
  }
  if (!panelState.socket) {
    alert('Socket bağlantısı yok');
    return;
  }

  const messageInput = side === 'left' ? els.messageInputLeft : els.messageInputRight;
  const sendBtn = side === 'left' ? els.sendMessageBtnLeft : els.sendMessageBtnRight;

  const text = messageInput.value.trim();
  if (!text) return;

  // Support chat açıksa, normal mesaj gönderme yerine support chat mesajı gönderilmeli
  if (panelState.supportChat) {
    console.log(`[${side}] sendMessage called but support chat is open, redirecting to sendSupportChatMessage`);
    // Normal mesaj input'undan alınan değeri support chat input'una aktar
    const supportChatInput = side === 'left' ? els.supportChatInputLeft : els.supportChatInputRight;
    supportChatInput.value = text;
    messageInput.value = '';
    return sendSupportChatMessage(panelState, side, els);
  }

  emitTyping(panelState, false);

  const threadId = panelState.activeThread.id;
  if (!threadId) {
    alert('Thread ID bulunamadı');
    return;
  }

  // Input'u temizle
  messageInput.value = '';
  setLoading(sendBtn, true);
  
  // Socket ile mesaj gönder (optimistic mesaj yok, sadece socket üzerinden)
  panelState.socket.emit('send_message', { threadId, message: text }, (response) => {
    setLoading(sendBtn, false);
    if (response?.error) {
      // Mesaj gönderilemediyse input'a geri ekle
      messageInput.value = text;
      alert(`Mesaj gönderilemedi: ${response.error}`);
    }
    // Başarılıysa mesaj socket'ten gelecek (message_sent event'i)
  });

  // Error handler
  const errorHandler = (error) => {
    setLoading(sendBtn, false);
    // Mesaj gönderilemediyse input'a geri ekle
    messageInput.value = text;
    alert(`Mesaj gönderilemedi: ${error.reason || 'Bilinmeyen hata'}`);
  };

  panelState.socket.once('message_send_error', errorHandler);
  
  // 5 saniye sonra error handler'ı temizle (eğer hata gelmezse)
  setTimeout(() => {
    panelState.socket.off('message_send_error', errorHandler);
  }, 5000);
}

export async function markAsRead(messageId, panelState, side, els) {
  try {
    await apiFetch(`/messages/${messageId}/read`, { method: 'POST' }, panelState);
    // Socket üzerinden message_read event'i gelecek, GET isteği atmaya gerek yok
  } catch (error) {
    console.error(error);
    alert(`Okundu olarak işaretlenemedi: ${error.message}`);
  }
}

export async function sendSupportChatMessage(panelState, side, els) {
  if (!panelState.supportChat) return;
  if (!panelState.socket) {
    alert('Socket bağlantısı yok');
    return;
  }
  
  // Side'a göre doğru elementleri al
  const supportChatInput = side === 'left' ? els.supportChatInputLeft : els.supportChatInputRight;
  const supportChatSend = side === 'left' ? els.supportChatSendLeft : els.supportChatSendRight;
  
  const text = supportChatInput.value.trim();
  if (!text) return;
  const threadId = panelState.supportChat.threadId;
  if (!threadId) {
    alert('Support chat thread ID bulunamadı');
    return;
  }

  emitSupportTyping(panelState, false);

  // Input'u temizle
  supportChatInput.value = '';
  setLoading(supportChatSend, true);
  
  // Socket ile support chat mesajı gönder (optimistic mesaj yok, sadece socket üzerinden)
  panelState.socket.emit('send_support_message', { threadId, message: text }, (response) => {
    setLoading(supportChatSend, false);
    if (response?.error) {
      // Mesaj gönderilemediyse input'a geri ekle
      supportChatInput.value = text;
      alert(`Support chat mesajı gönderilemedi: ${response.error}`);
    }
    // Başarılıysa mesaj socket'ten gelecek (new_message event'i SUPPORT context ile)
  });

  // Error handler
  const errorHandler = (error) => {
    setLoading(supportChatSend, false);
    // Mesaj gönderilemediyse input'a geri ekle
    supportChatInput.value = text;
    alert(`Support chat mesajı gönderilemedi: ${error.reason || 'Bilinmeyen hata'}`);
  };

  panelState.socket.once('message_send_error', errorHandler);
  
  // 5 saniye sonra error handler'ı temizle (eğer hata gelmezse)
  setTimeout(() => {
    panelState.socket.off('message_send_error', errorHandler);
  }, 5000);
}

