/**
 * Test logger utility - Test adımlarını ve servis çağrılarını loglar
 */

interface TestStep {
  name: string;
  status: 'passed' | 'failed' | 'pending';
  duration?: number;
  message?: string;
  timestamp: number;
}

interface ServiceCall {
  method: string;
  endpoint: string;
  statusCode?: number;
  duration?: number;
  requestBody?: any;
  responseBody?: any;
  timestamp: number;
}

interface Assertion {
  type: string;
  status: 'passed' | 'failed';
  message: string;
  expected?: any;
  received?: any;
  timestamp: number;
}

class TestLogger {
  private static instance: TestLogger;
  private currentTestTitle: string = '';
  private steps: Map<string, TestStep[]> = new Map();
  private services: Map<string, ServiceCall[]> = new Map();
  private assertions: Map<string, Assertion[]> = new Map();

  static getInstance(): TestLogger {
    if (!TestLogger.instance) {
      TestLogger.instance = new TestLogger();
    }
    return TestLogger.instance;
  }

  setCurrentTest(title: string) {
    this.currentTestTitle = title;
    if (!this.steps.has(title)) {
      this.steps.set(title, []);
      this.services.set(title, []);
      this.assertions.set(title, []);
    }
  }

  logStep(name: string, status: 'passed' | 'failed' | 'pending', message?: string, duration?: number) {
    if (!this.currentTestTitle) return;
    
    const step: TestStep = {
      name,
      status,
      message,
      duration,
      timestamp: Date.now(),
    };
    
    const steps = this.steps.get(this.currentTestTitle) || [];
    steps.push(step);
    this.steps.set(this.currentTestTitle, steps);
  }

  logServiceCall(method: string, endpoint: string, statusCode?: number, duration?: number, requestBody?: any, responseBody?: any) {
    if (!this.currentTestTitle) return;
    
    const serviceCall: ServiceCall = {
      method,
      endpoint,
      statusCode,
      duration,
      requestBody,
      responseBody,
      timestamp: Date.now(),
    };
    
    const services = this.services.get(this.currentTestTitle) || [];
    services.push(serviceCall);
    this.services.set(this.currentTestTitle, services);
  }

  logAssertion(type: string, status: 'passed' | 'failed', message: string, expected?: any, received?: any) {
    if (!this.currentTestTitle) return;
    
    const assertion: Assertion = {
      type,
      status,
      message,
      expected,
      received,
      timestamp: Date.now(),
    };
    
    const assertions = this.assertions.get(this.currentTestTitle) || [];
    assertions.push(assertion);
    this.assertions.set(this.currentTestTitle, assertions);
  }

  getTestData(testTitle: string) {
    return {
      steps: this.steps.get(testTitle) || [],
      services: this.services.get(testTitle) || [],
      assertions: this.assertions.get(testTitle) || [],
    };
  }

  getAllData() {
    const allData: Record<string, any> = {};
    
    this.steps.forEach((_, title) => {
      allData[title] = this.getTestData(title);
    });
    
    return allData;
  }

  clear() {
    this.steps.clear();
    this.services.clear();
    this.assertions.clear();
    this.currentTestTitle = '';
  }
}

export const testLogger = TestLogger.getInstance();










