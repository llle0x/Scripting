import { AppEvents, Navigation, NavigationStack, Path, Script, type ScenePhase } from "scripting"
import { share } from "./class/share"
import { ChatPage } from "./page"
import { TransferActivityController } from "./activity"
import { claimSharedFiles } from "./shared_files"

// 主入口流程：启动服务 → 接收分享队列/恢复事件 → 保活 → 页面关闭后收尾退出
export function runChat(initialFiles?: string[]) {
  const main = async () => {
    if (!share.ip) throw new Error("当前不处于局域网")
    await share.start()
    share.markClipboardHandled(await Pasteboard.changeCount)
    let checkingClipboard = false
    const sendChangedClipboard = async () => {
      if (checkingClipboard) return
      checkingClipboard = true
      try {
        const changeCount = await Pasteboard.changeCount
        if (!share.autoSendClipboardOnForeground) {
          share.markClipboardHandled(changeCount)
          return
        }
        if (changeCount === share.clipboardChangeCount) return
        // 先标记，避免 onResume 与 active 同时触发造成重复发送。
        share.markClipboardHandled(changeCount)
        if (await Pasteboard.hasImages) {
          const images = await Pasteboard.getImages()
          const paths: string[] = []
          for (const image of images ?? []) {
            const data = image.toPNGData()
            if (!data) continue
            const path = Path.join(FileManager.temporaryDirectory, `剪贴板图片-${Date.now()}-${paths.length + 1}.png`)
            FileManager.writeAsDataSync(path, data)
            paths.push(path)
          }
          if (paths.length > 0) await share.sendPastedFiles(paths)
          return
        }
        const text = await Pasteboard.getString()
        const value = text?.slice(0, 100_000).trim()
        if (value) share.sendPastedText(value)
      } catch (error) {
        console.warn(`剪贴板前台同步失败：${String(error)}`)
      } finally {
        checkingClipboard = false
      }
    }
    const claimQueuedFiles = () => share.queueFiles(claimSharedFiles())
    share.queueFiles(initialFiles ?? [])
    claimQueuedFiles()
    const activity = new TransferActivityController()
    let foregroundSyncTimer: ReturnType<typeof setTimeout> | null = null
    const syncActivityForeground = () => {
      activity.setForeground(true)
      if (foregroundSyncTimer != null) clearTimeout(foregroundSyncTimer)
      foregroundSyncTimer = setTimeout(() => {
        foregroundSyncTimer = null
        activity.setForeground(true)
      }, 500)
    }
    const removeResumeListener = Script.onResume(() => {
      claimQueuedFiles()
      syncActivityForeground()
      void sendChangedClipboard()
      // 共享 Storage 的持久化是异步的，再补查一次避免刚唤醒时尚未落盘。
      setTimeout(claimQueuedFiles, 500)
    })
    let keepAliveRequested = false
    let wantsKeepAlive = false
    let keeperTask: Promise<void> = Promise.resolve()
    const syncKeepAlive = (wanted: boolean) => {
      wantsKeepAlive = wanted
      keeperTask = keeperTask.then(async () => {
        if (wantsKeepAlive && !keepAliveRequested) {
          keepAliveRequested = await BackgroundKeeper.keepAlive()
        } else if (!wantsKeepAlive && keepAliveRequested) {
          await BackgroundKeeper.stopKeepAlive()
          keepAliveRequested = false
        }
      }).catch(error => console.warn(`后台保活切换失败：${String(error)}`))
      return keeperTask
    }
    const onScenePhase = (phase: ScenePhase) => {
      if (phase === "background") {
        activity.setForeground(false)
        void syncKeepAlive(true)
      } else if (phase === "active") {
        syncActivityForeground()
        void syncKeepAlive(false)
        void sendChangedClipboard()
      }
    }
    AppEvents.scenePhase.addListener(onScenePhase)
    try {
      try {
        await activity.start()
      } catch (error) {
        console.warn(`实时活动启动失败：${String(error)}`)
      }
      await Navigation.present({
        element: (
          <NavigationStack>
            <ChatPage />
          </NavigationStack>
        ),
        modalPresentationStyle: "pageSheet",
      })
    } finally {
      removeResumeListener()
      AppEvents.scenePhase.removeListener(onScenePhase)
      if (foregroundSyncTimer != null) clearTimeout(foregroundSyncTimer)
      foregroundSyncTimer = null
      try {
        await activity.stop()
      } catch (error) {
        console.warn(`实时活动结束失败：${String(error)}`)
      }
      await syncKeepAlive(false)
      share.stop()
    }
  }
  main()
    .catch(async (e) => {
      await Dialog.alert({ title: "错误", message: String(e) })
    })
    .finally(() => Script.exit())
}
