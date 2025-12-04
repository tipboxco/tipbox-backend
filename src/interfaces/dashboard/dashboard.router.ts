import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import http from 'http';
import net from 'net';

const execAsync = promisify(exec);
const router = Router();

// Container'lar için fallback port kontrolü (docker ps çalışmazsa)
const containerPortMap: Record<
  string,
  { host: string; port: number; type: 'http' | 'tcp'; path?: string }
> = {
  tipbox_backend: { host: 'localhost', port: 3000, type: 'http', path: '/health' },
  tipbox_postgres: { host: 'postgres', port: 5432, type: 'tcp' },
  tipbox_redis: { host: 'redis', port: 6379, type: 'tcp' },
  tipbox_minio: { host: 'minio', port: 9000, type: 'http' },
  tipbox_pgadmin: { host: 'pgadmin', port: 80, type: 'http' },
  tipbox_prisma_studio: { host: 'prisma-studio', port: 5555, type: 'http' },
};

async function checkContainerByPort(containerName: string): Promise<boolean> {
  const cfg = containerPortMap[containerName];
  if (!cfg) return false;

  if (cfg.type === 'http') {
    return new Promise(resolve => {
      const req = http.get(
        {
          host: cfg.host,
          port: cfg.port,
          path: cfg.path || '/',
          timeout: 2000,
        },
        res => {
          res.resume(); // body'yi okumadan kapat
          resolve(typeof res.statusCode === 'number');
        },
      );

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  // TCP port kontrolü (Postgres, Redis gibi)
  return new Promise(resolve => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 2000);

    socket.connect(cfg.port, cfg.host, () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

// Container port bilgileri
const services = [
  {
    name: 'Backend API',
    port: 3000,
    path: '/',
    description: 'Ana backend servisi',
    icon: 'fa-server',
    containerName: 'tipbox_backend',
    canControlContainer: true,
  },
  {
    name: 'Swagger Docs',
    port: 3000,
    path: '/api-docs',
    description: 'API dokümantasyonu',
    path: '/api-docs',
    icon: 'fa-book',
    containerName: 'tipbox_backend',
    canControlContainer: false,
  },
  {
    name: 'Socket Messaging UI',
    port: 3000,
    path: '/Socket',
    description: 'Socket.IO tabanlı Messaging demo arayüzü',
    path: '/Socket',
    icon: 'fa-comments',
    containerName: 'tipbox_backend',
    canControlContainer: false,
  },
  {
    name: 'Prisma Studio',
    port: 5555,
    path: '',
    description: 'Database GUI',
    icon: 'fa-table',
    containerName: 'tipbox_prisma_studio',
    canControlContainer: true,
  },
  {
    name: 'pgAdmin',
    port: 5050,
    path: '',
    description: 'PostgreSQL yönetim arayüzü',
    icon: 'fa-database',
    containerName: 'tipbox_pgadmin',
    canControlContainer: true,
  },
  {
    name: 'MinIO Console',
    port: 9001,
    path: '',
    description: 'MinIO object storage konsolu',
    icon: 'fa-cloud',
    containerName: 'tipbox_minio',
    canControlContainer: true,
  },
  {
    name: 'MinIO API',
    port: 9000,
    path: '',
    description: 'MinIO API endpoint',
    icon: 'fa-cloud-upload-alt',
    containerName: 'tipbox_minio',
    canControlContainer: true,
  },
  {
    name: 'PostgreSQL',
    port: 5432,
    url: 'localhost:5432',
    description: 'PostgreSQL veritabanı',
    icon: 'fa-database',
    containerName: 'tipbox_postgres',
    canControlContainer: true,
  },
  {
    name: 'Redis',
    port: 6379,
    url: 'localhost:6379',
    description: 'Redis cache servisi',
    icon: 'fa-bolt',
    containerName: 'tipbox_redis',
    canControlContainer: true,
  },
];

// Seed bilgileri
const seedCommands = [
  { name: 'Tüm Seed Verileri', command: 'db:seed', description: 'Tüm seed verilerini ekle (prisma/seed.ts)', icon: 'fa-database' },
  { name: 'Tümü (Ayrı Seed)', command: 'db:seed:all', description: 'Tüm seed verilerini ekle (ayrı dosyalar)', icon: 'fa-seedling' },
  { name: 'User Seed', command: 'db:seed:user', description: 'Kullanıcı ve profil verileri', icon: 'fa-users' },
  { name: 'Content Seed', command: 'db:seed:content', description: 'Ürün ve içerik verileri', icon: 'fa-box' },
  { name: 'Feed Seed', command: 'db:seed:feed', description: 'Feed ve trending verileri', icon: 'fa-stream' },
  { name: 'Taxonomy Seed', command: 'db:seed:taxonomy', description: 'Kategori ve taksonomi verileri', icon: 'fa-tags' },
  { name: 'Marketplace Seed', command: 'db:seed:marketplace', description: 'Marketplace verileri', icon: 'fa-store' },
  { name: 'Explore Seed', command: 'db:seed:explore', description: 'Explore ve brand verileri', icon: 'fa-compass' },
];

// JavaScript kodunu ayrı bir değişkene al (template literal sorunlarını önlemek için)
const dashboardScript = `
    console.log('Dashboard script loaded');
    
    let pendingAction = null;
    let currentStepIndex = 0;
    let actionSteps = [];

    function showModal(title, body, steps = []) {
      document.getElementById('modalHeader').textContent = title;
      document.getElementById('modalBody').innerHTML = body;
      const stepsDiv = document.getElementById('modalSteps');
      if (steps.length > 0) {
        stepsDiv.style.display = 'block';
        stepsDiv.innerHTML = steps.map((step, idx) => 
          '<div class="modal-step">' +
            '<div class="modal-step-title">Adım ' + (idx + 1) + ': ' + step.title + '</div>' +
            '<div class="modal-step-desc">' + step.description + '</div>' +
          '</div>'
        ).join('');
      } else {
        stepsDiv.style.display = 'none';
      }
      document.getElementById('confirmModal').style.display = 'block';
    }

    function closeModal() {
      console.log('closeModal called');
      const modal = document.getElementById('confirmModal');
      if (modal) {
        modal.style.display = 'none';
      }
      pendingAction = null;
      currentStepIndex = 0;
      actionSteps = [];
    }

    function confirmClearTestData() {
      console.log('confirmClearTestData called');
      showModal(
        'Test Verilerini Kaldır',
        '<p><strong>UYARI:</strong> Bu işlem test kullanıcıları ve onların tüm verilerini kalıcı olarak silecektir.</p><p>Bu işlem geri alınamaz!</p>'
      );
      pendingAction = 'clear-test';
      console.log('pendingAction set to:', pendingAction);
    }

    function confirmClearSeedData() {
      console.log('confirmClearSeedData called');
      const steps = [
        { title: 'Prisma Client Generate', description: 'Prisma client\\'ı yeniden oluşturulacak (gerekirse)' },
        { title: 'Seed Verilerini Temizle', description: 'Tüm seed verileri veritabanından kaldırılacak' }
      ];
      
      showModal(
        'Seed Verilerini Kaldır',
        '<p><strong>UYARI:</strong> Bu işlem tüm seed verilerini kalıcı olarak silecektir.</p><p>Bu işlem geri alınamaz!</p><p>Bu işlem aşağıdaki adımları içerir:</p>',
        steps
      );
      pendingAction = 'clear-seed';
      actionSteps = steps;
      currentStepIndex = 0;
      console.log('pendingAction set to:', pendingAction);
    }

    async function executeConfirmedAction() {
      console.log('executeConfirmedAction called, pendingAction:', pendingAction);
      
      if (!pendingAction) {
        console.error('No pending action!');
        closeModal();
        return;
      }

      // pendingAction'ı sakla çünkü closeModal() onu sıfırlayacak
      const action = pendingAction;
      
      // Modal'ı kapat (pendingAction'ı sıfırlar ama action değişkeninde sakladık)
      const modal = document.getElementById('confirmModal');
      if (modal) {
        modal.style.display = 'none';
      }
      pendingAction = null;
      currentStepIndex = 0;
      actionSteps = [];
      
      let button, status;
      
      if (action === 'clear-test') {
        console.log('Executing clear-test action');
        button = document.getElementById('btn-clear-test');
        status = document.getElementById('status-clear-test');
        
        if (!button || !status) {
          console.error('Button or status element not found for clear-test');
          alert('Buton veya status elementi bulunamadı');
          return;
        }
        
        await executeClearTestData(button, status);
      } else if (action === 'clear-seed') {
        console.log('Executing clear-seed action');
        button = document.getElementById('btn-clear-seed');
        status = document.getElementById('status-clear-seed');
        
        if (!button || !status) {
          console.error('Button or status element not found for clear-seed');
          alert('Buton veya status elementi bulunamadı');
          return;
        }
        
        await executeClearSeedData(button, status);
      } else {
        console.error('Unknown action:', action);
      }
    }

    async function executeClearTestData(button, status) {
      console.log('executeClearTestData called');
      button.disabled = true;
      status.innerHTML = '<div class="status loading">Test verileri temizleniyor...</div>';
      
      try {
        console.log('Fetching /clear-test-data');
        const response = await fetch('/clear-test-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
          status.innerHTML = '<div class="status success">✓ ' + data.message + '</div>';
        } else {
          status.innerHTML = '<div class="status error">✗ ' + (data.error || 'Bilinmeyen hata') + '</div>';
        }
      } catch (error) {
        console.error('Clear test data error:', error);
        status.innerHTML = '<div class="status error">✗ Hata: ' + error.message + '</div>';
        alert('Hata: ' + error.message);
      } finally {
        button.disabled = false;
        setTimeout(function() {
          status.innerHTML = '';
        }, 5000);
      }
    }

    async function executeClearSeedData(button, status) {
      console.log('executeClearSeedData called');
      button.disabled = true;
      status.innerHTML = '<div class="status loading">Seed verileri temizleniyor...</div>';
      
      try {
        console.log('Checking if Prisma generate is needed');
        const needsGenerate = await checkNeedsGenerate();
        console.log('Needs generate:', needsGenerate);
        
        if (needsGenerate) {
          const confirmGenerate = confirm('Prisma Client güncellenmesi gerekiyor. Devam etmek istiyor musunuz?');
          if (!confirmGenerate) {
            status.innerHTML = '<div class="status error">✗ İşlem iptal edildi</div>';
            button.disabled = false;
            return;
          }
          
          status.innerHTML = '<div class="status loading">Prisma Client generate ediliyor...</div>';
          console.log('Fetching /generate-client');
          const generateResponse = await fetch('/generate-client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          console.log('Generate response status:', generateResponse.status);
          
          if (!generateResponse.ok) {
            const errorData = await generateResponse.json();
            status.innerHTML = '<div class="status error">✗ Prisma Generate hatası: ' + (errorData.error || 'Bilinmeyen hata') + '</div>';
            button.disabled = false;
            return;
          }
        }
        
        status.innerHTML = '<div class="status loading">Seed verileri temizleniyor...</div>';
        console.log('Fetching /clear-seed-data');
        const response = await fetch('/clear-seed-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
          status.innerHTML = '<div class="status success">✓ ' + data.message + '</div>';
        } else {
          status.innerHTML = '<div class="status error">✗ ' + (data.error || 'Bilinmeyen hata') + '</div>';
        }
      } catch (error) {
        console.error('Clear seed data error:', error);
        status.innerHTML = '<div class="status error">✗ Hata: ' + error.message + '</div>';
        alert('Hata: ' + error.message);
      } finally {
        button.disabled = false;
        setTimeout(function() {
          status.innerHTML = '';
        }, 5000);
      }
    }

    async function checkNeedsGenerate() {
      try {
        const response = await fetch('/check-generate', {
          method: 'GET'
        });
        const data = await response.json();
        return data.needsGenerate || false;
      } catch (error) {
        return false;
      }
    }

    async function runAllSeeds() {
      console.log('runAllSeeds called');
      
      const button = document.getElementById('btn-seed-all');
      const status = document.getElementById('status-seed-all');
      
      if (!button || !status) {
        console.error('Button or status element not found for runAllSeeds');
        alert('Buton veya status elementi bulunamadı');
        return;
      }
      
      button.disabled = true;
      status.innerHTML = '<div class="status loading">Tüm seedler yükleniyor...</div>';
      
      let response = null;
      try {
        console.log('Fetching /seed with command: db:seed');
        response = await fetch('/seed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command: 'db:seed' })
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
          status.innerHTML = '<div class="status success">✓ ' + data.message + '</div>';
        } else {
          status.innerHTML = '<div class="status error">✗ ' + (data.error || 'Bilinmeyen hata') + '</div>';
        }
      } catch (error) {
        console.error('Seed error:', error);
        status.innerHTML = '<div class="status error">✗ Hata: ' + error.message + '</div>';
        alert('Hata: ' + error.message);
      } finally {
        button.disabled = false;
        setTimeout(function() {
          status.innerHTML = '';
        }, 5000);
      }
    }
    
    // Global scope'a fonksiyonları ekle (onclick için)
    window.runAllSeeds = runAllSeeds;
    window.confirmClearTestData = confirmClearTestData;
    window.confirmClearSeedData = confirmClearSeedData;
    window.executeConfirmedAction = executeConfirmedAction;
    window.closeModal = closeModal;

    // Modal dışına tıklandığında kapat
    window.onclick = function(event) {
      const modal = document.getElementById('confirmModal');
      if (event.target === modal) {
        closeModal();
      }
    }
    
    // Event listener'ları ekle (script yüklendiğinde DOM hazır olmalı)
    function setupEventListeners() {
      console.log('Setting up event listeners');
      
      // Modal butonlarına event listener ekle
      const confirmButton = document.getElementById('confirmButton');
      if (confirmButton) {
        // Mevcut onclick'i kaldır ve event listener ekle
        confirmButton.onclick = null;
        confirmButton.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Confirm button clicked');
          executeConfirmedAction();
        });
        console.log('Confirm button listener added');
      } else {
        console.error('Confirm button not found');
      }
      
      const cancelButton = document.getElementById('cancelButton');
      if (cancelButton) {
        cancelButton.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Cancel button clicked');
          closeModal();
        });
        console.log('Cancel button listener added');
      } else {
        console.error('Cancel button not found');
      }
      
      // Test butonlarına event listener ekle
      const clearTestButton = document.getElementById('btn-clear-test');
      if (clearTestButton) {
        clearTestButton.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Clear test button clicked');
          confirmClearTestData();
        });
        console.log('Clear test button listener added');
      } else {
        console.error('Clear test button not found');
      }
      
      const clearSeedButton = document.getElementById('btn-clear-seed');
      if (clearSeedButton) {
        clearSeedButton.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Clear seed button clicked');
          confirmClearSeedData();
        });
        console.log('Clear seed button listener added');
      } else {
        console.error('Clear seed button not found');
      }
    }
    
    async function updateDockerStatusUI() {
      try {
        const response = await fetch('/docker/status');
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const statuses = data.statuses || {};
        
        Object.keys(statuses).forEach(function(containerName) {
          const isRunning = !!statuses[containerName];
          const elements = document.querySelectorAll('[data-container="' + containerName + '"]');
          
          elements.forEach(function(el) {
            const dot = el.querySelector('.status-dot');
            const label = el.querySelector('.status-label');
            if (!dot) return;
            
            dot.classList.remove('status-online', 'status-offline');
            if (isRunning) {
              dot.classList.add('status-online');
              if (label) label.textContent = 'Online';
            } else {
              dot.classList.add('status-offline');
              if (label) label.textContent = 'Offline';
            }
          });

          // İlgili kartlardaki Start/Stop butonlarını status'e göre enable/disable et
          const actionContainers = document.querySelectorAll(
            '.container-actions [onclick*="' + containerName + '"]'
          );
          actionContainers.forEach(function(btn) {
            const isStartButton = btn.classList.contains('start');
            const isStopButton = btn.classList.contains('stop');

            if (isRunning) {
              // Container çalışıyorsa: Start disabled, Stop enabled
              if (isStartButton) btn.disabled = true;
              if (isStopButton) btn.disabled = false;
            } else {
              // Container çalışmıyorsa: Start enabled, Stop disabled
              if (isStartButton) btn.disabled = false;
              if (isStopButton) btn.disabled = true;
            }
          });
        });
      } catch (e) {
        // Sessizce yut, dashboard çalışmaya devam etsin
      }
    }
    
    async function dockerContainerStop(containerName) {
      if (!confirm(containerName + ' container\\'ını durdurmak istediğinize emin misiniz?')) {
        return;
      }
      
      try {
        const buttons = document.querySelectorAll('.container-actions [onclick*="' + containerName + '"]');
        buttons.forEach(function(btn) { btn.disabled = true; });
        
        const response = await fetch('/docker/container/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ containerName: containerName })
        });
        const data = await response.json().catch(function() { return {}; });
        
        if (!response.ok) {
          alert('Hata: ' + (data.error || 'Container durdurulamadı'));
        }
        
        await updateDockerStatusUI();
      } catch (e) {
        alert('Hata: ' + (e && e.message ? e.message : e));
      } finally {
        const buttons = document.querySelectorAll('.container-actions [onclick*="' + containerName + '"]');
        buttons.forEach(function(btn) { btn.disabled = false; });
      }
    }
    
    async function dockerContainerStart(containerName) {
      try {
        const buttons = document.querySelectorAll('.container-actions [onclick*="' + containerName + '"]');
        buttons.forEach(function(btn) { btn.disabled = true; });
        
        const response = await fetch('/docker/container/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ containerName: containerName })
        });
        const data = await response.json().catch(function() { return {}; });
        
        if (!response.ok) {
          alert('Hata: ' + (data.error || 'Container başlatılamadı'));
        }
        
        await updateDockerStatusUI();
      } catch (e) {
        alert('Hata: ' + (e && e.message ? e.message : e));
      } finally {
        const buttons = document.querySelectorAll('.container-actions [onclick*="' + containerName + '"]');
        buttons.forEach(function(btn) { btn.disabled = false; });
      }
    }
    
    // DOM yüklendikten sonra veya hemen çalıştır
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setupEventListeners();
        updateDockerStatusUI();
        setInterval(updateDockerStatusUI, 15000);
      });
    } else {
      // DOM zaten yüklenmiş, hemen çalıştır
      setTimeout(function() {
        setupEventListeners();
        updateDockerStatusUI();
        setInterval(updateDockerStatusUI, 15000);
      }, 100);
    }

    function showLoading(text) {
      const overlay = document.getElementById('loadingOverlay');
      const loadingText = document.getElementById('loadingText');
      loadingText.textContent = text;
      overlay.classList.add('active');
    }

    function hideLoading() {
      const overlay = document.getElementById('loadingOverlay');
      overlay.classList.remove('active');
    }

    function disableDockerButtons() {
      document.getElementById('btn-docker-stop').disabled = true;
      document.getElementById('btn-docker-down').disabled = true;
      document.getElementById('btn-docker-start').disabled = true;
    }

    function enableDockerButtons() {
      document.getElementById('btn-docker-stop').disabled = false;
      document.getElementById('btn-docker-down').disabled = false;
      document.getElementById('btn-docker-start').disabled = false;
    }

    async function dockerStop() {
      console.log('dockerStop called');
      
      if (!confirm('Tüm container\\'ları durdurmak istediğinize emin misiniz?')) {
        return;
      }

      disableDockerButtons();
      showLoading('Container\\'lar durduruluyor...');

      try {
        console.log('Fetching /docker/stop');
        const response = await fetch('/docker/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
          alert('✓ ' + data.message);
        } else {
          alert('✗ Hata: ' + (data.error || 'Bilinmeyen hata'));
        }
      } catch (error) {
        console.error('Docker stop error:', error);
        alert('✗ Hata: ' + error.message);
      } finally {
        enableDockerButtons();
        hideLoading();
      }
    }
    
    window.dockerStop = dockerStop;

    async function dockerDown() {
      console.log('dockerDown called');
      
      if (!confirm('Tüm container\\'ları durdurup kaldırmak istediğinize emin misiniz?')) {
        return;
      }

      disableDockerButtons();
      showLoading('Container\\'lar kaldırılıyor...');

      try {
        console.log('Fetching /docker/down');
        const response = await fetch('/docker/down', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
          alert('✓ ' + data.message);
        } else {
          alert('✗ Hata: ' + (data.error || 'Bilinmeyen hata'));
        }
      } catch (error) {
        console.error('Docker down error:', error);
        alert('✗ Hata: ' + error.message);
      } finally {
        enableDockerButtons();
        hideLoading();
      }
    }
    
    window.dockerDown = dockerDown;

    async function dockerStart() {
      console.log('dockerStart called');
      
      disableDockerButtons();
      showLoading('Container\\'lar başlatılıyor...');

      try {
        console.log('Fetching /docker/start');
        const response = await fetch('/docker/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!response.ok) {
          alert('✗ Hata: ' + (data.error || 'Bilinmeyen hata'));
          enableDockerButtons();
          hideLoading();
          return;
        }

        showLoading('Container\\'lar hazırlanıyor...');
        await waitForContainers();

        showLoading('Backend hazırlanıyor...');
        await waitForBackend();

        showLoading('Son kontroller yapılıyor...');
        await new Promise(function(resolve) { setTimeout(resolve, 3000); });

        hideLoading();
        enableDockerButtons();
        
        window.location.reload();
      } catch (error) {
        console.error('Docker start error:', error);
        alert('✗ Hata: ' + error.message);
        enableDockerButtons();
        hideLoading();
      }
    }
    
    window.dockerStart = dockerStart;

    async function waitForContainers() {
      const maxAttempts = 60;
      let attempts = 0;

      while (attempts < maxAttempts) {
        try {
          const response = await fetch('/docker/status');
          const data = await response.json();
          
          if (data.allRunning) {
            return true;
          }
        } catch (error) {
          // Devam et
        }

        await new Promise(function(resolve) { setTimeout(resolve, 1000); });
        attempts++;
      }

      throw new Error('Container\\'lar başlatılamadı (timeout)');
    }

    async function waitForBackend() {
      const maxAttempts = 60;
      let attempts = 0;

      while (attempts < maxAttempts) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(function() { controller.abort(); }, 2000);
          
          try {
            const healthCheck = await fetch('/', { 
              method: 'GET',
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (healthCheck.ok || healthCheck.status < 500) {
              return true;
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
          }
        } catch (error) {
          // Devam et
        }

        await new Promise(function(resolve) { setTimeout(resolve, 1000); });
        attempts++;
      }

      return true;
    }
`;

// Dashboard HTML - sadece root path
router.get('/', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tipbox Developer Console</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Jura:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Jura', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #272727;
      color: #FAFAFA;
      min-height: 100vh;
      padding: 32px 24px;
      line-height: 1.6;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 48px;
      gap: 32px;
      padding-bottom: 32px;
      border-bottom: 1px solid rgba(163, 163, 163, 0.2);
    }
    .dashboard-header-left {
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .dashboard-header-logo {
      height: 60px;
      width: auto;
      object-fit: contain;
      animation: fadeInSlide 0.8s ease-out forwards;
    }
    h1 {
      color: #FAFAFA;
      text-align: left;
      margin: 0;
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    @keyframes fadeInSlide {
      0% {
        opacity: 0;
        transform: translateX(20px);
      }
      100% {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @media (max-width: 768px) {
      .dashboard-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 24px;
      }
      .dashboard-header-left {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
      .dashboard-header-logo {
        height: 50px;
      }
      h1 {
        font-size: 2rem;
      }
    }
    .section {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid #D0F205;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 32px;
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
    }
    .section:hover {
      border-color: #D0F205;
      box-shadow: 0 4px 20px rgba(208, 242, 5, 0.2);
    }
    .section-title {
      font-size: 1.75rem;
      font-weight: 600;
      margin-bottom: 28px;
      color: #FAFAFA;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
      padding-left: 20px;
    }
    .section-title::before {
      content: '';
      position: absolute;
      left: 0;
      width: 4px;
      height: 24px;
      background: #D0F205;
      border-radius: 2px;
    }
    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, rgba(208, 242, 5, 0.3) 0%, transparent 100%);
    }
    .ports-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .port-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid #D0F205;
      border-radius: 12px;
      padding: 24px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }
    .port-card:hover {
      transform: translateY(-2px);
      border-color: #D0F205;
      background: rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 16px rgba(208, 242, 5, 0.25);
    }
    .port-card h3 {
      color: #FAFAFA;
      margin-bottom: 8px;
      font-size: 1.1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .service-header {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: space-between;
    }
    .port-card .icon {
      font-size: 1.3rem;
      color: #D0F205;
      width: 24px;
      text-align: center;
    }
    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #A3A3A3;
      margin-left: auto;
      white-space: nowrap;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #525252;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.4);
      transition: background-color 0.2s ease, box-shadow 0.2s ease;
    }
    .status-dot.status-online {
      background: #22c55e;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
    }
    .status-dot.status-offline {
      background: #ef4444;
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.7);
    }
    .container-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
    }
    .container-button {
      border: 1px solid rgba(163, 163, 163, 0.3);
      background: rgba(255, 255, 255, 0.02);
      color: #e5e5e5;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 0.75rem;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
    }
    .container-button:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(163, 163, 163, 0.5);
      transform: translateY(-1px);
    }
    .container-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .container-button.stop {
      border-color: rgba(220, 53, 69, 0.6);
      color: #fecaca;
    }
    .container-button.stop:hover:not(:disabled) {
      background: rgba(220, 53, 69, 0.18);
    }
    .container-button.start {
      border-color: rgba(34, 197, 94, 0.6);
      color: #bbf7d0;
    }
    .container-button.start:hover:not(:disabled) {
      background: rgba(34, 197, 94, 0.18);
    }
    .port-card p {
      color: #A3A3A3;
      font-size: 0.875rem;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .port-card .url {
      color: #A3A3A3;
      font-weight: 400;
      font-size: 0.875rem;
      word-break: break-all;
      font-family: 'Monaco', 'Courier New', monospace;
      opacity: 0.8;
      transition: opacity 0.2s ease;
    }
    .port-card:hover .url {
      opacity: 1;
      color: #FAFAFA;
    }
    .seed-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .seed-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid #D0F205;
      border-radius: 12px;
      padding: 24px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .seed-card:hover {
      transform: translateY(-2px);
      border-color: #D0F205;
      background: rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 16px rgba(208, 242, 5, 0.25);
    }
    .seed-card h3 {
      color: #FAFAFA;
      margin-bottom: 8px;
      font-size: 1.1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .seed-card .icon {
      font-size: 1.3rem;
      color: #D0F205;
      width: 24px;
      text-align: center;
    }
    .seed-card p {
      color: #A3A3A3;
      font-size: 0.875rem;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .seed-button {
      background: rgba(255, 255, 255, 0.1);
      color: #FAFAFA;
      border: 1px solid rgba(163, 163, 163, 0.2);
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9375rem;
      font-weight: 500;
      width: 100%;
      transition: all 0.3s ease;
      font-family: 'Jura', sans-serif;
    }
    .seed-button:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(163, 163, 163, 0.3);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .seed-button:active {
      transform: translateY(0);
    }
    .seed-button:disabled {
      background: rgba(163, 163, 163, 0.1);
      color: #A3A3A3;
      border-color: rgba(163, 163, 163, 0.1);
      cursor: not-allowed;
      transform: none;
    }
    .status {
      margin-top: 12px;
      padding: 12px;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .status.success {
      background: rgba(255, 255, 255, 0.05);
      color: #A3A3A3;
      border: 1px solid rgba(163, 163, 163, 0.2);
    }
    .status.error {
      background: rgba(220, 53, 69, 0.1);
      color: #FF6B7A;
      border: 1px solid rgba(220, 53, 69, 0.2);
    }
    .status.loading {
      background: rgba(255, 255, 255, 0.05);
      color: #A3A3A3;
      border: 1px solid rgba(163, 163, 163, 0.2);
    }
    .danger-button {
      background: rgba(220, 53, 69, 0.15);
      color: #FF6B7A;
      border: 1px solid rgba(220, 53, 69, 0.3);
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9375rem;
      font-weight: 500;
      width: 100%;
      transition: all 0.3s ease;
      font-family: 'Jura', sans-serif;
    }
    .danger-button:hover {
      background: rgba(220, 53, 69, 0.25);
      border-color: rgba(220, 53, 69, 0.4);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(220, 53, 69, 0.15);
    }
    .danger-button:disabled {
      background: rgba(163, 163, 163, 0.1);
      color: #A3A3A3;
      border-color: rgba(163, 163, 163, 0.1);
      cursor: not-allowed;
      transform: none;
    }
    .danger-card {
      background: rgba(220, 53, 69, 0.05);
      border: 1px solid rgba(220, 53, 69, 0.2);
    }
    .danger-card:hover {
      border-color: rgba(220, 53, 69, 0.3);
      background: rgba(220, 53, 69, 0.08);
    }
    .danger-card h3 {
      color: #FF6B7A;
    }
    .danger-card .icon {
      color: #FF6B7A;
    }
    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
    }
    .modal-content {
      background: #272727;
      border: 1px solid rgba(163, 163, 163, 0.2);
      margin: 15% auto;
      padding: 32px;
      border-radius: 16px;
      max-width: 500px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    .modal-header {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 20px;
      color: #FAFAFA;
    }
    .modal-body {
      margin-bottom: 24px;
      color: #A3A3A3;
      line-height: 1.6;
    }
    .modal-body strong {
      color: #FAFAFA;
    }
    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    .modal-button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9375rem;
      font-weight: 600;
      font-family: 'Jura', sans-serif;
      transition: all 0.3s ease;
    }
    .modal-button.confirm {
      background: rgba(220, 53, 69, 0.2);
      color: #FF6B7A;
      border: 1px solid rgba(220, 53, 69, 0.4);
    }
    .modal-button.confirm:hover {
      background: rgba(220, 53, 69, 0.3);
      border-color: #FF6B7A;
    }
    .modal-button.cancel {
      background: rgba(163, 163, 163, 0.2);
      color: #A3A3A3;
      border: 1px solid rgba(163, 163, 163, 0.3);
    }
    .modal-button.cancel:hover {
      background: rgba(163, 163, 163, 0.3);
      color: #FAFAFA;
    }
    .modal-steps {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid rgba(163, 163, 163, 0.2);
    }
    .modal-step {
      margin-bottom: 16px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      border: 1px solid rgba(163, 163, 163, 0.1);
    }
    .modal-step-title {
      font-weight: 600;
      margin-bottom: 6px;
      color: #FAFAFA;
      font-size: 0.9375rem;
    }
    .modal-step-desc {
      font-size: 0.875rem;
      color: #A3A3A3;
    }
    .docker-controls {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 100;
    }
    .docker-button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      color: #FAFAFA;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: 'Jura', sans-serif;
    }
    .docker-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    }
    .docker-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .docker-button.stop {
      background: rgba(220, 53, 69, 0.2);
      border: 1px solid rgba(220, 53, 69, 0.4);
    }
    .docker-button.stop:hover:not(:disabled) {
      background: rgba(220, 53, 69, 0.3);
    }
    .docker-button.down {
      background: rgba(163, 163, 163, 0.2);
      border: 1px solid rgba(163, 163, 163, 0.3);
    }
    .docker-button.down:hover:not(:disabled) {
      background: rgba(163, 163, 163, 0.3);
    }
    .docker-button.start {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(163, 163, 163, 0.2);
    }
    .docker-button.start:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.15);
    }
    .loading-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(4px);
      z-index: 2000;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    }
    .loading-overlay.active {
      display: flex;
    }
    .loading-spinner {
      border: 4px solid rgba(163, 163, 163, 0.2);
      border-top: 4px solid rgba(163, 163, 163, 0.6);
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .loading-text {
      color: #FAFAFA;
      font-size: 1.2rem;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="dashboard-header">
      <div class="dashboard-header-left">
        <img src="https://tipbox.co/images/tipbox-logo-yellow.png" 
             alt="Tipbox Logo" 
             class="dashboard-header-logo" 
             onerror="this.style.display='none'">
        <h1>Tipbox Developer Console</h1>
      </div>
    </div>
    
    <div class="section">
      <h2 class="section-title">Portlar</h2>
      <div class="ports-grid">
        ${services.map(service => {
          const host = req.headers.host || 'localhost:3000';
          const [hostName] = host.split(':');
          const protocol = req.protocol || 'http';
          const baseForBackend = `${protocol}://${host}`;
          const baseForOthers = `${protocol}://${hostName}`;
          const url = service.port === 3000
            ? `${baseForBackend}${service.path || ''}`
            : `${baseForOthers}:${service.port}${service.path || ''}`;
          return `
          <div class="port-card" onclick="window.open('${url}', '_blank')">
            <div class="service-header">
              <h3>
                <i class="fas ${service.icon} icon"></i>
                ${service.name}
              </h3>
              ${service.containerName ? `
                <div class="status-indicator" data-container="${service.containerName}">
                  <span class="status-dot"></span>
                  <span class="status-label">Kontrol ediliyor...</span>
                </div>
              ` : ''}
            </div>
            <p>${service.description}</p>
            <div class="url">${url}</div>
            ${service.canControlContainer ? `
              <div class="container-actions" onclick="event.stopPropagation()">
                <button
                  class="container-button stop"
                  onclick="dockerContainerStop('${service.containerName}'); event.stopPropagation();"
                  title="${service.containerName} container\\'ını durdur"
                >
                  <i class="fas fa-stop"></i>
                  Stop
                </button>
                <button
                  class="container-button start"
                  onclick="dockerContainerStart('${service.containerName}'); event.stopPropagation();"
                  title="${service.containerName} container\\'ını başlat"
                >
                  <i class="fas fa-play"></i>
                  Start
                </button>
              </div>
            ` : ''}
          </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Database: Seed Yönetimi</h2>
      <div class="seed-grid">
        <div class="seed-card">
          <h3>
            <i class="fas fa-database icon"></i>
            Tüm Seedleri Oluştur
          </h3>
          <p><code>prisma/seed.ts</code> dosyasındaki tüm seed verilerini veritabanına yazar.</p>
          <button class="seed-button" onclick="runAllSeeds()" id="btn-seed-all">
            Seedleri Yükle
          </button>
          <div id="status-seed-all"></div>
        </div>

        <div class="seed-card danger-card">
          <h3>
            <i class="fas fa-trash-alt icon"></i>
            Tüm Seedleri Temizle
          </h3>
          <p>Veritabanındaki tüm seed verilerini temizler.</p>
          <button class="danger-button" id="btn-clear-seed">
            Seedleri Temizle
          </button>
          <div id="status-clear-seed"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Docker Control Buttons - Gizlendi -->
  <!--
  <div class="docker-controls">
    <button class="docker-button stop" onclick="dockerStop()" id="btn-docker-stop">
      ⏹️ Stop
    </button>
    <button class="docker-button down" onclick="dockerDown()" id="btn-docker-down">
      ⬇️ Down
    </button>
    <button class="docker-button start" onclick="dockerStart()" id="btn-docker-start">
      ▶️ Start
    </button>
  </div>
  -->

  <!-- Loading Overlay -->
  <div class="loading-overlay" id="loadingOverlay">
    <div class="loading-spinner"></div>
    <div class="loading-text" id="loadingText">Container'lar hazırlanıyor...</div>
  </div>

  <!-- Modal Dialog -->
  <div id="confirmModal" class="modal">
    <div class="modal-content">
      <div class="modal-header" id="modalHeader"></div>
      <div class="modal-body" id="modalBody"></div>
      <div id="modalSteps" class="modal-steps" style="display: none;"></div>
      <div class="modal-actions">
        <button class="modal-button cancel" id="cancelButton">İptal</button>
        <button class="modal-button confirm" id="confirmButton">Onayla</button>
      </div>
    </div>
  </div>

  <script>${dashboardScript}</script>
</body>
</html>
  `);
});

// Project root'u bul (compile edilmiş dosya dist/ içinde olabilir)
function getProjectRoot(): string {
  // Önce environment variable'dan kontrol et (Docker container için)
  if (process.env.PROJECT_ROOT && fs.existsSync(path.join(process.env.PROJECT_ROOT, 'package.json'))) {
    return process.env.PROJECT_ROOT;
  }
  
  // Öncelik 1: /app dizini (Docker container'da working_dir: /app olarak ayarlanmış)
  const appDir = '/app';
  const appPackageJson = path.join(appDir, 'package.json');
  if (fs.existsSync(appPackageJson)) {
    console.log('Using /app as project root (Docker container)');
    return appDir;
  }
  
  // Öncelik 2: process.cwd() kullan (çalışma dizini)
  const cwd = process.cwd();
  const cwdPackageJson = path.join(cwd, 'package.json');
  if (fs.existsSync(cwdPackageJson)) {
    console.log('Using process.cwd() as project root:', cwd);
    return cwd;
  }
  
  // Öncelik 3: __dirname'den başlayarak yukarı çık (local development için)
  let currentDir = __dirname;
  const maxDepth = 10;
  let depth = 0;
  
  while (currentDir !== path.dirname(currentDir) && depth < maxDepth) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      console.log('Project root found by traversing __dirname:', currentDir);
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
    depth++;
  }
  
  // Fallback: process.cwd() (hata olsa bile)
  console.warn('Could not find package.json, using process.cwd() as fallback');
  console.warn('__dirname:', __dirname);
  console.warn('process.cwd():', process.cwd());
  console.warn('/app exists:', fs.existsSync('/app'));
  console.warn('/app/package.json exists:', fs.existsSync('/app/package.json'));
  return process.cwd();
}

// Test verilerini temizleme endpoint'i
router.post('/clear-test-data', async (req: Request, res: Response) => {
  try {
    const projectRoot = getProjectRoot();
    console.log('Clear test data - Project root:', projectRoot);
    console.log('Clear test data - package.json exists:', fs.existsSync(path.join(projectRoot, 'package.json')));
    
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    
    const { stdout, stderr } = await execAsync(`"${npmCommand}" run db:clear:test`, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
    });

    if (stderr && !stderr.includes('warning')) {
      console.error('Clear test data stderr:', stderr);
    }

    res.json({ 
      message: 'Test verileri başarıyla temizlendi',
      output: stdout 
    });
  } catch (error: any) {
    console.error('Clear test data error:', error);
    res.status(500).json({ 
      error: error.message || 'Test verileri temizlenirken hata oluştu',
      details: error.stderr || error.stdout
    });
  }
});

// Seed verilerini temizleme endpoint'i
router.post('/clear-seed-data', async (req: Request, res: Response) => {
  try {
    const projectRoot = getProjectRoot();
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    
    const { stdout, stderr } = await execAsync(`"${npmCommand}" run db:clear:seed`, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
    });

    if (stderr && !stderr.includes('warning')) {
      console.error('Clear seed data stderr:', stderr);
    }

    res.json({ 
      message: 'Seed verileri başarıyla temizlendi',
      output: stdout 
    });
  } catch (error: any) {
    console.error('Clear seed data error:', error);
    res.status(500).json({ 
      error: error.message || 'Seed verileri temizlenirken hata oluştu',
      details: error.stderr || error.stdout
    });
  }
});

