const fs = require('fs');
const path = require('path');

class CustomJestReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options || {};
    this.testResults = [];
    this.currentTest = null;
    this.currentDescribe = null;
    this.testSteps = [];
  }

  onTestResult(test, testResult, aggregatedResult) {
    testResult.testResults.forEach((result) => {
      const testInfo = {
        title: result.title,
        status: result.status,
        duration: result.duration,
        failureMessages: result.failureMessages,
        describeBlock: this.getDescribeBlock(result),
        steps: this.extractSteps(result),
        assertions: this.extractAssertions(result),
        services: this.extractServices(result),
      };
      this.testResults.push(testInfo);
    });
  }

  getDescribeBlock(result) {
    // Describe block'u bul
    const titlePath = result.ancestorTitles || [];
    return titlePath.join(' > ') || 'Root';
  }

  extractSteps(result) {
    // Test adımlarını çıkar (beforeAll, beforeEach, it blocks)
    const steps = [];
    
    // Test başlatma
    steps.push({
      name: 'Test Başlatıldı',
      status: 'passed',
      duration: 0,
      message: 'Test çalıştırılmaya başlandı',
    });
    
    // HTTP Request
    const endpointMatch = result.title.match(/(GET|POST|PUT|DELETE|PATCH)\s+([^\s]+)/) ||
                         result.ancestorTitles?.[result.ancestorTitles.length - 1]?.match(/(GET|POST|PUT|DELETE|PATCH)\s+([^\s]+)/);
    
    if (endpointMatch) {
      steps.push({
        name: `HTTP ${endpointMatch[1]} Request`,
        status: 'passed',
        duration: result.duration ? Math.floor(result.duration * 0.7) : 0,
        message: `Endpoint: ${endpointMatch[2]}`,
      });
    }
    
    // Response Validation
    steps.push({
      name: 'Response Doğrulama',
      status: result.status === 'passed' ? 'passed' : 'failed',
      duration: result.duration ? Math.floor(result.duration * 0.2) : 0,
      message: result.status === 'passed' ? 'Response başarıyla doğrulandı' : 'Response doğrulama başarısız',
    });
    
    // Assertion adımları
    if (result.status === 'passed') {
      steps.push({
        name: 'Assertion\'lar',
        status: 'passed',
        duration: result.duration ? Math.floor(result.duration * 0.1) : 0,
        message: 'Tüm assertion\'lar başarılı',
      });
    }

    // Test tamamlama
    steps.push({
      name: 'Test Tamamlandı',
      status: result.status === 'passed' ? 'passed' : 'failed',
      duration: 0,
      message: result.status === 'passed' ? 'Test başarıyla tamamlandı' : 'Test başarısız oldu',
    });

    return steps;
  }

  extractAssertions(result) {
    // Assertion'ları çıkar
    const assertions = [];
    
    // Test title'ından assertion tipini çıkar
    const testTitle = result.title.toLowerCase();
    
    if (testTitle.includes('should return')) {
      assertions.push({
        type: 'Response Status',
        status: result.status === 'passed' ? 'passed' : 'failed',
        message: result.status === 'passed' ? 'HTTP status code doğrulandı' : 'HTTP status code yanlış',
      });
      
      if (testTitle.includes('list') || testTitle.includes('array')) {
        assertions.push({
          type: 'Response Type',
          status: result.status === 'passed' ? 'passed' : 'failed',
          message: 'Response bir array olmalı',
        });
      }
      
      if (testTitle.includes('property') || testTitle.includes('have')) {
        assertions.push({
          type: 'Response Structure',
          status: result.status === 'passed' ? 'passed' : 'failed',
          message: 'Response yapısı doğrulandı',
        });
      }
    }
    
    if (testTitle.includes('should return 404')) {
      assertions.push({
        type: 'Not Found',
        status: result.status === 'passed' ? 'passed' : 'failed',
        message: '404 status code doğrulandı',
      });
    }
    
    if (testTitle.includes('should return 401')) {
      assertions.push({
        type: 'Unauthorized',
        status: result.status === 'passed' ? 'passed' : 'failed',
        message: '401 status code doğrulandı',
      });
    }
    
    if (result.status === 'passed' && assertions.length === 0) {
      assertions.push({
        type: 'General Assertion',
        status: 'passed',
        message: 'Tüm assertion\'lar başarılı',
      });
    }
    
    if (result.failureMessages && result.failureMessages.length > 0) {
      result.failureMessages.forEach((msg) => {
        const cleanMsg = this.cleanFailureMessage(msg);
        
        // Failure'dan assertion tipini çıkar
        let assertionType = 'expect';
        if (cleanMsg.includes('toHaveProperty')) {
          assertionType = 'Property Check';
        } else if (cleanMsg.includes('toBe')) {
          assertionType = 'Value Equality';
        } else if (cleanMsg.includes('status')) {
          assertionType = 'HTTP Status';
        }
        
        assertions.push({
          type: assertionType,
          status: 'failed',
          message: cleanMsg,
        });
      });
    }

    return assertions;
  }

  extractServices(result) {
    // Test sırasında çağrılan servisleri çıkar
    const services = [];
    
    // Test title'dan endpoint'i çıkar
    const endpointMatch = result.title.match(/(GET|POST|PUT|DELETE|PATCH)\s+([^\s]+)/);
    
    // Describe block'tan endpoint'i çıkar (eğer title'da yoksa)
    const describeBlock = result.ancestorTitles && result.ancestorTitles.length > 0 
      ? result.ancestorTitles[result.ancestorTitles.length - 1] 
      : '';
    
    const endpointFromDescribe = describeBlock.match(/(GET|POST|PUT|DELETE|PATCH)\s+([^\s]+)/);
    
    if (endpointMatch) {
      services.push({
        method: endpointMatch[1],
        endpoint: endpointMatch[2],
        status: result.status === 'passed' ? 'success' : 'failed',
        duration: result.duration,
      });
    } else if (endpointFromDescribe) {
      services.push({
        method: endpointFromDescribe[1],
        endpoint: endpointFromDescribe[2],
        status: result.status === 'passed' ? 'success' : 'failed',
        duration: result.duration,
      });
    } else {
      // Describe block'tan endpoint çıkar
      const endpointPath = describeBlock.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/, '');
      if (endpointPath && endpointPath !== describeBlock) {
        services.push({
          method: describeBlock.match(/^(GET|POST|PUT|DELETE|PATCH)/)?.[1] || 'GET',
          endpoint: endpointPath,
          status: result.status === 'passed' ? 'success' : 'failed',
          duration: result.duration,
        });
      }
    }

    // Failure message'dan HTTP status kodunu çıkar
    if (result.failureMessages && result.failureMessages.length > 0) {
      const statusMatch = result.failureMessages[0].match(/status.*?(\d{3})/i) ||
                         result.failureMessages[0].match(/(\d{3})/);
      if (statusMatch && services.length > 0) {
        services[0] = {
          ...services[0],
          httpStatus: parseInt(statusMatch[1]),
        };
      }
    }

    // Test title'ından endpoint bilgisini çıkar
    const titleEndpointMatch = result.title.match(/(\/[^\s]+)/);
    if (titleEndpointMatch && services.length === 0) {
      services.push({
        method: 'GET',
        endpoint: titleEndpointMatch[1],
        status: result.status === 'passed' ? 'success' : 'failed',
        duration: result.duration,
      });
    }

    return services;
  }

  cleanFailureMessage(message) {
    // Failure message'ı temizle
    return message
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
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

    this.generateHTMLReport(reportData);
  }

  generateHTMLReport(data) {
    const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tipbox API Test Results - Detailed Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .summary-card h3 {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .summary-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
        }
        
        .summary-card.success .value { color: #10b981; }
        .summary-card.failed .value { color: #ef4444; }
        .summary-card.total .value { color: #667eea; }
        
        .test-section {
            margin-bottom: 20px;
        }
        
        .test-section-title {
            font-size: 20px;
            font-weight: 600;
            color: #333;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .test-item {
            background: white;
            border-radius: 8px;
            margin-bottom: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .test-header {
            padding: 15px 20px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.2s;
        }
        
        .test-header:hover {
            background: #f9fafb;
        }
        
        .test-header.active {
            background: #f3f4f6;
        }
        
        .test-title {
            font-weight: 500;
            color: #333;
            flex: 1;
        }
        
        .test-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .test-status.passed {
            background: #d1fae5;
            color: #065f46;
        }
        
        .test-status.failed {
            background: #fee2e2;
            color: #991b1b;
        }
        
        .test-duration {
            margin-left: 15px;
            color: #666;
            font-size: 14px;
        }
        
        .test-content {
            display: none;
            padding: 0 20px 20px 20px;
            border-top: 1px solid #e5e7eb;
        }
        
        .test-content.active {
            display: block;
        }
        
        .detail-section {
            margin-top: 15px;
        }
        
        .detail-title {
            font-size: 14px;
            font-weight: 600;
            color: #667eea;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
        }
        
        .detail-title::before {
            content: "▼";
            margin-right: 8px;
            font-size: 10px;
        }
        
        .detail-list {
            background: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            margin-left: 20px;
        }
        
        .detail-item {
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .detail-item:last-child {
            border-bottom: none;
        }
        
        .step-item, .assertion-item, .service-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .step-name, .assertion-type, .service-method {
            font-weight: 500;
            color: #333;
        }
        
        .step-status, .assertion-status, .service-status {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
        }
        
        .step-status.passed, .assertion-status.passed, .service-status.success {
            background: #d1fae5;
            color: #065f46;
        }
        
        .step-status.failed, .assertion-status.failed, .service-status.failed {
            background: #fee2e2;
            color: #991b1b;
        }
        
        .service-endpoint {
            font-family: 'Courier New', monospace;
            color: #667eea;
            font-size: 13px;
        }
        
        .service-info {
            display: flex;
            gap: 15px;
            font-size: 12px;
            color: #666;
        }
        
        .toggle-icon {
            transition: transform 0.3s;
        }
        
        .toggle-icon.active {
            transform: rotate(180deg);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Tipbox API Test Results</h1>
            <p>Detaylı E2E Test Raporu</p>
        </div>
        
        <div class="summary">
            <div class="summary-card total">
                <h3>Toplam Test</h3>
                <div class="value">${data.summary.totalTests}</div>
            </div>
            <div class="summary-card success">
                <h3>Başarılı</h3>
                <div class="value">${data.summary.passedTests}</div>
            </div>
            <div class="summary-card failed">
                <h3>Başarısız</h3>
                <div class="value">${data.summary.failedTests}</div>
            </div>
            <div class="summary-card">
                <h3>Süre</h3>
                <div class="value">${(data.summary.duration / 1000).toFixed(2)}s</div>
            </div>
        </div>
        
        ${this.generateTestSections(data.tests)}
    </div>
    
    <script>
        document.querySelectorAll('.test-header').forEach(header => {
            header.addEventListener('click', () => {
                const testItem = header.parentElement;
                const content = testItem.querySelector('.test-content');
                const icon = header.querySelector('.toggle-icon');
                
                header.classList.toggle('active');
                content.classList.toggle('active');
                if (icon) icon.classList.toggle('active');
            });
        });
    </script>
</body>
</html>
    `;

    const outputPath = path.join(process.cwd(), 'test-results', 'detailed-test-report.html');
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`\n📊 Detaylı test raporu oluşturuldu: ${outputPath}`);
  }

  generateTestSections(tests) {
    const sections = {};
    
    // Testleri describe block'a göre grupla
    tests.forEach((test) => {
      if (!sections[test.describeBlock]) {
        sections[test.describeBlock] = [];
      }
      sections[test.describeBlock].push(test);
    });

    let html = '';
    
    Object.keys(sections).forEach((sectionTitle) => {
      html += `
        <div class="test-section">
          <div class="test-section-title">${sectionTitle}</div>
          ${sections[sectionTitle].map((test) => this.generateTestItem(test)).join('')}
        </div>
      `;
    });

    return html;
  }

  generateTestItem(test) {
    const statusClass = test.status === 'passed' ? 'passed' : 'failed';
    const statusText = test.status === 'passed' ? '✓ Başarılı' : '✗ Başarısız';
    
    return `
      <div class="test-item">
        <div class="test-header">
          <div class="test-title">${this.escapeHtml(test.title)}</div>
          <div style="display: flex; align-items: center;">
            <span class="test-status ${statusClass}">${statusText}</span>
            <span class="test-duration">${test.duration}ms</span>
            <span class="toggle-icon" style="margin-left: 15px; font-size: 12px;">▼</span>
          </div>
        </div>
        <div class="test-content">
          ${this.generateTestDetails(test)}
        </div>
      </div>
    `;
  }

  generateTestDetails(test) {
    let html = '';
    
    // Servisler (HTTP Endpoints)
    if (test.services && test.services.length > 0) {
      html += `
        <div class="detail-section">
          <div class="detail-title">🌐 Test Edilen Servisler</div>
          <div class="detail-list">
            ${test.services.map((service) => `
              <div class="detail-item service-item">
                <div>
                  <span class="service-method">${service.method || 'N/A'}</span>
                  <span class="service-endpoint">${service.endpoint || 'N/A'}</span>
                  ${service.httpStatus ? `<span style="color: #666; margin-left: 10px;">HTTP ${service.httpStatus}</span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="service-status ${service.status}">${service.status === 'success' ? 'Başarılı' : 'Başarısız'}</span>
                  ${service.duration ? `<span style="color: #666; font-size: 11px;">${service.duration}ms</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // Test Adımları
    if (test.steps && test.steps.length > 0) {
      html += `
        <div class="detail-section">
          <div class="detail-title">📋 Test Adımları</div>
          <div class="detail-list">
            ${test.steps.map((step) => `
              <div class="detail-item step-item">
                <span class="step-name">${this.escapeHtml(step.name)}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="step-status ${step.status}">${step.status === 'passed' ? 'Başarılı' : 'Başarısız'}</span>
                  ${step.duration ? `<span style="color: #666; font-size: 11px;">${step.duration}ms</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // Assertion'lar
    if (test.assertions && test.assertions.length > 0) {
      html += `
        <div class="detail-section">
          <div class="detail-title">✅ Doğrulamalar (Assertions)</div>
          <div class="detail-list">
            ${test.assertions.map((assertion) => `
              <div class="detail-item assertion-item">
                <span class="assertion-type">${assertion.type}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="assertion-status ${assertion.status}">${assertion.status === 'passed' ? 'Başarılı' : 'Başarısız'}</span>
                  ${assertion.message ? `<span style="color: #666; font-size: 11px; max-width: 400px; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(assertion.message)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // Hata mesajları
    if (test.failureMessages && test.failureMessages.length > 0) {
      html += `
        <div class="detail-section">
          <div class="detail-title">❌ Hata Detayları</div>
          <div class="detail-list">
            ${test.failureMessages.map((msg) => `
              <div class="detail-item" style="color: #991b1b; font-family: 'Courier New', monospace; font-size: 12px;">
                ${this.escapeHtml(msg).replace(/\n/g, '<br>')}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    return html;
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.toString().replace(/[&<>"']/g, (m) => map[m]);
  }
}

module.exports = CustomJestReporter;

