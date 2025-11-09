import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const router = Router();

// Container port bilgileri
const services = [
  { name: 'Backend API', port: 3000, url: 'http://localhost:3000', description: 'Ana backend servisi' },
  { name: 'Swagger Docs', port: 3000, url: 'http://localhost:3000/api-docs', description: 'API dokümantasyonu', path: '/api-docs' },
  { name: 'Prisma Studio', port: 5555, url: 'http://localhost:5555', description: 'Database GUI' },
  { name: 'pgAdmin', port: 5050, url: 'http://localhost:5050', description: 'PostgreSQL yönetim arayüzü' },
  { name: 'MinIO Console', port: 9001, url: 'http://localhost:9001', description: 'MinIO object storage konsolu' },
  { name: 'MinIO API', port: 9000, url: 'http://localhost:9000', description: 'MinIO API endpoint' },
  { name: 'PostgreSQL', port: 5432, url: 'localhost:5432', description: 'PostgreSQL veritabanı' },
  { name: 'Redis', port: 6379, url: 'localhost:6379', description: 'Redis cache servisi' },
];

// Seed bilgileri
const seedCommands = [
  { name: 'Tümü', command: 'db:seed:all', description: 'Tüm seed verilerini ekle' },
  { name: 'User Seed', command: 'db:seed:user', description: 'Kullanıcı ve profil verileri' },
  { name: 'Content Seed', command: 'db:seed:content', description: 'Ürün ve içerik verileri' },
  { name: 'Feed Seed', command: 'db:seed:feed', description: 'Feed ve trending verileri' },
  { name: 'Taxonomy Seed', command: 'db:seed:taxonomy', description: 'Kategori ve taksonomi verileri' },
  { name: 'Marketplace Seed', command: 'db:seed:marketplace', description: 'Marketplace verileri' },
  { name: 'Explore Seed', command: 'db:seed:explore', description: 'Explore ve brand verileri' },
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

    async function runSeed(command, index) {
      console.log('runSeed called:', command, index);
      
      const button = document.getElementById('btn-' + index);
      const status = document.getElementById('status-' + index);
      
      if (!button || !status) {
        console.error('Button or status element not found');
        alert('Buton veya status elementi bulunamadı');
        return;
      }
      
      button.disabled = true;
      status.innerHTML = '<div class="status loading">Çalıştırılıyor...</div>';
      
      try {
        console.log('Fetching /seed with command:', command);
        const response = await fetch('/seed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command: command })
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
    window.runSeed = runSeed;
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
    
    // DOM yüklendikten sonra veya hemen çalıştır
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
      // DOM zaten yüklenmiş, hemen çalıştır
      setTimeout(setupEventListeners, 100);
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
  <title>Tipbox Docker Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      gap: 20px;
      position: relative;
    }
    h1 {
      color: white;
      text-align: left;
      margin: 0;
      font-size: 2.5em;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
      flex: 1;
      position: relative;
      z-index: 1;
    }
    .dashboard-header-image {
      height: 150px;
      width: auto;
      object-fit: contain;
      animation: slideToRight 1.2s ease-out forwards;
      position: relative;
      z-index: 2;
    }
    @keyframes slideToRight {
      0% {
        opacity: 0;
        transform: translateX(calc(-100vw + 100%));
      }
      60% {
        opacity: 1;
      }
      100% {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @media (max-width: 1200px) {
      .dashboard-header {
        flex-direction: column;
        align-items: flex-start;
      }
      .dashboard-header-image {
        height: 120px;
        width: auto;
        align-self: flex-end;
        animation: slideToRightMobile 1.2s ease-out forwards;
      }
    }
    @keyframes slideToRightMobile {
      0% {
        opacity: 0;
        transform: translateX(-200px);
      }
      60% {
        opacity: 1;
      }
      100% {
        opacity: 1;
        transform: translateX(0);
      }
    }
    .section {
      background: white;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 25px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .section-title {
      font-size: 1.5em;
      margin-bottom: 20px;
      color: #333;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    .ports-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
    }
    .port-card {
      flex: 1;
      min-width: 200px;
      background: #f8f9fa;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      padding: 20px;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    .port-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 6px 12px rgba(0,0,0,0.15);
      border-color: #667eea;
    }
    .port-card h3 {
      color: #667eea;
      margin-bottom: 10px;
      font-size: 1.1em;
    }
    .port-card p {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 10px;
    }
    .port-card .url {
      color: #667eea;
      font-weight: bold;
      word-break: break-all;
    }
    .seed-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
    }
    .seed-card {
      background: #f8f9fa;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      padding: 20px;
      transition: all 0.3s ease;
    }
    .seed-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      border-color: #28a745;
    }
    .seed-card h3 {
      color: #28a745;
      margin-bottom: 10px;
      font-size: 1.1em;
    }
    .seed-card p {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 15px;
    }
    .seed-button {
      background: #28a745;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.95em;
      font-weight: bold;
      width: 100%;
      transition: background 0.3s ease;
    }
    .seed-button:hover {
      background: #218838;
    }
    .seed-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .status {
      margin-top: 10px;
      padding: 10px;
      border-radius: 6px;
      font-size: 0.9em;
    }
    .status.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .status.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .status.loading {
      background: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
    }
    .danger-button {
      background: #dc3545;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.95em;
      font-weight: bold;
      width: 100%;
      transition: background 0.3s ease;
    }
    .danger-button:hover {
      background: #c82333;
    }
    .danger-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .danger-card {
      background: #fff5f5;
      border: 2px solid #fc8181;
    }
    .danger-card:hover {
      border-color: #dc3545;
    }
    .danger-card h3 {
      color: #dc3545;
    }
    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.5);
    }
    .modal-content {
      background-color: white;
      margin: 15% auto;
      padding: 30px;
      border-radius: 12px;
      max-width: 500px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .modal-header {
      font-size: 1.5em;
      margin-bottom: 20px;
      color: #333;
    }
    .modal-body {
      margin-bottom: 20px;
      color: #666;
      line-height: 1.6;
    }
    .modal-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .modal-button {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1em;
      font-weight: bold;
    }
    .modal-button.confirm {
      background: #dc3545;
      color: white;
    }
    .modal-button.confirm:hover {
      background: #c82333;
    }
    .modal-button.cancel {
      background: #6c757d;
      color: white;
    }
    .modal-button.cancel:hover {
      background: #5a6268;
    }
    .modal-steps {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e9ecef;
    }
    .modal-step {
      margin-bottom: 15px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 6px;
    }
    .modal-step-title {
      font-weight: bold;
      margin-bottom: 5px;
      color: #333;
    }
    .modal-step-desc {
      font-size: 0.9em;
      color: #666;
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
      font-size: 1em;
      font-weight: bold;
      color: white;
      transition: all 0.3s ease;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    }
    .docker-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0,0,0,0.3);
    }
    .docker-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .docker-button.stop {
      background: #dc3545;
    }
    .docker-button.stop:hover:not(:disabled) {
      background: #c82333;
    }
    .docker-button.down {
      background: #6c757d;
    }
    .docker-button.down:hover:not(:disabled) {
      background: #5a6268;
    }
    .docker-button.start {
      background: #28a745;
    }
    .docker-button.start:hover:not(:disabled) {
      background: #218838;
    }
    .loading-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 2000;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    }
    .loading-overlay.active {
      display: flex;
    }
    .loading-spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
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
      color: white;
      font-size: 1.2em;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="dashboard-header">
      <h1>🐳 Tipbox Docker Dashboard</h1>
      <img src="https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000000/common/f1/2025/ferrari/2025ferraricarright.webp" 
           alt="Ferrari F1 Car" 
           class="dashboard-header-image" 
           onerror="this.style.display='none'">
    </div>
    
    <div class="section">
      <h2 class="section-title">Portlar</h2>
      <div class="ports-grid">
        ${services.map(service => `
          <div class="port-card" onclick="window.open('${service.url}', '_blank')">
            <h3>${service.name}</h3>
            <p>${service.description}</p>
            <div class="url">${service.url}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Database: Seed Verileri</h2>
      <div class="seed-grid">
        ${seedCommands.map((seed, index) => `
          <div class="seed-card">
            <h3>${seed.name}</h3>
            <p>${seed.description}</p>
            <button class="seed-button" onclick="runSeed('${seed.command}', ${index})" id="btn-${index}">
              Seed Çalıştır
            </button>
            <div id="status-${index}"></div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Database: Veri Temizleme section gizlendi -->
    <!--
    <div class="section">
      <h2 class="section-title">Database: Veri Temizleme</h2>
      <div class="seed-grid">
        <div class="seed-card danger-card">
          <h3>Test Verilerini Kaldır</h3>
          <p>Test kullanıcıları ve onların verilerini kaldırır</p>
          <button class="danger-button" id="btn-clear-test">
            Test Verilerini Kaldır
          </button>
          <div id="status-clear-test"></div>
        </div>
        <div class="seed-card danger-card">
          <h3>Seed Verilerini Kaldır</h3>
          <p>Tüm seed verilerini veritabanından kaldırır</p>
          <button class="danger-button" id="btn-clear-seed">
            Seed Verilerini Kaldır
          </button>
          <div id="status-clear-seed"></div>
        </div>
      </div>
    </div>
    -->
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
      try {
        const result = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, {
          maxBuffer: 1024 * 1024,
          encoding: 'utf8'
        });
        const isRunning = result.stdout.trim().length > 0;
        statuses[containerName] = isRunning;
        if (!isRunning) {
          allRunning = false;
        }
      } catch {
        statuses[containerName] = false;
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

// Seed çalıştırma endpoint'i
router.post('/seed', async (req: Request, res: Response) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command gerekli' });
  }

  const validCommands = seedCommands.map(s => s.command);
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

