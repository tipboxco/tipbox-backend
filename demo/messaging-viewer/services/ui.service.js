// UI Service
import { formatRelative, formatTime, escapeHtml } from '../utils/formatters.js';

export function showAppShell(panelState, side, els) {
  const authPanel = side === 'left' ? els.authPanelLeft : els.authPanelRight;
  const appShell = side === 'left' ? els.appShellLeft : els.appShellRight;
  const userBadge = side === 'left' ? els.userBadgeLeft : els.userBadgeRight;

  authPanel.classList.add('hidden');
  appShell.classList.remove('hidden');
  userBadge.textContent = panelState.user?.fullName || panelState.user?.email || 'Anonim';
}

export function showAuthPanel(side, els) {
  const authPanel = side === 'left' ? els.authPanelLeft : els.authPanelRight;
  const appShell = side === 'left' ? els.appShellLeft : els.appShellRight;
  authPanel.classList.remove('hidden');
  appShell.classList.add('hidden');
}

export function renderThreads(panelState, side, els) {
  const threadList = side === 'left' ? els.threadListLeft : els.threadListRight;

  console.log(`[${side}] renderThreads called, filteredThreads count:`, panelState.filteredThreads.length);
  console.log(`[${side}] Thread IDs:`, panelState.filteredThreads.map(t => t.id));

  if (!panelState.filteredThreads.length) {
    threadList.innerHTML = '<div class="empty-state">Mesaj yok</div>';
    return;
  }

  const html = panelState.filteredThreads
    .map((thread) => {
      const isActive = panelState.activeThread?.id === thread.id;
      const avatarText = (thread.senderName || '?').slice(0, 2).toUpperCase();
      
      // Thread ID'yi string'e çevir ve typing kontrolü yap
      const threadId = String(thread.id);
      const typingUsers = panelState.typingThreads.get(threadId);
      const isTyping = typingUsers && typingUsers.size > 0;
      const typingText = isTyping ? '<span class="typing-indicator-text">yazıyor...</span>' : '';
      
      // Debug log - tüm thread'ler için typing durumunu kontrol et
      if (panelState.typingThreads.size > 0) {
        console.log(`[renderThreads] Thread ${threadId} - typingUsers:`, typingUsers ? Array.from(typingUsers) : null, 'isTyping:', isTyping);
        console.log(`[renderThreads] All typingThreads:`, Array.from(panelState.typingThreads.entries()).map(([tid, users]) => [tid, Array.from(users)]));
      }
      
      return `
        <div class="thread-item ${isActive ? 'active' : ''}" data-thread="${thread.id}">
          <div class="thread-avatar">${avatarText}</div>
          <div class="thread-content">
            <div class="thread-top">
              <span class="thread-name">${thread.senderName || 'Bilinmeyen'}</span>
              <span class="thread-time">${formatRelative(thread.timestamp)}</span>
            </div>
            <div class="thread-bottom">
              ${isTyping ? typingText : `<span class="thread-preview">${escapeHtml(thread.lastMessage || '—')}</span>`}
              ${thread.isUnread ? `<span class="unread-badge">${thread.unreadCount}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  console.log(`[${side}] Setting threadList.innerHTML, HTML length:`, html.length);
  threadList.innerHTML = html;
  console.log(`[${side}] Thread list DOM updated, child count:`, threadList.children.length);

  [...threadList.querySelectorAll('.thread-item')].forEach((item) => {
    item.addEventListener('click', async () => {
      const { selectThread } = await import('./thread.service.js');
      selectThread(item.dataset.thread, panelState, side, els);
    });
  });

  // Yeni thread eklendiğinde scroll'u en üste al
  if (threadList.scrollTop > 0) {
    threadList.scrollTop = 0;
  }
}

export function renderThreadHeader(panelState, side, els) {
  if (!panelState.activeThread) return;
  const threadTitle = side === 'left' ? els.threadTitleLeft : els.threadTitleRight;
  const threadStatus = side === 'left' ? els.threadStatusLeft : els.threadStatusRight;

  threadTitle.textContent = panelState.activeThread.senderName || 'Bilinmeyen';
  threadStatus.textContent = panelState.activeThread.senderTitle || 'Kullanıcı';
}

export function renderMessages(panelState, side, els) {
  const messagesContainer = side === 'left' ? els.messagesContainerLeft : els.messagesContainerRight;

  if (!panelState.activeThreadItems.length) {
    messagesContainer.innerHTML = '<div class="empty-state">Henüz mesaj yok</div>';
    return;
  }

  messagesContainer.innerHTML = panelState.activeThreadItems
    .map((item) => renderMessageItem(item, panelState))
    .join('');

  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  messagesContainer.querySelectorAll('[data-read-btn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { markAsRead } = await import('./message.service.js');
      markAsRead(btn.dataset.id, panelState, side, els);
    });
  });

  messagesContainer.querySelectorAll('[data-support-chat]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { openSupportChat } = await import('./support.service.js');
      openSupportChat(btn.dataset.supportChat, panelState, side, els);
      // Note: activePanel is managed in app.js, not here
    });
  });

  // Accept/Reject butonları için event listener'lar
  messagesContainer.querySelectorAll('[data-accept-request]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { acceptSupportRequest } = await import('./support.service.js');
      acceptSupportRequest(btn.dataset.acceptRequest, panelState, side, els);
    });
  });

  messagesContainer.querySelectorAll('[data-reject-request]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { rejectSupportRequest } = await import('./support.service.js');
      rejectSupportRequest(btn.dataset.rejectRequest, panelState, side, els);
    });
  });
}

