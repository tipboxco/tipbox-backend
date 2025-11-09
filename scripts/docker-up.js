const { execSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');

/**
 * Docker compose up komutunu çalıştırır ve backend hazır olunca tarayıcıyı açar
 */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function getDockerComposeCommand() {
  // Önce docker-compose (tireli) komutunu dene
  try {
    execSync('docker-compose --version', { stdio: 'ignore' });
    return 'docker-compose';
  } catch (error) {
    // Eğer yoksa docker compose (boşluklu) komutunu kullan
    try {
      execSync('docker compose version', { stdio: 'ignore' });
      return 'docker compose';
    } catch (err) {
      throw new Error('Docker Compose bulunamadı! Lütfen Docker Compose\'u yükleyin.');
    }
  }
}

async function openBrowser(url) {
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = `start ${url}`;
  } else if (platform === 'darwin') {
    command = `open ${url}`;
  } else {
    command = `xdg-open ${url}`;
  }
  
  try {
    execSync(command, { stdio: 'ignore' });
  } catch (error) {
    // Tarayıcı açılamazsa sessizce devam et
  }
}

function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000', { timeout: 2000 }, (res) => {
      // Herhangi bir HTTP response alırsak backend hazır demektir
      resolve(true);
      res.resume(); // Response'u tüket
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForBackendAndOpenBrowser() {
  // Backend'in hazır olmasını bekle
  const maxAttempts = 60; // 60 deneme (60 saniye)
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const backendReady = await checkBackendHealth();
    
    if (backendReady) {
      // Backend hazır, 3 saniye bekle ve tarayıcıyı aç
      await sleep(3000);
      openBrowser('http://localhost:3000');
      return;
    }
    
    // 1 saniye bekle ve tekrar dene
    await sleep(1000);
    attempts++;
  }
  
  // Backend hazır olmadıysa yine de tarayıcıyı aç (belki geç başlayacak)
  openBrowser('http://localhost:3000');
}

// Docker compose up komutunu çalıştır
function dockerComposeUp(detached = false) {
  const dockerComposeCmd = getDockerComposeCommand();
  const args = detached ? ['up', '-d'] : ['up'];
  
  // Docker compose komutunu ve argümanlarını ayrı ayrı hazırla
  const commandParts = dockerComposeCmd.split(' ');
  const allArgs = [...commandParts.slice(1), ...args];
  const command = commandParts[0];
  
  const dockerCompose = spawn(command, allArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });

  dockerCompose.on('error', (error) => {
    console.error('❌ Docker compose hatası:', error.message);
    process.exit(1);
  });

  if (detached) {
    dockerCompose.on('close', (code) => {
      if (code === 0) {
        // Container'lar başladıktan sonra backend'i bekle ve tarayıcıyı aç
        waitForBackendAndOpenBrowser().catch(console.error);
      } else {
        console.error(`❌ Docker compose çıkış kodu: ${code}`);
        process.exit(code);
      }
    });
  } else {
    // Foreground modunda, backend'i bekle ve tarayıcıyı aç
    setTimeout(() => {
      waitForBackendAndOpenBrowser().catch(console.error);
    }, 5000);
  }

  return dockerCompose;
}

// Docker compose down komutunu çalıştır
function dockerComposeDown() {
  const dockerComposeCmd = getDockerComposeCommand();
  const commandParts = dockerComposeCmd.split(' ');
  const allArgs = [...commandParts.slice(1), 'down'];
  const command = commandParts[0];
  
  const dockerCompose = spawn(command, allArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });

  dockerCompose.on('error', (error) => {
    console.error('❌ Docker compose hatası:', error.message);
    process.exit(1);
  });

  dockerCompose.on('close', (code) => {
    process.exit(code || 0);
  });
}

// Docker compose logs komutunu çalıştır
function dockerComposeLogs() {
  const dockerComposeCmd = getDockerComposeCommand();
  const commandParts = dockerComposeCmd.split(' ');
  const allArgs = [...commandParts.slice(1), 'logs', '-f'];
  const command = commandParts[0];
  
  const dockerCompose = spawn(command, allArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });

  dockerCompose.on('error', (error) => {
    console.error('❌ Docker compose hatası:', error.message);
    process.exit(1);
  });
}

// Docker compose start komutunu çalıştır
function dockerComposeStart() {
  const dockerComposeCmd = getDockerComposeCommand();
  const commandParts = dockerComposeCmd.split(' ');
  const allArgs = [...commandParts.slice(1), 'start'];
  const command = commandParts[0];
  
  console.log('🚀 Container\'lar başlatılıyor...');
  
  const dockerCompose = spawn(command, allArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });

  dockerCompose.on('error', (error) => {
    console.error('❌ Docker compose hatası:', error.message);
    process.exit(1);
  });

  dockerCompose.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Container\'lar başlatıldı, backend hazır olana kadar bekleniyor...');
      // Container'lar başladıktan sonra backend'i bekle ve tarayıcıyı aç
      waitForBackendAndOpenBrowser().catch(console.error);
    } else {
      console.error(`❌ Docker compose çıkış kodu: ${code}`);
      process.exit(code);
    }
  });
}

// Script çalıştırıldığında
if (require.main === module) {
  const args = process.argv.slice(2);
  const detached = args.includes('--detached') || args.includes('-d');
  
  if (args.includes('--ports-only') || args.includes('-p')) {
    // Port bilgilerini göster (eski fonksiyon)
    waitForBackendAndOpenBrowser().catch(console.error);
  } else if (args.includes('--down')) {
    // Docker compose down
    dockerComposeDown();
  } else if (args.includes('--logs')) {
    // Docker compose logs
    dockerComposeLogs();
  } else if (args.includes('--start')) {
    // Docker compose start
    dockerComposeStart();
  } else {
    // Docker compose up'ı çalıştır (foreground mode)
    dockerComposeUp(detached);
  }
}

module.exports = { dockerComposeUp, dockerComposeStart, waitForBackendAndOpenBrowser };

