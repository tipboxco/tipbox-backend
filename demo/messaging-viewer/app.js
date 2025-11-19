// Main Application Entry Point
import { panels, createPanelState } from './services/state.service.js';
import { handleLogin, handleLogout } from './services/auth.service.js';
import { loadThreads, selectThread, handleSearch, backToInbox } from './services/thread.service.js';
import { sendMessage, markAsRead, sendSupportChatMessage } from './services/message.service.js';
import { initSocket, emitTyping, emitSupportTyping } from './services/socket.service.js';
import { openSupportModal, closeSupportModalUI, submitSupportRequest, openTipsModal, closeTipsModalUI, submitTips, openSupportChat, closeSupportChatPanel } from './services/support.service.js';

// Element References
const els = {
  // Left Panel
  authPanelLeft: document.getElementById('authPanelLeft'),
  appShellLeft: document.getElementById('appShellLeft'),
  loginFormLeft: document.getElementById('loginFormLeft'),
  emailLeft: document.getElementById('emailLeft'),
  passwordLeft: document.getElementById('passwordLeft'),
  userBadgeLeft: document.getElementById('userBadgeLeft'),
  refreshThreadsBtnLeft: document.getElementById('refreshThreadsBtnLeft'),
  logoutBtnLeft: document.getElementById('logoutBtnLeft'),
  searchInputLeft: document.getElementById('searchInputLeft'),
  unreadOnlyInputLeft: document.getElementById('unreadOnlyInputLeft'),
  threadListLeft: document.getElementById('threadListLeft'),
  inboxViewLeft: document.getElementById('inboxViewLeft'),
  threadViewContainerLeft: document.getElementById('threadViewContainerLeft'),
  threadViewLeft: document.getElementById('threadViewLeft'),
  backBtnLeft: document.getElementById('backBtnLeft'),
  threadTitleLeft: document.getElementById('threadTitleLeft'),
  threadStatusLeft: document.getElementById('threadStatusLeft'),
  messagesContainerLeft: document.getElementById('messagesContainerLeft'),
  typingIndicatorLeft: document.getElementById('typingIndicatorLeft'),
  messageInputLeft: document.getElementById('messageInputLeft'),
  sendMessageBtnLeft: document.getElementById('sendMessageBtnLeft'),
  requestSupportBtnLeft: document.getElementById('requestSupportBtnLeft'),
  sendTipsBtnLeft: document.getElementById('sendTipsBtnLeft'),
  supportChatViewLeft: document.getElementById('supportChatViewLeft'),
  closeSupportChatLeft: document.getElementById('closeSupportChatLeft'),
  supportChatTitleLeft: document.getElementById('supportChatTitleLeft'),
  supportChatStatusLeft: document.getElementById('supportChatStatusLeft'),
  supportParticipantsLeft: document.getElementById('supportParticipantsLeft'),
  supportSummaryLeft: document.getElementById('supportSummaryLeft'),
  supportMessagesLeft: document.getElementById('supportMessagesLeft'),
  supportTypingIndicatorLeft: document.getElementById('supportTypingIndicatorLeft'),
  supportChatInputLeft: document.getElementById('supportChatInputLeft'),
  supportChatSendLeft: document.getElementById('supportChatSendLeft'),

  // Right Panel
  authPanelRight: document.getElementById('authPanelRight'),
  appShellRight: document.getElementById('appShellRight'),
  loginFormRight: document.getElementById('loginFormRight'),
  emailRight: document.getElementById('emailRight'),
  passwordRight: document.getElementById('passwordRight'),
  userBadgeRight: document.getElementById('userBadgeRight'),
  refreshThreadsBtnRight: document.getElementById('refreshThreadsBtnRight'),
  logoutBtnRight: document.getElementById('logoutBtnRight'),
  searchInputRight: document.getElementById('searchInputRight'),
  unreadOnlyInputRight: document.getElementById('unreadOnlyInputRight'),
  threadListRight: document.getElementById('threadListRight'),
  inboxViewRight: document.getElementById('inboxViewRight'),
  threadViewContainerRight: document.getElementById('threadViewContainerRight'),
  threadViewRight: document.getElementById('threadViewRight'),
  backBtnRight: document.getElementById('backBtnRight'),
  threadTitleRight: document.getElementById('threadTitleRight'),
  threadStatusRight: document.getElementById('threadStatusRight'),
  messagesContainerRight: document.getElementById('messagesContainerRight'),
  typingIndicatorRight: document.getElementById('typingIndicatorRight'),
  messageInputRight: document.getElementById('messageInputRight'),
  sendMessageBtnRight: document.getElementById('sendMessageBtnRight'),
  requestSupportBtnRight: document.getElementById('requestSupportBtnRight'),
  sendTipsBtnRight: document.getElementById('sendTipsBtnRight'),
  supportChatViewRight: document.getElementById('supportChatViewRight'),
  closeSupportChatRight: document.getElementById('closeSupportChatRight'),
  supportChatTitleRight: document.getElementById('supportChatTitleRight'),
  supportChatStatusRight: document.getElementById('supportChatStatusRight'),
  supportParticipantsRight: document.getElementById('supportParticipantsRight'),
  supportSummaryRight: document.getElementById('supportSummaryRight'),
  supportMessagesRight: document.getElementById('supportMessagesRight'),
  supportTypingIndicatorRight: document.getElementById('supportTypingIndicatorRight'),
  supportChatInputRight: document.getElementById('supportChatInputRight'),
  supportChatSendRight: document.getElementById('supportChatSendRight'),

  // Shared Modals
  supportModal: document.getElementById('supportModal'),
  supportForm: document.getElementById('supportForm'),
  supportType: document.getElementById('supportType'),
  supportMessage: document.getElementById('supportMessage'),
  supportAmount: document.getElementById('supportAmount'),
  closeSupportModal: document.getElementById('closeSupportModal'),
  tipsModal: document.getElementById('tipsModal'),
  tipsForm: document.getElementById('tipsForm'),
  tipsAmount: document.getElementById('tipsAmount'),
  tipsMessage: document.getElementById('tipsMessage'),
  closeTipsModal: document.getElementById('closeTipsModal'),
};

