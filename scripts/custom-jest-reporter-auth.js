const fs = require('fs');
const path = require('path');

class CustomJestReporterAuth {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options || {};
    this.testResults = [];
  }

  onTestResult(test, testResult) {
    testResult.testResults.forEach((result) => {
      const testInfo = {
        title: result.title,
        status: result.status,
        duration: result.duration,
        failureMessages: result.failureMessages,
        ancestorTitles: result.ancestorTitles || [],
      };
      this.testResults.push(testInfo);
    });
  }

  onRunComplete(contexts, results) {
    const reportData = {
      summary: {
        totalTests: results.numTotalTests,
        passedTests: results.numPassedTests,
        failedTests: results.numFailedTests,
        duration: results.startTime ? Date.now() - results.startTime : 0,
      },
      tests: this.testResults,
    };

    const outputDir = path.join(process.cwd(), 'test-results');
    const detailedPath = path.join(outputDir, 'detailed-test-report.html');
    const authOnlyPath = path.join(outputDir, 'auth-report.html');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Build enhanced Auth dashboard grouped by endpoint with service mapping
    const endpointMeta = {
      '/auth/login': {
        summary: 'Kullanıcı girişi',
        services: [
          { name: 'AuthService.authenticate(email, password)', desc: 'Kimlik doğrulama ve kullanıcıyı döner' },
          { name: 'AuthService.generateToken(user)', desc: 'JWT access token üretir' },
          { name: 'AuthService.generateRefreshToken(user)', desc: 'Refresh token üretir' },
          { name: 'ProfilePrismaRepository.findByUserId(userId)', desc: 'Profil bilgilerini getirir' },
          { name: 'UserAvatarPrismaRepository.findActiveByUserId(userId)', desc: 'Aktif avatar URL getirir' },
          { name: 'AuthService.trackDevice(userId, ua, ip)', desc: 'Cihaz bilgisini izler' },
        ],
      },
      '/auth/register': {
        summary: 'Yeni kullanıcı kaydı',
        services: [
          { name: 'AuthService.register(email, password, name)', desc: 'Kullanıcı oluşturur' },
          { name: 'AuthService.generateToken(user)', desc: 'JWT access token üretir' },
        ],
      },
      '/auth/signup': {
        summary: 'Manuel kullanıcı kaydı (email doğrulamalı)',
        services: [
          { name: 'AuthService.signup(email, password)', desc: 'Doğrulama kodu üretir/gönderir' },
        ],
      },
      '/auth/verify-email': {
        summary: 'Email doğrulama',
        services: [
          { name: 'AuthService.verifyEmail(email, code)', desc: 'Kod doğrulama ve token üretimi' },
        ],
      },
      '/auth/me': {
        summary: 'Giriş yapan kullanıcının bilgileri',
        services: [
          { name: 'AuthService.getUserFromToken(token)', desc: 'Token’dan kullanıcı çıkarır' },
        ],
      },
      '/auth/forgot-password': {
        summary: 'Şifre sıfırlama kodu gönder',
        services: [
          { name: 'AuthService.forgotPassword(mail)', desc: 'Sıfırlama kodu oluştur/gönder' },
        ],
      },
      '/auth/verify-reset-code': {
        summary: 'Sıfırlama kodu doğrula',
        services: [
          { name: 'AuthService.verifyResetCode(mail, code)', desc: 'Kod doğrulama' },
        ],
      },
      '/auth/reset-password': {
        summary: 'Yeni şifre belirle',
        services: [
          { name: 'AuthService.resetPassword(email, password)', desc: 'Şifre güncelleme' },
        ],
      },
    };

    // Extract endpoint/method from tests and group
    const endpointGroups = {};
    for (const t of reportData.tests) {
      const pathMatch = (t.title.match(/(\/[^\s]+)/) || [])[1] || (t.ancestorTitles||[]).join(' ').match(/(\/[^\s]+)/)?.[1] || 'unknown';
      if (!endpointGroups[pathMatch]) endpointGroups[pathMatch] = [];
      endpointGroups[pathMatch].push(t);
    }

    const dashboard = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Auth Report</title><style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:24px;background:#f7f7fb;color:#111}a{color:inherit;text-decoration:none}.wrap{max-width:1100px;margin:0 auto}.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.kpi{display:flex;gap:12px}.kpi span{background:#eef2ff;padding:8px 12px;border-radius:8px;font-size:13px;border:1px solid #e5e7eb}.card{background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;margin:12px 0;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.06)}.card .title{padding:14px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}.title h3{margin:0;font-size:15px}.status{font-size:12px;border-radius:999px;padding:2px 8px;border:1px solid #e5e7eb;background:#f3f4f6;color:#111}.ok{background:#dcfce7;border-color:#bbf7d0;color:#065f46}.fail{background:#fee2e2;border-color:#fecaca;color:#991b1b}.body{display:none;padding:0 16px 14px}.row{display:flex;justify-content:space-between;align-items:center;border-top:1px dashed #e5e7eb;padding:10px 0}.svc{font-family:Consolas,monospace;font-size:12px;color:#1d4ed8}.desc{font-size:12px;color:#374151}.meta{font-size:12px;color:#6b7280}</style><script>function tg(i){const b=document.getElementById('b'+i);b.style.display=b.style.display==='block'?'none':'block';const t=document.getElementById('t'+i);t.innerText=b.style.display==='block'?'▼':'►'}</script></head><body><div class="wrap"><div class="head"><h1>🔐 Auth Test Report</h1><div class="kpi"><span>Toplam: ${reportData.summary.totalTests}</span><span>Başarılı: ${reportData.summary.passedTests}</span><span>Başarısız: ${reportData.summary.failedTests}</span><span>Süre: ${(reportData.summary.duration/1000).toFixed(2)}s</span></div></div>
${Object.keys(endpointGroups).sort().map((ep,idx)=>{
 const tests = endpointGroups[ep];
 const pass = tests.every(t=>t.status==='passed');
 const meta = endpointMeta[ep]||{summary:'',services:[]};
 return `<div class=\"card\"><div class=\"title\" onclick=\"tg(${idx})\"><h3>${ep} — <span class=\"meta\">${meta.summary||''}</span></h3><span id=\"t${idx}\">►</span><span class=\"status ${pass?'ok':'fail'}\">Response</span></div><div class=\"body\" id=\"b${idx}\"><div class=\"row\"><div class=\"desc\">Bu endpoint ile ilgili testler:</div><div class=\"meta\">${tests.length} test</div></div>${tests.map(t=>`<div class=\"row\"><div>${[...(t.ancestorTitles||[]),t.title].join(' > ')}</div><div class=\"status ${t.status==='passed'?'ok':'fail'}\">Response</div></div>`).join('')}<div class=\"row\"><div class=\"desc\">Kullanılan servis fonksiyonları:</div><div class=\"meta\"></div></div>${(meta.services||[]).map(s=>`<div class=\"row\"><div class=\"svc\">${s.name}</div><div class=\"desc\">${s.desc}</div></div>`).join('')||`<div class=\"row\"><div class=\"meta\">Servis bilgisi yapılandırılmadı</div></div>`}</div></div>`;
}).join('')}
</div></body></html>`;

    // Write files
    fs.writeFileSync(detailedPath, dashboard, 'utf8'); // keep detailed path showing enhanced too
    fs.writeFileSync(authOnlyPath, dashboard, 'utf8'); // main entry at /auth-report.html
    console.log(`\n📊 Auth detay raporu: ${detailedPath}`);
    console.log(`📄 Auth raporu: ${authOnlyPath}`);
  }
}

module.exports = CustomJestReporterAuth;


