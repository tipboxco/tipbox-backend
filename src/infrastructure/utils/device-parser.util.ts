/**
 * User-Agent string'inden device bilgilerini parse eder
 */
export class DeviceParser {
  /**
   * User-Agent'tan device name oluşturur
   * Örnek: "Chrome on macOS", "Safari on iOS", "Firefox on Windows"
   */
  static parseDeviceName(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    // Browser tespiti
    let browser = 'Unknown Browser';
    if (ua.includes('chrome') && !ua.includes('edg')) {
      browser = 'Chrome';
    } else if (ua.includes('firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'Safari';
    } else if (ua.includes('edg')) {
      browser = 'Edge';
    } else if (ua.includes('opera')) {
      browser = 'Opera';
    } else if (ua.includes('brave')) {
      browser = 'Brave';
    }

    // OS tespiti
    let os = 'Unknown OS';
    if (ua.includes('windows')) {
      os = 'Windows';
    } else if (ua.includes('macintosh') || ua.includes('mac os')) {
      os = 'macOS';
    } else if (ua.includes('linux')) {
      os = 'Linux';
    } else if (ua.includes('android')) {
      os = 'Android';
    } else if (ua.includes('iphone')) {
      os = 'iOS (iPhone)';
    } else if (ua.includes('ipad')) {
      os = 'iOS (iPad)';
    }

    return `${browser} on ${os}`;
  }

  /**
   * User-Agent'tan browser ve OS bilgilerini ayrı ayrı alır
   */
  static parseBrowserAndOS(userAgent: string): { browser: string; os: string } {
    const ua = userAgent.toLowerCase();

    let browser = 'Unknown';
    if (ua.includes('chrome') && !ua.includes('edg')) {
      browser = 'Chrome';
    } else if (ua.includes('firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'Safari';
    } else if (ua.includes('edg')) {
      browser = 'Edge';
    } else if (ua.includes('opera')) {
      browser = 'Opera';
    } else if (ua.includes('brave')) {
      browser = 'Brave';
    }

    let os = 'Unknown';
    if (ua.includes('windows')) {
      os = 'Windows';
    } else if (ua.includes('macintosh') || ua.includes('mac os')) {
      os = 'macOS';
    } else if (ua.includes('linux')) {
      os = 'Linux';
    } else if (ua.includes('android')) {
      os = 'Android';
    } else if (ua.includes('iphone')) {
      os = 'iOS';
    } else if (ua.includes('ipad')) {
      os = 'iOS';
    }

    return { browser, os };
  }

  /**
   * IP adresinden location almak için (gelecekte API entegrasyonu yapılabilir)
   * Şimdilik null döner, frontend'den de gelebilir
   */
  static async getLocationFromIP(ipAddress: string): Promise<string | null> {
    // TODO: IP geolocation API entegrasyonu yapılabilir (ör: ipapi.co, ip-api.com)
    // Şimdilik null döndürüyoruz
    return null;
  }
}

