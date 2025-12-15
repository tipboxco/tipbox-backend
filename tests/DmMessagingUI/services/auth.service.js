// Authentication Service
import { apiFetch } from './api.service.js';
import { showAppShell } from './ui.service.js';
import { loadThreads } from './thread.service.js';
import { initSocket } from './socket.service.js';

export async function handleLogin(event, side, panelState, els) {
  console.log(`[${side}] handleLogin called`);
  event.preventDefault();
  
  const emailInput = side === 'left' ? els.emailLeft : els.emailRight;
  const passwordInput = side === 'left' ? els.passwordLeft : els.passwordRight;
  const loginForm = side === 'left' ? els.loginFormLeft : els.loginFormRight;

  if (!emailInput || !passwordInput || !loginForm) {
    console.error(`[${side}] Login form elements not found`, { emailInput, passwordInput, loginForm });
    alert('Form elementleri bulunamadı');
    return;
  }

  // baseUrl sabit olarak ayarlanıyor
  const baseUrl = 'http://localhost:3000';
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  console.log(`[${side}] Login attempt:`, { baseUrl, email, hasPassword: !!password });

  if (!email || !password) {
    alert('Lütfen tüm alanları doldurun');
    return;
  }

  const button = loginForm.querySelector('button');
  if (!button) {
    console.error('Login button not found');
    return;
  }
  button.disabled = true;
  try {
    panelState.baseUrl = baseUrl;
    console.log(`[${side}] Calling apiFetch with:`, { baseUrl, path: '/auth/login', panelState: !!panelState });
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, panelState);
    console.log(`[${side}] Login response received:`, { hasToken: !!data?.token });
    
    if (!data || !data.token) {
      throw new Error('Geçersiz yanıt: Token alınamadı');
    }
    
    panelState.token = data.token;
    panelState.user = data;
    localStorage.setItem(`messagingDemo_${side}`, JSON.stringify({ baseUrl, email }));

    showAppShell(panelState, side, els);
    await Promise.all([loadThreads(panelState, side, els), initSocket(panelState, side, els)]);
  } catch (error) {
    console.error('Login error:', error);
    const errorMessage = error.message || 'Bilinmeyen hata';
    alert(`Giriş başarısız: ${errorMessage}`);
  } finally {
    button.disabled = false;
  }
}

export function handleLogout(panelState, side, els) {
  panelState.token = null;
  panelState.user = null;
  panelState.threads = [];
  panelState.filteredThreads = [];
  panelState.activeThread = null;
  panelState.activeThreadItems = [];
  panelState.counterpartMap.clear();
  if (panelState.socket) {
    panelState.socket.disconnect();
    panelState.socket = null;
  }
  const authPanel = side === 'left' ? els.authPanelLeft : els.authPanelRight;
  const appShell = side === 'left' ? els.appShellLeft : els.appShellRight;
  authPanel.classList.remove('hidden');
  appShell.classList.add('hidden');
}

