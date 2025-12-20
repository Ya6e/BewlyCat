import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

/**
 * 检测 DPR=1 的性能问题并应用优化
 *
 * 问题描述：
 * Chrome/Chromium 在 devicePixelRatio = 1.0 时使用不同的渲染路径，
 * 这会导致大量 DOM 元素（如 VideoCard 网格）的滚动性能严重下降。
 * 当 DPR > 1.0 时（如 125% 或 150% 缩放），Chrome 使用 GPU 合成优化，
 * 渲染性能显著提升。
 *
 * 解决方案：
 * 1. 检测 DPR=1.0 的情况
 * 2. 注入 CSS 规则强制 GPU 层合成
 * 3. 对滚动容器应用 `will-change` 和 `transform` 优化
 */
export function useDPRPerformanceFix() {
  const currentDPR = ref(window.devicePixelRatio)
  const styleElement = ref<HTMLStyleElement | null>(null)

  // 是否处于低 DPR（需要优化）状态
  const isLowDPR = computed(() => currentDPR.value <= 1.25)

  // 是否处于 DPR=1（最严重）状态
  const isDPR1 = computed(() => Math.abs(currentDPR.value - 1.0) < 0.01)

  // 更新 DPR 值
  function updateDPR() {
    currentDPR.value = window.devicePixelRatio
  }

  // 注入性能优化 CSS
  function injectOptimizationCSS() {
    if (styleElement.value) {
      styleElement.value.remove()
    }

    const style = document.createElement('style')
    style.id = 'bewly-dpr-perf-fix'

    if (isDPR1.value) {
      // DPR=1.0 时的激进优化
      style.textContent = `
        /* DPR=1.0 性能优化 - 强制 GPU 合成 */
        .video-card-container {
          /* 使用微小的 3D 变换强制 GPU 层，但不影响视觉 */
          transform: translateZ(0);
          /* 禁用子像素抗锯齿，减少渲染开销 */
          -webkit-font-smoothing: antialiased;
          /* 提示浏览器此元素会变化 */
          will-change: transform;
          /* 隔离合成层 */
          isolation: isolate;
        }

        /* 滚动时禁用所有过渡和阴影 */
        .video-card-container[data-scrolling="true"],
        .video-card-container[data-scrolling="true"] * {
          transition: none !important;
          animation: none !important;
          box-shadow: none !important;
        }

        /* 优化滚动容器 */
        [data-overlayscrollbars-viewport],
        .os-viewport {
          transform: translateZ(0);
          will-change: scroll-position;
        }

        /* 减少重绘区域 */
        .video-card-cover,
        .video-card-info {
          contain: layout style paint;
        }
      `
    }
    else if (isLowDPR.value) {
      // DPR=1.25 时的轻度优化
      style.textContent = `
        /* DPR=1.25 轻度优化 */
        .video-card-container {
          transform: translateZ(0);
          will-change: auto;
        }

        /* 滚动时禁用过渡 */
        .video-card-container[data-scrolling="true"] {
          transition: none !important;
        }
      `
    }

    if (style.textContent) {
      document.head.appendChild(style)
      styleElement.value = style
    }
  }

  // 清理
  function cleanup() {
    if (styleElement.value) {
      styleElement.value.remove()
      styleElement.value = null
    }
  }

  // 监听 DPR 变化（用户改变缩放时）
  onMounted(() => {
    const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)

    const handleChange = () => {
      updateDPR()
      injectOptimizationCSS()
    }

    // 初始注入
    injectOptimizationCSS()

    // 监听变化
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    }

    // 也监听 resize 以捕获缩放变化
    window.addEventListener('resize', handleChange)
  })

  onUnmounted(() => {
    cleanup()
  })

  // 当 DPR 改变时重新注入 CSS
  watchEffect(() => {
    if (currentDPR.value) {
      injectOptimizationCSS()
    }
  })

  return {
    currentDPR,
    isLowDPR,
    isDPR1,
  }
}

/**
 * 应用于滚动容器的性能优化 hook
 * 在滚动时标记所有卡片为 "scrolling" 状态
 */
export function useScrollingOptimization(containerRef: () => HTMLElement | null | undefined) {
  let scrollTimeout: number | null = null
  let isScrolling = false

  function markScrolling(state: boolean) {
    const container = containerRef()
    if (!container)
      return

    const cards = container.querySelectorAll('.video-card-container')
    cards.forEach((card) => {
      if (state) {
        card.setAttribute('data-scrolling', 'true')
      }
      else {
        card.removeAttribute('data-scrolling')
      }
    })
    isScrolling = state
  }

  function handleScroll() {
    if (!isScrolling) {
      markScrolling(true)
    }

    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }

    scrollTimeout = window.setTimeout(() => {
      markScrolling(false)
      scrollTimeout = null
    }, 150)
  }

  function cleanup() {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }
    markScrolling(false)
  }

  return {
    handleScroll,
    cleanup,
  }
}