// Prisma Client generate endpoint'i
router.post('/generate-client', async (req: Request, res: Response) => {
  try {
    const projectRoot = getProjectRoot();
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    
    const { stdout, stderr } = await execAsync(`"${npmCommand}" run db:generate`, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
    });

    if (stderr && !stderr.includes('warning')) {
      console.error('Prisma generate stderr:', stderr);
    }

    res.json({ 
      message: 'Prisma Client başarıyla generate edildi',
      output: stdout 
    });
  } catch (error: any) {
    console.error('Prisma generate error:', error);
    res.status(500).json({ 
      error: error.message || 'Prisma Client generate edilirken hata oluştu',
      details: error.stderr || error.stdout
    });
  }
});

// Prisma Client generate gerekip gerekmediğini kontrol endpoint'i
router.get('/check-generate', async (req: Request, res: Response) => {
  try {
    // Basit bir kontrol - schema.prisma dosyasının son değiştirilme tarihine bak
    const projectRoot = getProjectRoot();
    const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
    const clientPath = path.join(projectRoot, 'node_modules', '.prisma', 'client', 'index.js');
    
    let needsGenerate = false;
    
    if (fs.existsSync(schemaPath) && fs.existsSync(clientPath)) {
      const schemaStats = fs.statSync(schemaPath);
      const clientStats = fs.statSync(clientPath);
      
      // Schema, client'tan daha yeni ise generate gerekir
      if (schemaStats.mtime > clientStats.mtime) {
        needsGenerate = true;
      }
    } else if (fs.existsSync(schemaPath) && !fs.existsSync(clientPath)) {
      // Client yoksa generate gerekir
      needsGenerate = true;
    }
    
    res.json({ needsGenerate });
  } catch (error: any) {
    console.error('Check generate error:', error);
    res.json({ needsGenerate: false });
  }
});