function renderMessageItem(item, panelState) {
  const timestamp = formatTime(item.data?.timestamp);
  const isSent = item.data?.sender?.id === String(panelState.user?.id);

  if (item.type === 'message') {
    let status = 'sent';
    
    if (isSent) {
      const isRead = !item.data?.isUnread;
      const isThreadOpen = panelState.activeThread && 
                          panelState.joinedThreads.has(panelState.activeThread.id);
      
      if (isRead) {
        status = isThreadOpen ? 'read' : 'delivered';
      }
    }
    
    return `
      <div class="message-bubble ${isSent ? 'sent' : 'received'}">
        <div class="message-content">${escapeHtml(item.data?.lastMessage || '')}</div>
        <div class="message-meta">
          <span class="message-time">${timestamp}</span>
          ${isSent ? `<span class="message-status ${status}"></span>` : ''}
        </div>
      </div>
    `;
  }

  if (item.type === 'send-tips') {
    return `
      <div class="card-item tips ${isSent ? 'sent' : 'received'}">
        <header>
          <strong>${item.data?.sender?.senderName || 'Bilinmeyen'} • TIPS</strong>
        </header>
        <p style="font-size: 1.2rem; font-weight: 700; margin: 0.5rem 0;">${item.data?.amount ?? 0} TIPS</p>
        ${item.data?.message ? `<p>${escapeHtml(item.data.message)}</p>` : ''}
        <div class="message-meta">
          <span class="message-time">${timestamp}</span>
          ${isSent ? `<span class="message-status read"></span>` : ''}
        </div>
      </div>
    `;
  }

  if (item.type === 'support-request') {
    const status = item.data?.status || 'pending';
    const threadId = item.data?.threadId;
    const currentUserId = String(panelState.user?.id);
    const senderId = item.data?.sender?.id;
    const isExpert = !isSent; // Alıcı expert (karşı taraf)
    const isPending = status === 'pending';
    const isAccepted = status === 'accepted' && threadId;
    
    // Expert tarafında (alıcı) pending ise accept/reject butonları göster
    // Gönderen tarafında (sender) pending ise sadece durum göster
    // Accepted ise ve threadId varsa "Open Support Chat" butonu göster
    let actionButtons = '';
    if (isExpert && isPending) {
      // Expert tarafında accept/reject butonları
      actionButtons = `
        <button class="action-btn accept-btn" data-accept-request="${item.id}">Accept</button>
        <button class="action-btn reject-btn" data-reject-request="${item.id}">Reject</button>
      `;
    } else if (isAccepted) {
      // Accept edilmişse ve threadId varsa "Open Support Chat" butonu
      actionButtons = `<button class="action-btn" data-support-chat="${item.id}">Open Support Chat</button>`;
    } else if (isPending) {
      // Gönderen tarafında pending ise sadece durum göster
      actionButtons = `<span class="tag pending-tag">Beklemede</span>`;
    } else {
      // Rejected veya diğer durumlar
      actionButtons = `<span class="tag rejected-tag">${status === 'rejected' ? 'Reddedildi' : status}</span>`;
    }
    
    // Thread ID bilgisini göster (varsa)
    const threadIdInfo = threadId 
      ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: #666; font-family: monospace;">
           <strong>Thread ID:</strong> ${escapeHtml(threadId)}
         </div>`
      : '';
    
    return `
      <div class="card-item support ${isSent ? 'sent' : 'received'}">
        <header>
          <strong>${item.data?.sender?.senderName || 'Bilinmeyen'} • Destek Talebi</strong>
        </header>
        <p><span class="tag">${item.data?.type}</span> ${escapeHtml(item.data?.message || '')}</p>
        <footer>
          <span class="tag">Durum: ${status}</span>
          <span class="tag">${item.data?.amount} TIPS</span>
          ${actionButtons}
        </footer>
        ${threadIdInfo}
        <div class="message-meta">
          <span class="message-time">${timestamp}</span>
          ${isSent ? `<span class="message-status read"></span>` : ''}
        </div>
      </div>
    `;
  }

  return '';
}

function getCounterpartId(panelState) {
  if (!panelState.activeThread) return null;
  return (
    panelState.counterpartMap.get(panelState.activeThread.id) ||
    panelState.activeThread?.sender?.id ||
    null
  );
}

export function renderSupportChat(panelState, side, els) {
  if (!panelState.supportChat) return;
  const { data } = panelState.supportChat;
  
  // Side'a göre doğru elementleri al
  const supportChatTitle = side === 'left' ? els.supportChatTitleLeft : els.supportChatTitleRight;
  const supportChatStatus = side === 'left' ? els.supportChatStatusLeft : els.supportChatStatusRight;
  const supportParticipants = side === 'left' ? els.supportParticipantsLeft : els.supportParticipantsRight;
  const supportSummary = side === 'left' ? els.supportSummaryLeft : els.supportSummaryRight;
  const supportMessages = side === 'left' ? els.supportMessagesLeft : els.supportMessagesRight;
  
  const counterpartId = getCounterpartId(panelState);
  const currentUser = panelState.user;
  
  // Counterpart bilgisini al - önce supportChat.data'dan, sonra activeThread.sender'dan
  let counterpart = null;
  if (data?.userName) {
    // Support request listesinden açıldıysa, data'dan al
    counterpart = {
      senderName: data.userName,
      senderTitle: data.userTitle || 'Technology Enthusiast',
    };
  } else {
    // DM thread içinden açıldıysa, activeThread.sender'dan al
    counterpart = panelState.activeThread?.sender;
  }
  
  // Header
  supportChatTitle.textContent = 'Support Chat';
  const threadId = panelState.supportChat?.threadId;
  const threadIdText = threadId ? ` • Thread: ${threadId.substring(0, 8)}...` : '';
  supportChatStatus.textContent = `${data?.type || 'GENERAL'} • ${data?.amount || 0} TIPS${threadIdText}`;
  
  // Participants - Görseldeki gibi yan yana
  if (currentUser && counterpart) {
    const currentUserInitials = (currentUser.profile?.displayName || currentUser.email || 'U').charAt(0).toUpperCase();
    const counterpartInitials = (counterpart.senderName || data?.userName || 'U').charAt(0).toUpperCase();
    const currentUserName = currentUser.profile?.displayName || currentUser.email || 'You';
    const counterpartName = counterpart.senderName || data?.userName || 'User';
    const currentUserTitle = currentUser.profile?.title || 'Technology Enthusiast';
    const counterpartTitle = counterpart.senderTitle || data?.userTitle || 'Technology Enthusiast';
    
    supportParticipants.innerHTML = `
      <div class="support-participant">
        <div class="support-participant-avatar">${currentUserInitials}</div>
        <div class="support-participant-info">
        <div class="support-participant-name">${escapeHtml(currentUserName)}</div>
          <div class="support-participant-title">${escapeHtml(currentUserTitle)}</div>
        </div>
      </div>
      <div class="support-participant-separator">⊞</div>
      <div class="support-participant">
        <div class="support-participant-avatar">${counterpartInitials}</div>
        <div class="support-participant-info">
        <div class="support-participant-name">${escapeHtml(counterpartName)}</div>
          <div class="support-participant-title">${escapeHtml(counterpartTitle)}</div>
        </div>
      </div>
    `;
  }
  
  // Summary Card
  const summaryCard = supportSummary;
  const topicSpan = summaryCard.querySelector('.support-summary-topic');
  const tipsSpan = summaryCard.querySelector('.support-summary-tips');
  const messageDiv = summaryCard.querySelector('.support-summary-message');
  const statusDiv = summaryCard.querySelector('.support-summary-status');
  const toggleBtn = summaryCard.querySelector('.support-summary-toggle');
  const contentDiv = summaryCard.querySelector('.support-summary-content');
  const arrowSpan = summaryCard.querySelector('.support-summary-arrow');
  
  if (topicSpan) topicSpan.textContent = data?.type || 'GENERAL';
  if (tipsSpan) tipsSpan.textContent = `${data?.amount || 0} TIPS`;
  if (messageDiv) messageDiv.textContent = data?.message || '';
  
  // Thread ID bilgisini status ile birlikte göster
  const threadIdForSummary = panelState.supportChat?.threadId;
  if (statusDiv) {
    statusDiv.innerHTML = `
      <div>Status: ${data?.status || 'pending'}</div>
      ${threadIdForSummary ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: #666; font-family: monospace;">Thread ID: ${escapeHtml(threadIdForSummary)}</div>` : ''}
    `;
  }
  
  // Toggle functionality
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      contentDiv.classList.toggle('hidden');
      arrowSpan.textContent = contentDiv.classList.contains('hidden') ? '▼' : '▲';
    };
  }
  
  // Messages
  if (!panelState.supportChatItems.length) {
    supportMessages.innerHTML = '<div class="empty-state">Henüz mesaj yok</div>';
    return;
  }
  
  supportMessages.innerHTML = panelState.supportChatItems
    .map((item) => {
      // SupportChatMessage formatı: { id, senderId, message, timestamp }
      const timestamp = formatTime(item.timestamp);
      const isSent = item.senderId === String(panelState.user?.id);
      // Support chat mesajları için basit status (okundu bilgisi yok)
      const status = 'sent';
      
      return `
        <div class="support-message-bubble ${isSent ? 'sent' : 'received'}">
          <div class="support-message-content">${escapeHtml(item.message || '')}</div>
          <div class="support-message-meta">
            <span class="message-time">${timestamp}</span>
            ${isSent ? `<span class="message-status ${status}"></span>` : ''}
          </div>
        </div>
      `;
    })
    .join('');
  
  supportMessages.scrollTop = supportMessages.scrollHeight;
}

