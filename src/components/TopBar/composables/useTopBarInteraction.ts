import { computed, reactive, ref, watch } from 'vue'

import {
  ACCOUNT_URL,
  CHANNEL_PAGE_URL,
  SEARCH_PAGE_URL,
  SPACE_URL,
  VIDEO_PAGE_URL,
} from '~/components/TopBar/constants/urls'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useDelayedHover } from '~/composables/useDelayedHover'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import { useTopBarStore } from '~/stores/topBarStore'
import { isHomePage } from '~/utils/main'
import { createTransformer } from '~/utils/transformer'

export function useTopBarInteraction() {
  const topBarStore = useTopBarStore()
  const { closeAllPopups } = topBarStore
  const topBarItemElements = reactive({})
  const topBarTransformers = reactive({})

  const isMouseOverPopup = reactive<Record<string, boolean>>({})

  // 当前点击的顶栏项
  const currentClickedTopBarItem = ref<string | null>(null)

  // 获取 App Provider
  const { activatedPage, reachTop } = useBewlyApp()

  // TopBar 相关计算属性
  const forceWhiteIcon = computed((): boolean => {
    if (!settings.value)
      return false

    // 如果启用了"始终使用透明样式"，直接返回 true
    if (settings.value.alwaysUseTransparentTopBar)
      return true

    if (
      (isHomePage() && settings.value.useOriginalBilibiliHomepage)
      || (CHANNEL_PAGE_URL.test(location.href) && !VIDEO_PAGE_URL.test(location.href))
      || SPACE_URL.test(location.href)
      || ACCOUNT_URL.test(location.href)
    ) {
      return true
    }

    if (!isHomePage())
      return false

    // 确保 activatedPage.value 存在
    if (!activatedPage?.value)
      return false

    if (activatedPage.value === AppPage.Search) {
      if (settings.value.individuallySetSearchPageWallpaper) {
        if (settings.value.searchPageWallpaper)
          return true
        return false
      }
      return !!settings.value.wallpaper
    }
    else {
      if (settings.value.wallpaper)
        return true

      if (settings.value.useSearchPageModeOnHomePage) {
        if (settings.value.individuallySetSearchPageWallpaper && !!settings.value.searchPageWallpaper)
          return true
        else if (settings.value.wallpaper)
          return true
      }
    }
    return false
  })

  const showSearchBar = computed((): boolean => {
    if (!settings.value.usePluginSearchResultsPage)
      return false

    const isSearchPage = SEARCH_PAGE_URL.test(location.href)

    if (isHomePage()) {
      if (settings.value.useOriginalBilibiliHomepage)
        return true
      if (!activatedPage?.value)
        return true
      if (activatedPage.value === AppPage.Search)
        return true
      if (settings.value.useSearchPageModeOnHomePage && activatedPage.value === AppPage.Home && reachTop?.value)
        return false
    }
    else if (isSearchPage) {
      return true
    }

    return true
  })

  // 设置顶栏项悬停事件
  function setupTopBarItemHoverEvent(key: string) {
    const element = useDelayedHover({
      enterDelay: 320,
      leaveDelay: 320,
      beforeEnter: () => closeAllPopups(key),
      enter: () => {
        topBarStore.popupVisible[key] = true
      },
      leave: () => {
        // 只有当鼠标不在弹窗上时才隐藏
        setTimeout(() => {
          if (!isMouseOverPopup[key]) {
            topBarStore.popupVisible[key] = false
          }
        }, 200)
      },
    })

    topBarItemElements[key] = element
    return element
  }

  // 设置顶栏项变换器
  function setupTopBarItemTransformer(key: string, targetRef?: any) {
    const transformer = createTransformer(topBarItemElements[key], {
      x: '0px',
      y: '50px',
      centerTarget: {
        x: true,
      },
    })

    // 如果提供了targetRef，将其存储但不修改transformer的内部逻辑
    if (targetRef) {
      topBarTransformers[key] = targetRef
      // 监听targetRef的变化，当targetRef有值时，将其设置为transformer的target
      watch(targetRef, (newVal) => {
        if (newVal) {
          transformer.value = newVal
        }
      }, { immediate: true })
      return targetRef
    }

    topBarTransformers[key] = transformer
    return transformer
  }

  // 处理顶栏项点击
  function handleClickTopBarItem(event: MouseEvent, key: string) {
    if (settings.value.touchScreenOptimization) {
      event.preventDefault()
      closeAllPopups(key)
      topBarStore.popupVisible[key] = !topBarStore.popupVisible[key]
      currentClickedTopBarItem.value = key
    }
  }

  // 处理通知项点击
  function handleNotificationsItemClick(item: { name: string, url: string, unreadCount: number, icon: string }) {
    if (settings.value.openNotificationsPageAsDrawer) {
      topBarStore.drawerVisible.notifications = true
      topBarStore.notificationsDrawerUrl = item.url
    }
  }

  return {
    currentClickedTopBarItem,
    setupTopBarItemHoverEvent,
    setupTopBarItemTransformer,
    handleClickTopBarItem,
    handleNotificationsItemClick,
    forceWhiteIcon,
    showSearchBar,
  }
}