// Docker kontrol endpoint'leri
router.post('/docker/stop', async (req: Request, res: Response) => {
  try {
    const projectRoot = getProjectRoot();
    
    // Tipbox container'larını durdur
    const containerNames = [
      'tipbox_backend',
      'tipbox_postgres',
      'tipbox_redis',
      'tipbox_minio',
      'tipbox_pgadmin',
      'tipbox_prisma_studio'
    ];
    
    let stoppedCount = 0;
    const errors: string[] = [];
    
    for (const containerName of containerNames) {
      try {
        await execAsync(`docker stop ${containerName}`, {
          cwd: projectRoot,
          maxBuffer: 1024 * 1024,
          encoding: 'utf8'
        });
        stoppedCount++;
      } catch (error: any) {
        // Container yoksa veya zaten durmuşsa hata verme
        if (!error.message.includes('No such container') && !error.stderr?.includes('No such container')) {
          errors.push(`${containerName}: ${error.message}`);
        }
      }
    }

    if (errors.length > 0) {
      console.warn('Some containers could not be stopped:', errors);
    }

    res.json({ 
      message: `${stoppedCount} container durduruldu`,
      output: `Stopped ${stoppedCount} containers`
    });
  } catch (error: any) {
    console.error('Docker stop error:', error);
    res.status(500).json({ 
      error: error.message || 'Container\'lar durdurulurken hata oluştu',
      details: error.stderr || error.stdout
    });
  }
});

