/**
 * 性能诊断工具
 * 用于收集和分析首页滚动卡顿问题
 */

interface FrameMetrics {
  timestamp: number
  frameTime: number
  scrollTop: number
  fps: number
}

interface PerformanceReport {
  devicePixelRatio: number
  screenWidth: number
  screenHeight: number
  windowWidth: number
  windowHeight: number
  chromeZoom: number
  userAgent: string
  avgFps: number
  minFps: number
  maxFps: number
  droppedFrames: number
  totalFrames: number
  avgFrameTime: number
  maxFrameTime: number
  cardCount: number
  columnCount: number
}

class PerformanceDiagnostics {
  private enabled = false
  private frameMetrics: FrameMetrics[] = []
  private frameCount = 0
  private droppedFrames = 0
  private rafId: number | null = null
  private isScrolling = false
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null
  private cardCount = 0
  private columnCount = 0

  // 启用诊断
  enable(): void {
    if (this.enabled)
      return
    this.enabled = true
    this.logSystemInfo()
    this.startFrameMonitoring()
    console.log('[BewlyPerf] 性能诊断已启用')
  }

  // 禁用诊断
  disable(): void {
    if (!this.enabled)
      return
    this.enabled = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    console.log('[BewlyPerf] 性能诊断已禁用')
  }

  // 记录系统信息
  private logSystemInfo(): void {
    const info = {
      devicePixelRatio: window.devicePixelRatio,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      // 估算 Chrome 缩放比例
      chromeZoom: Math.round((window.outerWidth / window.innerWidth) * 100) / 100,
      userAgent: navigator.userAgent,
    }

    console.log('[BewlyPerf] 系统信息:', info)
    console.log(`[BewlyPerf] devicePixelRatio: ${info.devicePixelRatio}`)
    console.log(`[BewlyPerf] 屏幕尺寸: ${info.screenWidth}x${info.screenHeight}`)
    console.log(`[BewlyPerf] 窗口尺寸: ${info.windowWidth}x${info.windowHeight}`)
  }

  // 开始帧率监控
  private startFrameMonitoring(): void {
    let lastTime = performance.now()
    let frameCountInSecond = 0
    let secondStart = lastTime

    const measureFrame = (currentTime: number): void => {
      if (!this.enabled)
        return

      const frameTime = currentTime - lastTime
      lastTime = currentTime
      frameCountInSecond++

      // 每秒计算一次 FPS
      if (currentTime - secondStart >= 1000) {
        const fps = frameCountInSecond
        if (this.isScrolling) {
          console.log(`[BewlyPerf] 滚动中 FPS: ${fps}, 帧时间: ${frameTime.toFixed(2)}ms`)

          // 检测掉帧 (低于 30 FPS 认为是掉帧)
          if (fps < 30) {
            this.droppedFrames++
            console.warn(`[BewlyPerf] ⚠️ 掉帧检测! FPS: ${fps}`)
          }
        }
        frameCountInSecond = 0
        secondStart = currentTime
      }

      // 记录滚动时的帧数据
      if (this.isScrolling && frameTime > 0) {
        this.frameMetrics.push({
          timestamp: currentTime,
          frameTime,
          scrollTop: this.getScrollTop(),
          fps: 1000 / frameTime,
        })

        // 只保留最近 100 帧数据
        if (this.frameMetrics.length > 100) {
          this.frameMetrics.shift()
        }

        // 检测长帧 (超过 50ms 即掉帧)
        if (frameTime > 50) {
          console.warn(`[BewlyPerf] ⚠️ 长帧检测: ${frameTime.toFixed(2)}ms`)
        }
      }

      this.frameCount++
      this.rafId = requestAnimationFrame(measureFrame)
    }

    this.rafId = requestAnimationFrame(measureFrame)
  }

  // 获取当前滚动位置
  private getScrollTop(): number {
    // 尝试获取 OverlayScrollbars 的滚动位置
    const osViewport = document.querySelector('[data-overlayscrollbars-viewport]') as HTMLElement
    if (osViewport) {
      return osViewport.scrollTop
    }
    return document.documentElement.scrollTop || document.body.scrollTop
  }