let activePanel = null;

// Event Registration
function registerEvents() {
  console.log('registerEvents called', { 
    loginFormLeft: !!els.loginFormLeft, 
    loginFormRight: !!els.loginFormRight,
    panels: { left: !!panels.left, right: !!panels.right }
  });
  
  // Left Panel
  if (els.loginFormLeft) {
    els.loginFormLeft.addEventListener('submit', (e) => {
      console.log('[left] Login form submitted');
      handleLogin(e, 'left', panels.left, els);
    });
  } else {
    console.error('loginFormLeft not found');
  }
  els.logoutBtnLeft.addEventListener('click', () => handleLogout(panels.left, 'left', els));
  els.refreshThreadsBtnLeft.addEventListener('click', () => loadThreads(panels.left, 'left', els));
  els.searchInputLeft.addEventListener('input', () => handleSearch(panels.left, 'left', els));
  els.unreadOnlyInputLeft.addEventListener('change', () => handleSearch(panels.left, 'left', els));
  els.backBtnLeft.addEventListener('click', () => backToInbox(panels.left, 'left', els));
  els.sendMessageBtnLeft.addEventListener('click', () => sendMessage(panels.left, 'left', els));
  els.messageInputLeft.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(panels.left, 'left', els);
    }
  });
  
  let typingDebounceLeft = null;
  els.messageInputLeft.addEventListener('input', () => {
    if (!panels.left.activeThread) return;
    emitTyping(panels.left, true);
    if (typingDebounceLeft) clearTimeout(typingDebounceLeft);
    typingDebounceLeft = setTimeout(() => {
      emitTyping(panels.left, false);
    }, 3000);
  });
  els.messageInputLeft.addEventListener('blur', () => {
    emitTyping(panels.left, false);
    if (typingDebounceLeft) {
      clearTimeout(typingDebounceLeft);
      typingDebounceLeft = null;
    }
  });
  
  els.requestSupportBtnLeft.addEventListener('click', () => {
    activePanel = openSupportModal(panels.left, 'left');
    if (activePanel) els.supportModal.classList.remove('hidden');
  });
  els.sendTipsBtnLeft.addEventListener('click', () => {
    activePanel = openTipsModal(panels.left, 'left');
    if (activePanel) els.tipsModal.classList.remove('hidden');
  });
  
  els.closeSupportChatLeft.addEventListener('click', () => {
    closeSupportChatPanel(panels.left, 'left', els);
  });
  els.supportChatSendLeft.addEventListener('click', () => {
    sendSupportChatMessage(panels.left, 'left', els);
  });
  els.supportChatInputLeft.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendSupportChatMessage(panels.left, 'left', els);
    }
  });
  let supportTypingDebounceLeft = null;
  els.supportChatInputLeft.addEventListener('input', () => {
    if (!panels.left.supportChat) return;
    emitSupportTyping(panels.left, true);
    if (supportTypingDebounceLeft) clearTimeout(supportTypingDebounceLeft);
    supportTypingDebounceLeft = setTimeout(() => {
      emitSupportTyping(panels.left, false);
    }, 3000);
  });
  els.supportChatInputLeft.addEventListener('blur', () => {
    emitSupportTyping(panels.left, false);
    if (supportTypingDebounceLeft) {
      clearTimeout(supportTypingDebounceLeft);
      supportTypingDebounceLeft = null;
    }
  });

  // Right Panel
  if (els.loginFormRight) {
    els.loginFormRight.addEventListener('submit', (e) => {
      console.log('[right] Login form submitted');
      handleLogin(e, 'right', panels.right, els);
    });
  } else {
    console.error('loginFormRight not found');
  }
  els.logoutBtnRight.addEventListener('click', () => handleLogout(panels.right, 'right', els));
  els.refreshThreadsBtnRight.addEventListener('click', () => loadThreads(panels.right, 'right', els));
  els.searchInputRight.addEventListener('input', () => handleSearch(panels.right, 'right', els));
  els.unreadOnlyInputRight.addEventListener('change', () => handleSearch(panels.right, 'right', els));
  els.backBtnRight.addEventListener('click', () => backToInbox(panels.right, 'right', els));
  els.sendMessageBtnRight.addEventListener('click', () => sendMessage(panels.right, 'right', els));
  els.messageInputRight.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(panels.right, 'right', els);
    }
  });
  
  let typingDebounceRight = null;
  els.messageInputRight.addEventListener('input', () => {
    if (!panels.right.activeThread) return;
    emitTyping(panels.right, true);
    if (typingDebounceRight) clearTimeout(typingDebounceRight);
    typingDebounceRight = setTimeout(() => {
      emitTyping(panels.right, false);
    }, 3000);
  });
  els.messageInputRight.addEventListener('blur', () => {
    emitTyping(panels.right, false);
    if (typingDebounceRight) {
      clearTimeout(typingDebounceRight);
      typingDebounceRight = null;
    }
  });
  
  els.requestSupportBtnRight.addEventListener('click', () => {
    activePanel = openSupportModal(panels.right, 'right');
    if (activePanel) els.supportModal.classList.remove('hidden');
  });
  els.sendTipsBtnRight.addEventListener('click', () => {
    activePanel = openTipsModal(panels.right, 'right');
    if (activePanel) els.tipsModal.classList.remove('hidden');
  });
  
  els.closeSupportChatRight.addEventListener('click', () => {
    closeSupportChatPanel(panels.right, 'right', els);
  });
  els.supportChatSendRight.addEventListener('click', () => {
    sendSupportChatMessage(panels.right, 'right', els);
  });
  els.supportChatInputRight.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendSupportChatMessage(panels.right, 'right', els);
    }
  });
  let supportTypingDebounceRight = null;
  els.supportChatInputRight.addEventListener('input', () => {
    if (!panels.right.supportChat) return;
    emitSupportTyping(panels.right, true);
    if (supportTypingDebounceRight) clearTimeout(supportTypingDebounceRight);
    supportTypingDebounceRight = setTimeout(() => {
      emitSupportTyping(panels.right, false);
    }, 3000);
  });
  els.supportChatInputRight.addEventListener('blur', () => {
    emitSupportTyping(panels.right, false);
    if (supportTypingDebounceRight) {
      clearTimeout(supportTypingDebounceRight);
      supportTypingDebounceRight = null;
    }
  });

  // Shared Modals
  els.closeSupportModal.addEventListener('click', () => {
    closeSupportModalUI(els);
    activePanel = null;
  });
  els.supportForm.addEventListener('submit', (e) => submitSupportRequest(e, activePanel, els));
  els.closeTipsModal.addEventListener('click', () => {
    closeTipsModalUI(els);
    activePanel = null;
  });
  els.tipsForm.addEventListener('submit', (e) => submitTips(e, activePanel, els));
  
}

// Hydrate from storage
function hydrateFromStorage() {
  ['left', 'right'].forEach((side) => {
    try {
      const data = JSON.parse(localStorage.getItem(`messagingDemo_${side}`) || '{}');
      const emailInput = side === 'left' ? els.emailLeft : els.emailRight;
      if (data.email) emailInput.value = data.email;
    } catch (error) {
      console.warn(`localStorage parse error [${side}]`, error);
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hydrateFromStorage();
    registerEvents();
  });
} else {
  hydrateFromStorage();
  registerEvents();
}