router.post('/docker/down', async (req: Request, res: Response) => {
  try {
    const projectRoot = getProjectRoot();
    
    // Docker compose komutunu bul
    let dockerComposeCmd = 'docker-compose';
    try {
      await execAsync(`${dockerComposeCmd} --version`, { 
        cwd: projectRoot,
        encoding: 'utf8'
      });
    } catch {
      // docker compose (boşluklu) dene
      dockerComposeCmd = 'docker compose';
      try {
        await execAsync(`${dockerComposeCmd} version`, { 
          cwd: projectRoot,
          encoding: 'utf8'
        });
      } catch {
        throw new Error('Docker Compose bulunamadı');
      }
    }
    
    const { stdout, stderr } = await execAsync(`${dockerComposeCmd} down`, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8'
    });

    if (stderr && !stderr.includes('warning') && stderr.trim().length > 0) {
      console.error('Docker down stderr:', stderr);
    }

    res.json({ 
      message: 'Container\'lar kaldırıldı',
      output: stdout 
    });
  } catch (error: any) {
    console.error('Docker down error:', error);
    res.status(500).json({ 
      error: error.message || 'Container\'lar kaldırılırken hata oluştu',
      details: error.stderr || error.stdout
    });
  }
});

router.post('/docker/start', async (req: Request, res: Response) => {
  try {
    const projectRoot = getProjectRoot();
    
    // Docker compose komutunu bul
    let dockerComposeCmd = 'docker-compose';
    try {
      await execAsync(`${dockerComposeCmd} --version`, { 
        cwd: projectRoot,
        encoding: 'utf8'
      });
    } catch {
      // docker compose (boşluklu) dene
      dockerComposeCmd = 'docker compose';
      try {
        await execAsync(`${dockerComposeCmd} version`, { 
          cwd: projectRoot,
          encoding: 'utf8'
        });
      } catch {
        throw new Error('Docker Compose bulunamadı');
      }
    }
    
    const { stdout, stderr } = await execAsync(`${dockerComposeCmd} up -d`, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8'
    });

    if (stderr && !stderr.includes('warning') && !stderr.includes('Creating') && stderr.trim().length > 0) {
      console.error('Docker start stderr:', stderr);
    }

    res.json({ 
      message: 'Container\'lar başlatıldı',
      output: stdout 
    });
  } catch (error: any) {
    console.error('Docker start error:', error);
    res.status(500).json({ 
      error: error.message || 'Container\'lar başlatılırken hata oluştu',
      details: error.stderr || error.stdout
    });
  }
});