  // 标记滚动开始
  onScrollStart(): void {
    if (!this.enabled)
      return

    this.isScrolling = true
    console.log('[BewlyPerf] 滚动开始')

    // 清除之前的超时
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
    }
  }

  // 标记滚动结束
  onScrollEnd(): void {
    if (!this.enabled)
      return

    // 延迟判断滚动结束
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
    }

    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false
      console.log('[BewlyPerf] 滚动结束')
      this.printScrollReport()
    }, 200)
  }

  // 更新卡片和列数信息
  updateGridInfo(cardCount: number, columnCount: number): void {
    this.cardCount = cardCount
    this.columnCount = columnCount
    if (this.enabled) {
      console.log(`[BewlyPerf] Grid 信息更新: ${cardCount} 张卡片, ${columnCount} 列`)
    }
  }

  // 打印滚动报告
  private printScrollReport(): void {
    if (this.frameMetrics.length === 0)
      return

    const frameTimes = this.frameMetrics.map(m => m.frameTime)
    const fpsList = this.frameMetrics.map(m => m.fps)

    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
    const maxFrameTime = Math.max(...frameTimes)
    const avgFps = fpsList.reduce((a, b) => a + b, 0) / fpsList.length
    const minFps = Math.min(...fpsList)

    console.log('[BewlyPerf] === 滚动性能报告 ===')
    console.log(`[BewlyPerf] 采样帧数: ${this.frameMetrics.length}`)
    console.log(`[BewlyPerf] 平均帧时间: ${avgFrameTime.toFixed(2)}ms`)
    console.log(`[BewlyPerf] 最大帧时间: ${maxFrameTime.toFixed(2)}ms`)
    console.log(`[BewlyPerf] 平均 FPS: ${avgFps.toFixed(1)}`)
    console.log(`[BewlyPerf] 最低 FPS: ${minFps.toFixed(1)}`)
    console.log(`[BewlyPerf] 卡片数: ${this.cardCount}, 列数: ${this.columnCount}`)
    console.log('[BewlyPerf] ====================')

    // 清空帧数据
    this.frameMetrics = []
  }

  // 生成完整报告
  generateReport(): PerformanceReport {
    const frameTimes = this.frameMetrics.map(m => m.frameTime)
    const fpsList = this.frameMetrics.map(m => m.fps)

    return {
      devicePixelRatio: window.devicePixelRatio,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      chromeZoom: Math.round((window.outerWidth / window.innerWidth) * 100) / 100,
      userAgent: navigator.userAgent,
      avgFps: fpsList.length > 0 ? fpsList.reduce((a, b) => a + b, 0) / fpsList.length : 0,
      minFps: fpsList.length > 0 ? Math.min(...fpsList) : 0,
      maxFps: fpsList.length > 0 ? Math.max(...fpsList) : 0,
      droppedFrames: this.droppedFrames,
      totalFrames: this.frameCount,
      avgFrameTime: frameTimes.length > 0 ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length : 0,
      maxFrameTime: frameTimes.length > 0 ? Math.max(...frameTimes) : 0,
      cardCount: this.cardCount,
      columnCount: this.columnCount,
    }
  }

  // 测量函数执行时间
  measure<T>(name: string, fn: () => T): T {
    if (!this.enabled) {
      return fn()
    }

    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start

    if (duration > 16) {
      console.warn(`[BewlyPerf] ⚠️ ${name} 耗时: ${duration.toFixed(2)}ms (超过 16ms)`)
    }
    else if (duration > 5) {
      console.log(`[BewlyPerf] ${name} 耗时: ${duration.toFixed(2)}ms`)
    }

    return result
  }

  // 异步测量
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn()
    }

    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start

    if (duration > 16) {
      console.warn(`[BewlyPerf] ⚠️ ${name} 耗时: ${duration.toFixed(2)}ms (超过 16ms)`)
    }
    else if (duration > 5) {
      console.log(`[BewlyPerf] ${name} 耗时: ${duration.toFixed(2)}ms`)
    }

    return result
  }
}

// 单例实例
export const perfDiagnostics = new PerformanceDiagnostics()

// 在开发模式或通过 URL 参数启用
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.has('bewly-perf') || urlParams.has('debug')) {
    perfDiagnostics.enable()
  }

  // 暴露到全局，方便在控制台手动启用
  ;(window as any).bewlyPerf = perfDiagnostics
}
