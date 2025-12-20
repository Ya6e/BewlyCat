import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'

import { useGlobalScrollState } from '~/composables/useGlobalScrollState'

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
 * 3. 对滚动容器应用 body class 优化
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
      // DPR=1.0 时的优化 - 使用 body class 选择器，避免个别元素属性变化引起的重排
      style.textContent = `
        /* DPR=1.0 性能优化 */
        /* 滚动时禁用所有过渡和动画以减少重绘 */
        body.bewly-scrolling .video-card-container,
        body.bewly-scrolling .video-card-container * {
          transition: none !important;
          animation: none !important;
        }
      `
    }
    else if (isLowDPR.value) {
      // DPR=1.25 时的轻度优化
      style.textContent = `
        /* DPR=1.25 轻度优化 */
        /* 滚动时禁用过渡 */
        body.bewly-scrolling .video-card-container {
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
    document.body.classList.remove('bewly-scrolling')
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
 * 在滚动时标记 body 为 "bewly-scrolling" 状态
 * 相比于标记每个卡片，这大大减少了 DOM 操作次数 (O(N) -> O(1))
 */
export function useScrollingOptimization() {
  const { isScrolling } = useGlobalScrollState()

  watch(isScrolling, (scrolling) => {
    if (scrolling) {
      document.body.classList.add('bewly-scrolling')
    }
    else {
      document.body.classList.remove('bewly-scrolling')
    }
  })

  // 保持空函数以兼容现有代码调用，以后可以移除
  function markScrolling(_: boolean) {}

  return {
    markScrolling,
  }
}