// Tekil container start/stop endpoint'leri
router.post('/docker/container/stop', async (req: Request, res: Response) => {
  try {
    const { containerName } = req.body;
    const allowedContainers = [
      'tipbox_backend',
      'tipbox_postgres',
      'tipbox_redis',
      'tipbox_minio',
      'tipbox_pgadmin',
      'tipbox_prisma_studio'
    ];

    if (!containerName || !allowedContainers.includes(containerName)) {
      return res.status(400).json({ error: 'Geçersiz container adı' });
    }

    await execAsync(`docker stop ${containerName}`, {
      maxBuffer: 1024 * 1024,
      encoding: 'utf8'
    });

    res.json({
      message: `${containerName} durduruldu`
    });
  } catch (error: any) {
    console.error('Docker single container stop error:', error);
    res.status(500).json({
      error: error.message || 'Container durdurulurken hata oluştu',
      details: error.stderr || error.stdout
    });
  }
});

router.post('/docker/container/start', async (req: Request, res: Response) => {
  try {
    const { containerName } = req.body;
    const allowedContainers = [
      'tipbox_backend',
      'tipbox_postgres',
      'tipbox_redis',
      'tipbox_minio',
      'tipbox_pgadmin',
      'tipbox_prisma_studio'
    ];

    if (!containerName || !allowedContainers.includes(containerName)) {
      return res.status(400).json({ error: 'Geçersiz container adı' });
    }

    await execAsync(`docker start ${containerName}`, {
      maxBuffer: 1024 * 1024,
      encoding: 'utf8'
    });

    res.json({
      message: `${containerName} başlatıldı`
    });
  } catch (error: any) {
    console.error('Docker single container start error:', error);
    res.status(500).json({
      error: error.message || 'Container başlatılırken hata oluştu',
      details: error.stderr || error.stdout
    });
  }
});

