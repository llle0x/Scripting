import { LiveActivity, Script } from "scripting"
import { ACTIVITY_NAME, ClockState, SecondsActivity } from "./live_activity"

const KEY = "island-seconds-activity-v1"
const INTRO_KEY = "island-seconds-intro-shown-v1"
type Saved = { id: string, origin: number }

async function run() {
  console.log("[IslandSeconds] Starting")
  const saved = Storage.get<Saved>(KEY)
  if (saved && typeof saved.id === "string" && Number.isFinite(saved.origin)) {
    const previous = await LiveActivity.from<ClockState>(saved.id, ACTIVITY_NAME)
    const status = previous ? await previous.getActivityState() : null
    if (previous && (status === "active" || status === "stale")) {
      const action = await Dialog.actionSheet({
        title: "灵动岛秒数",
        actions: [{ label: "停止显示" }, { label: "重新对时" }],
      })
      if (action == null) return
      if (action === 1) {
        const state: ClockState = { origin: Math.floor(Date.now() / 60000) * 60000 - 60000 }
        if (!await previous.update(state)) throw new Error("重新对时失败，请重试。")
        if (!Storage.set(KEY, { id: saved.id, origin: state.origin })) {
          throw new Error("已对时，但保存状态失败，请重试。")
        }
        return
      }
      if (!await previous.end({ origin: saved.origin }, { dismissTimeInterval: 0 })) {
        throw new Error("停止活动失败，请重试。")
      }
      console.log("[IslandSeconds] Stopped")
      Storage.remove(KEY)
      if (action === 0) return
    } else {
      Storage.remove(KEY)
    }
  }

  if (!await LiveActivity.areActivitiesEnabled()) {
    await Dialog.alert({ title: "实时活动未开启", message: "请在系统设置中允许 Scripting 使用实时活动，再运行脚本。" })
    return
  }

  // Start one full minute earlier so even the initial text has a seconds field.
  // floor((now - origin) / 1000) % 60 equals the wall-clock seconds.
  const state: ClockState = { origin: Math.floor(Date.now() / 60000) * 60000 - 60000 }
  const activity = SecondsActivity()
  if (!await activity.start(state)) {
    throw new Error("启动失败，请确认 Scripting 实时活动权限后重试。")
  }
  try {
    const id = activity.activityId
    if (!id || !Storage.set(KEY, { id, origin: state.origin })) {
      throw new Error("无法保存活动状态，请重试。")
    }
    console.log("[IslandSeconds] Live Activity started")
  } catch (error) {
    await activity.end(state, { dismissTimeInterval: 0 })
    throw error
  }
  if (Storage.get<boolean>(INTRO_KEY) !== true) {
    await Dialog.alert({
      title: "灵动岛秒数已开启",
      message: "返回主屏幕后可查看灵动岛秒数，长按灵动岛可展开查看时间、日期和星期。\n\n再次运行脚本，可停止显示或重新对时。跨日、切换时区或修改系统时间后，请重新对时。",
      buttonLabel: "知道了",
    })
    if (!Storage.set(INTRO_KEY, true)) console.warn("首次提示状态未保存，下次启动可能再次提示")
  }
}

void run().catch(async error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  await Dialog.alert({ title: "灵动岛秒数", message: String(error) })
}).finally(() => Script.exit())
