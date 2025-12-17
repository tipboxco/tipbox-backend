/**
 * Basit progress bar utility
 * Terminal'de ilerleme çubuğu gösterir
 * Progress bar her zaman terminal'in en altında sabit kalır
 */

export class ProgressBar {
  private total: number
  private current: number
  private barLength: number
  private currentStep: string
  private isInitialized: boolean = false
  private originalStdoutWrite: typeof process.stdout.write
  private originalConsoleLog: typeof console.log
  private originalConsoleError: typeof console.error

  constructor(total: number, barLength: number = 40) {
    this.total = total
    this.current = 0
    this.barLength = barLength
    this.currentStep = ''
    
    // Orijinal fonksiyonları sakla
    this.originalStdoutWrite = process.stdout.write.bind(process.stdout)
    this.originalConsoleLog = console.log.bind(console)
    this.originalConsoleError = console.error.bind(console)
    
    // Console.log ve console.error'ı intercept et
    this.setupConsoleIntercept()
    
    // İlk render
    this.render()
  }

  /**
   * Console.log ve console.error'ı intercept et
   * Loglar yazıldıktan sonra progress bar'ı tekrar render et
   */
  private setupConsoleIntercept(): void {
    const self = this
    
    // console.log'u override et
    console.log = (...args: any[]) => {
      // Progress bar'ı geçici olarak temizle
      if (self.isInitialized) {
        process.stdout.write(`\x1b[1A\x1b[K`)
      }
      
      // Log'u yaz
      self.originalConsoleLog(...args)
      
      // Progress bar'ı tekrar render et
      if (self.isInitialized) {
        self.render()
      }
    }
    
    // console.error'ı override et
    console.error = (...args: any[]) => {
      // Progress bar'ı geçici olarak temizle
      if (self.isInitialized) {
        process.stdout.write(`\x1b[1A\x1b[K`)
      }
      
      // Error'ı yaz
      self.originalConsoleError(...args)
      
      // Progress bar'ı tekrar render et
      if (self.isInitialized) {
        self.render()
      }
    }
  }

  /**
   * Console intercept'i temizle
   */
  private cleanupConsoleIntercept(): void {
    console.log = this.originalConsoleLog
    console.error = this.originalConsoleError
  }

  /**
   * Progress'i güncelle
   */
  update(current: number, step: string = ''): void {
    this.current = Math.min(current, this.total)
    this.currentStep = step
    this.render()
  }

  /**
   * Bir adım ilerle
   */
  increment(step: string = ''): void {
    this.current = Math.min(this.current + 1, this.total)
    this.currentStep = step
    this.render()
  }

  /**
   * Progress bar'ı render et (her zaman en altta)
   */
  private render(): void {
    const percentage = (this.current / this.total) * 100
    const filledLength = Math.round((this.current / this.total) * this.barLength)
    const emptyLength = this.barLength - filledLength

    const filledBar = '█'.repeat(filledLength)
    const emptyBar = '░'.repeat(emptyLength)
    
    const progressText = `[${filledBar}${emptyBar}] ${percentage.toFixed(1)}% (${this.current}/${this.total}) ${this.currentStep}`

    // İlk render'da yeni satır oluştur
    if (!this.isInitialized) {
      process.stdout.write('\n')
      this.isInitialized = true
    }

    // Cursor'ı bir satır yukarı taşı, satırı temizle ve progress bar'ı yaz
    // \x1b[1A: Cursor'ı bir satır yukarı taşı
    // \x1b[K: Satırın sonuna kadar temizle
    // \r: Satır başına dön
    this.originalStdoutWrite(`\x1b[1A\x1b[K\r${progressText}\n`)
  }

  /**
   * Progress bar'ı tamamla
   */
  complete(message: string = 'Tamamlandı!'): void {
    this.current = this.total
    this.render()
    
    // Console intercept'i temizle
    this.cleanupConsoleIntercept()
    
    if (message) {
      // Progress bar'ın üstüne mesaj yaz
      this.originalStdoutWrite(`\x1b[1A\x1b[K\r✅ ${message}\n`)
    }
  }

  /**
   * Progress bar'ı temizle
   */
  clear(): void {
    if (this.isInitialized) {
      // Progress bar satırını temizle
      this.originalStdoutWrite(`\x1b[1A\x1b[K`)
      this.cleanupConsoleIntercept()
    }
  }
}

/**
 * Basit progress göstergesi (sadece yüzde)
 */
export class SimpleProgress {
  private total: number
  private current: number
  private currentStep: string

  constructor(total: number) {
    this.total = total
    this.current = 0
    this.currentStep = ''
  }

  update(current: number, step: string = ''): void {
    this.current = Math.min(current, this.total)
    this.currentStep = step
    const percentage = ((this.current / this.total) * 100).toFixed(1)
    process.stdout.write(`\r⏳ İlerleme: ${percentage}% (${this.current}/${this.total}) - ${step}`)
    
    if (this.current >= this.total) {
      process.stdout.write('\n')
    }
  }

  increment(step: string = ''): void {
    this.update(this.current + 1, step)
  }

  complete(message: string = 'Tamamlandı!'): void {
    this.update(this.total, message)
    console.log(`\n✅ ${message}`)
  }

  clear(): void {
    process.stdout.write('\n')
  }
}