router.get('/docker/status', async (req: Request, res: Response) => {
  try {
    const containerNames = [
      'tipbox_backend',
      'tipbox_postgres',
      'tipbox_redis',
      'tipbox_minio',
      'tipbox_pgadmin',
      'tipbox_prisma_studio'
    ];

    const statuses: Record<string, boolean> = {};
    let allRunning = true;

    for (const containerName of containerNames) {
      let isRunning = false;

      // 1) Önce docker CLI ile kontrol etmeyi dene (varsa)
      try {
        const result = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, {
          maxBuffer: 1024 * 1024,
          encoding: 'utf8'
        });
        isRunning = result.stdout.trim().length > 0;
      } catch (error: any) {
        // docker yoksa veya erişilemiyorsa logla ama akışı bozma
        console.warn(`docker ps kontrolü başarısız (${containerName}):`, error?.message || error);
      }

      // 2) CLI başarısızsa veya isim eşleşmiyorsa, port/health-check fallback kullan
      if (!isRunning) {
        try {
          isRunning = await checkContainerByPort(containerName);
        } catch {
          isRunning = false;
        }
      }

      statuses[containerName] = isRunning;
      if (!isRunning) {
        allRunning = false;
      }
    }

    res.json({
      allRunning,
      statuses
    });
  } catch (error: any) {
    console.error('Docker status error:', error);
    res.status(500).json({ 
      error: error.message || 'Container durumu kontrol edilirken hata oluştu'
    });
  }
});

