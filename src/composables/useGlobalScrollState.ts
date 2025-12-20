/**
 * 全局滚动状态管理（单例模式）
 * 所有组件共享同一个滚动检测，避免重复监听
 *
 * 优化：支持 OverlayScrollbars 容器和原生滚动
 */

import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

import { OVERLAY_SCROLL_BAR_SCROLL } from '~/constants/globalEvents'
import emitter from '~/utils/mitt'

// 全局状态（单例）
const isScrolling = ref(false)
let scrollTimeout: ReturnType<typeof setTimeout> | null = null
let listenerCount = 0
let isListenerAttached = false

// 滚动处理函数（单例）- 使用 RAF 节流
let scrollRAF: number | null = null

function handleScrollEvent() {
  // 使用 RAF 节流，避免在同一帧内多次更新
  if (scrollRAF !== null) {
    return
  }

  scrollRAF = requestAnimationFrame(() => {
    isScrolling.value = true
    scrollRAF = null
  })

  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }

  scrollTimeout = setTimeout(() => {
    isScrolling.value = false
  }, 150)
}

// 添加监听器（引用计数）
function addScrollListener() {
  listenerCount++

  // 只在第一次添加时绑定事件
  if (!isListenerAttached) {
    // 监听原生 window 滚动（用于非首页）
    window.addEventListener('scroll', handleScrollEvent, { passive: true })

    // 监听 OverlayScrollbars 滚动事件（用于首页）
    emitter.on(OVERLAY_SCROLL_BAR_SCROLL, handleScrollEvent)

    isListenerAttached = true
  }
}

// 移除监听器（引用计数）
function removeScrollListener() {
  listenerCount--

  // 当所有组件都卸载时，移除事件监听
  if (listenerCount <= 0 && isListenerAttached) {
    window.removeEventListener('scroll', handleScrollEvent)
    emitter.off(OVERLAY_SCROLL_BAR_SCROLL, handleScrollEvent)
    isListenerAttached = false
    listenerCount = 0

    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
      scrollTimeout = null
    }

    if (scrollRAF !== null) {
      cancelAnimationFrame(scrollRAF)
      scrollRAF = null
    }
  }
}

/**
 * 使用全局滚动状态
 * 返回是否正在快速滚动
 */
export function useGlobalScrollState() {
  // 组件挂载时添加监听
  onMounted(() => {
    addScrollListener()
  })

  // 组件卸载时移除监听
  onBeforeUnmount(() => {
    removeScrollListener()
  })

  return {
    isScrolling: readonly(isScrolling),
  }
}