// Seed çalıştırma endpoint'i (sadece izin verilen komutlar)
router.post('/seed', async (req: Request, res: Response) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command gerekli' });
  }

  // Sadece tanımlı script'lerin çalışmasına izin ver
  const validCommands = ['db:seed'];
  if (!validCommands.includes(command)) {
    return res.status(400).json({ error: 'Geçersiz command' });
  }

  try {
    const projectRoot = getProjectRoot();
    console.log('Seed command - Project root:', projectRoot);
    console.log('Seed command - Command:', command);
    console.log('Seed command - package.json exists:', fs.existsSync(path.join(projectRoot, 'package.json')));
    
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    
    // Önce package.json'ın varlığını kontrol et
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`package.json not found in ${projectRoot}. __dirname: ${__dirname}, process.cwd(): ${process.cwd()}`);
    }
    
    const { stdout, stderr } = await execAsync(`"${npmCommand}" run ${command}`, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
    });

    if (stderr && !stderr.includes('warning')) {
      console.error('Seed stderr:', stderr);
    }

    const seedName = seedCommands.find(s => s.command === command)?.name || command;
    res.json({ 
      message: `${seedName} başarıyla çalıştırıldı`,
      output: stdout 
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    res.status(500).json({ 
      error: error.message || 'Seed çalıştırılırken hata oluştu',
      details: error.stderr || error.stdout
    });
  }
});

export default router;

