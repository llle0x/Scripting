import {
  Button,
  HStack,
  Image,
  Menu,
  Navigation,
  NavigationStack,
  Path,
  QRImage,
  Rectangle,
  ScrollView,
  ScrollViewReader,
  Script,
  Text,
  TextField,
  Toggle,
  VStack,
  ZStack,
  useEffect,
  useKeyboardVisible,
  useObservable,
  useRef,
  type ScrollViewProxy,
} from "scripting"
import { Bubble } from "../components/Bubble"
import { share } from "../class/share"
import type { AppEvent, ChatMessage } from "../types"

const pageColor = { light: "#ffffff", dark: "#000000" } as const
const barColor = { light: "#f2f2f7", dark: "#1c1c1e" } as const
const MAX_MESSAGE_HISTORY = 500

export function ChatPage() {
  const dismiss = Navigation.useDismiss()
  const messages = useObservable<ChatMessage[]>([])
  const input = useObservable<string>("")
  const online = useObservable<boolean>(false)
  const sheetPresented = useObservable<boolean>(false)
  const sheetKind = useObservable<"qr" | "settings">("qr")
  const settingsRevision = useObservable<number>(0)
  const clipboardToast = useObservable<boolean>(false)
  const toastMessage = useObservable<string>("该剪贴板内容已发送")
  const keyboardVisible = useKeyboardVisible()
  const proxyRef = useRef<ScrollViewProxy | null>(null)
  const appendMessages = (next: ChatMessage[]) => {
    if (next.length === 0) return
    messages.setValue([...messages.value, ...next].slice(-MAX_MESSAGE_HISTORY))
  }
  const showToast = (message: string) => {
    toastMessage.setValue(message)
    clipboardToast.setValue(true)
  }

  // 绑定服务端事件：状态 + 收到的消息
  useEffect(() => {
    share.setListener((e: AppEvent) => {
      if (e.type === "status") {
        online.setValue(e.online)
      }
      else if (e.type === "connection") {
        const timestamp = Date.now()
        appendMessages([
          {
            id: `connection-${timestamp}-${e.online ? "online" : "offline"}`,
            ts: timestamp,
            role: "system",
            kind: "text",
            text: `${e.deviceName}（${e.address}）${e.online ? "已连接" : "已断开"}`,
          },
        ])
      }
      else if (e.type === "incoming" || e.type === "outgoing") appendMessages([e.message])
    })
    return () => share.setListener(null)
  }, [])

  // 定时拉取上传收到的事件（上传 handler 不直接触达 UI，见 share.inbox）
  useEffect(() => {
    let disposed = false
    let timer = 0
    const tick = () => {
      if (disposed) return
      const events = share.drainInbox()
      const queued = events.flatMap((e) => (e.type === "incoming" || e.type === "outgoing" ? [e.message] : []))
      appendMessages(queued)
      timer = setTimeout(tick, 500)
    }
    timer = setTimeout(tick, 500)
    return () => {
      disposed = true
      clearTimeout(timer)
    }
  }, [])

  // 新消息滚到底
  useEffect(() => {
    const list = messages.value
    const last = list[list.length - 1]
    if (last) proxyRef.current?.scrollTo(last.id, "bottom")
  }, [messages.value.length])

  async function sendFiles(paths: string[]) {
    if (paths.length === 0) return
    try {
      appendMessages(await share.sendFiles(paths))
    } catch (error) {
      showToast(`文件发送失败：${String(error)}`)
    }
  }

  function sendText() {
    const t = input.value.trim()
    if (!t) return
    appendMessages([share.sendText(t)])
    if (!online.value) showToast("暂无连接，文本将在设备连接后补发")
    input.setValue("")
  }

  async function onPickPhotos() {
    await sendFiles(await pickFromPhotos())
  }

  async function onCapture() {
    await sendFiles(await captureMedia())
  }

  async function onPickFiles() {
    const paths = await DocumentPicker.pickFiles({ allowsMultipleSelection: true })
    await sendFiles(paths)
  }

  async function onPasteClipboard() {
    try {
      const changeCount = await Pasteboard.changeCount
      if (changeCount === share.clipboardChangeCount) {
        showToast("该剪贴板内容已发送")
        return
      }
      if (await Pasteboard.hasImages) {
        const images = await Pasteboard.getImages()
        const paths: string[] = []
        for (const image of images ?? []) {
          const data = image.toPNGData()
          if (!data) continue
          const path = Path.join(FileManager.temporaryDirectory, `粘贴图片-${Date.now()}-${paths.length + 1}.png`)
          FileManager.writeAsDataSync(path, data)
          paths.push(path)
        }
        if (paths.length === 0) {
          showToast("剪贴板中没有可发送的图片")
          return
        }
        await share.sendPastedFiles(paths)
        share.markClipboardHandled(changeCount)
        if (!online.value) showToast("暂无连接，图片将在设备连接后补发")
        return
      }
      const text = await Pasteboard.getString()
      const value = text?.slice(0, 100_000).trim()
      if (!value) {
        showToast("剪贴板中没有可发送内容")
        return
      }
      share.sendPastedText(value)
      share.markClipboardHandled(changeCount)
      if (!online.value) showToast("暂无连接，文本将在设备连接后补发")
    } catch (error) {
      showToast(`读取剪贴板失败：${String(error)}`)
    }
  }

  // 从相册选取图片/视频，逐项读出并复制到沙盒后返回文件路径
  async function pickFromPhotos(): Promise<string[]> {
    const results = await Photos.pick({ limit: 9 })
    const paths: string[] = []
    for (const r of results) {
      const p = (await r.imagePath()) ?? (await r.videoPath())
      if (p) paths.push(p)
    }
    return paths
  }

  async function captureMedia(): Promise<string[]> {
    const info = await Photos.capture({ mode: "photo", mediaTypes: ["public.image", "public.movie"] })
    const p = info?.imagePath ?? info?.mediaPath
    return p ? [p] : []
  }

  return (
    <ZStack
      frame={{ maxWidth: Infinity, maxHeight: Infinity }}
      navigationTitle="文件传输"
      navigationBarTitleDisplayMode="inline"
      toolbar={{
        topBarLeading: [<Button title="关闭" systemImage="xmark" tint="red" action={dismiss} />],
        topBarTrailing: [
          <Button title="二维码" systemImage="qrcode" action={() => { sheetKind.setValue("qr"); sheetPresented.setValue(true) }} />,
          <Button title="设置" systemImage="gearshape" action={() => { settingsRevision.setValue(Date.now()); sheetKind.setValue("settings"); sheetPresented.setValue(true) }} />,
          <Button title="最小化" systemImage="chevron.down" action={() => Script.minimize()} />,
        ],
      }}
      sheet={{
        isPresented: sheetPresented,
        content: sheetKind.value === "qr"
          ? <QRSheet link={share.link} pairingCode={share.pairingCode} onClose={() => sheetPresented.setValue(false)} />
          : <SettingsSheet key={settingsRevision.value} onClose={() => sheetPresented.setValue(false)} />,
      }}
      toast={{
        isPresented: clipboardToast,
        message: toastMessage.value,
        duration: 2,
        position: "bottom",
        backgroundColor: "label",
        textColor: "systemBackground",
      }}
      safeAreaInset={{
        bottom: {
          spacing: 0,
          content: <Composer input={input} keyboardVisible={keyboardVisible} onSend={sendText} onPasteClipboard={onPasteClipboard} onPickPhotos={onPickPhotos} onCapture={onCapture} onPickFiles={onPickFiles} />,
        },
      }}>
      <Rectangle fill={pageColor} frame={{ maxWidth: Infinity, maxHeight: Infinity }} />
      <VStack frame={{ maxWidth: Infinity, maxHeight: Infinity }} spacing={0}>
        <HStack spacing={6} padding={{ horizontal: 14, top: 8, bottom: 6 }}>
          <Image systemName={online.value ? "circle.fill" : "circle"} foregroundStyle={online.value ? "systemGreen" : "tertiaryLabel"} font={10} />
          <Text font={13} foregroundStyle="secondaryLabel">{online.value ? "浏览器已连接" : "等待浏览器配对…"}</Text>
          <Text font={13} fontWeight="semibold" foregroundStyle="label" frame={{ maxWidth: Infinity }} multilineTextAlignment="trailing">配对码 {share.pairingCode}</Text>
        </HStack>
        <ScrollViewReader>
          {(proxy) => {
            proxyRef.current = proxy
            return (
              <ScrollView
                frame={{ maxWidth: Infinity, maxHeight: Infinity }}
                scrollDismissesKeyboard="interactively">
                <VStack spacing={10} padding={14}>
                  {messages.value.map((m) => (
                    <Bubble key={m.id} message={m} />
                  ))}
                </VStack>
              </ScrollView>
            )
          }}
        </ScrollViewReader>
      </VStack>
    </ZStack>
  )
}

function formatSettingsDate(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const devices = useObservable(share.trustedDeviceList)
  const temporaryDevices = useObservable(share.temporaryConnectedDeviceList)
  const autoClipboard = useObservable(share.autoSendClipboardOnForeground)
  const refreshDevices = () => {
    devices.setValue(share.trustedDeviceList)
    temporaryDevices.setValue(share.temporaryConnectedDeviceList)
  }
  useEffect(() => {
    let disposed = false
    let timer = 0
    const tick = () => {
      if (disposed) return
      refreshDevices()
      timer = setTimeout(tick, 1000)
    }
    timer = setTimeout(tick, 1000)
    return () => {
      disposed = true
      clearTimeout(timer)
    }
  }, [])
  const confirmDisconnectTemporary = async (device: { id: string; name: string; address: string }) => {
    const confirmed = await Dialog.confirm({
      title: "断开临时设备？",
      message: `${device.name}（${device.address}）将立即断开，并需要重新输入配对码。`,
      cancelLabel: "取消",
      confirmLabel: "断开",
    })
    if (confirmed) {
      share.disconnectTemporaryDevice(device.id)
      refreshDevices()
    }
  }
  const editTemporaryNote = async (device: { id: string; name: string; note: string }) => {
    const note = await Dialog.prompt({
      title: "设备备注",
      message: `原始名称：${device.name}；留空可清除备注。`,
      defaultValue: device.note,
      placeholder: "例如：办公室电脑",
      cancelLabel: "取消",
      confirmLabel: "保存",
    })
    if (note !== null) {
      share.setTemporaryDeviceNote(device.id, note)
      refreshDevices()
    }
  }
  const confirmDeleteTrusted = async (device: { id: string; name: string }) => {
    const confirmed = await Dialog.confirm({
      title: "删除信任设备？",
      message: `${device.name} 将立即断开，下次连接需要重新输入配对码。`,
      cancelLabel: "取消",
      confirmLabel: "删除并断开",
    })
    if (confirmed) {
      share.forgetTrustedDevice(device.id)
      refreshDevices()
    }
  }
  const editTrustedNote = async (device: { id: string; name: string; note: string }) => {
    const note = await Dialog.prompt({
      title: "设备备注",
      message: `原始名称：${device.name}；备注会长期保存，留空可清除。`,
      defaultValue: device.note,
      placeholder: "例如：家里电脑",
      cancelLabel: "取消",
      confirmLabel: "保存",
    })
    if (note !== null) {
      share.setTrustedDeviceNote(device.id, note)
      refreshDevices()
    }
  }
  const confirmDeleteAllTrusted = async () => {
    const confirmed = await Dialog.confirm({
      title: "清除全部信任设备？",
      message: "所有已信任设备将立即断开，下次连接都需要重新输入配对码。",
      cancelLabel: "取消",
      confirmLabel: "全部清除",
    })
    if (confirmed) {
      share.forgetTrustedDevices()
      refreshDevices()
    }
  }
  return (
    <NavigationStack presentationDetents={["medium", "large"]}>
      <ScrollView
        navigationTitle="设置"
        navigationBarTitleDisplayMode="inline"
        toolbar={{ topBarLeading: <Button title="关闭" systemImage="xmark" action={onClose} /> }}>
        <VStack spacing={18} padding={{ horizontal: 18, vertical: 16 }} frame={{ maxWidth: Infinity }}>
          <VStack alignment="leading" spacing={10} padding={14} background={{ style: barColor, shape: { type: "rect", cornerRadius: 16, style: "continuous" } }} frame={{ maxWidth: Infinity }}>
            <Toggle
              value={autoClipboard.value}
              onChanged={(value) => { autoClipboard.setValue(value); share.autoSendClipboardOnForeground = value }}
              title="回到前台自动发送剪贴板"
              systemImage="doc.on.clipboard"
            />
            <Text font={12} foregroundStyle="secondaryLabel">关闭后，点击灵动岛或回到前台不会自动发送；仍可手动点击输入框旁的剪贴板按钮。</Text>
          </VStack>
          <VStack alignment="leading" spacing={10} frame={{ maxWidth: Infinity }}>
            <Text font={16} fontWeight="semibold">临时连接设备（{temporaryDevices.value.length}）</Text>
            {temporaryDevices.value.length === 0 ? (
              <Text font={14} foregroundStyle="secondaryLabel" padding={14}>暂无临时连接设备</Text>
            ) : temporaryDevices.value.map((device) => (
              <HStack key={device.id} spacing={10} padding={12} background={{ style: barColor, shape: { type: "rect", cornerRadius: 14, style: "continuous" } }} frame={{ maxWidth: Infinity }}>
                <Image systemName="network" foregroundStyle="systemOrange" font={20} />
                <VStack alignment="leading" spacing={3} frame={{ maxWidth: Infinity }}>
                  <Text font={15} fontWeight="semibold">{device.note || device.name}</Text>
                  <Text font={11} foregroundStyle="secondaryLabel">{device.note ? `${device.name} · ` : ""}{device.address}</Text>
                </VStack>
                <Button title="备注" systemImage="pencil" action={() => void editTemporaryNote(device)} />
                <Button title="断开" systemImage="xmark.circle" role="destructive" action={() => void confirmDisconnectTemporary(device)} />
              </HStack>
            ))}
          </VStack>
          <VStack alignment="leading" spacing={10} frame={{ maxWidth: Infinity }}>
            <HStack frame={{ maxWidth: Infinity }}>
              <Text font={16} fontWeight="semibold">已信任设备（{devices.value.length}）</Text>
              <Text frame={{ maxWidth: Infinity }}>{""}</Text>
              {devices.value.length > 0 ? (
                <Button title="清除全部" systemImage="trash" role="destructive" action={() => void confirmDeleteAllTrusted()} />
              ) : null}
            </HStack>
            {devices.value.length === 0 ? (
              <Text font={14} foregroundStyle="secondaryLabel" padding={14}>暂无已信任设备</Text>
            ) : devices.value.map((device) => (
              <HStack key={device.id} spacing={10} padding={12} background={{ style: barColor, shape: { type: "rect", cornerRadius: 14, style: "continuous" } }} frame={{ maxWidth: Infinity }}>
                <Image systemName="desktopcomputer" foregroundStyle="systemBlue" font={20} />
                <VStack alignment="leading" spacing={3} frame={{ maxWidth: Infinity }}>
                  <Text font={15} fontWeight="semibold">{device.note || device.name}</Text>
                  <Text font={11} foregroundStyle="secondaryLabel">{device.note ? `${device.name} · ` : ""}最近使用 {formatSettingsDate(device.lastUsedAt)}</Text>
                </VStack>
                <Button title="备注" systemImage="pencil" action={() => void editTrustedNote(device)} />
                <Button title="删除" systemImage="trash" role="destructive" action={() => void confirmDeleteTrusted(device)} />
              </HStack>
            ))}
            <Text font={11} foregroundStyle="secondaryLabel">删除后，该浏览器下次需要重新输入配对码；当前连接会保持到断开为止。</Text>
          </VStack>
        </VStack>
      </ScrollView>
    </NavigationStack>
  )
}

// 底部输入栏
function Composer({
  input,
  keyboardVisible,
  onSend,
  onPasteClipboard,
  onPickPhotos,
  onCapture,
  onPickFiles,
}: {
  input: ReturnType<typeof useObservable<string>>
  keyboardVisible: boolean
  onSend: () => void
  onPasteClipboard: () => void
  onPickPhotos: () => void
  onCapture: () => void
  onPickFiles: () => void
}) {
  return (
    // 悬浮胶囊输入栏：外层留左右边距，内层整行包在胶囊形容器里
    <HStack padding={{ horizontal: 16, top: 6, bottom: keyboardVisible ? 6 : 10 }} frame={{ maxWidth: Infinity }}>
      <HStack
        spacing={8}
        padding={{ horizontal: 12, vertical: 8 }}
        background={{ style: barColor, shape: "capsule" }}
        frame={{ maxWidth: Infinity }}>
        <Menu label={<Image systemName="paperclip" font={22} foregroundStyle="systemBlue" />}>
          <Button title="选取文件" systemImage="folder" action={onPickFiles} />
          <Button title="照片图库" systemImage="photo.on.rectangle.angled" action={onPickPhotos} />
          <Button title="拍照或录像" systemImage="camera" action={onCapture} />
        </Menu>
        <Button action={() => {
          onPasteClipboard()
        }} buttonStyle="plain">
          <Image systemName="doc.on.clipboard" font={21} foregroundStyle="systemBlue" />
        </Button>
        <TextField
          label={<Text>{""}</Text>}
          value={input.value}
          onChanged={(v) => input.setValue(v)}
          prompt="说点什么…"
          textFieldStyle="plain"
          frame={{ maxWidth: Infinity }}
        />
        <Button action={onSend} buttonStyle="plain">
          <Image systemName="arrow.up.circle.fill" font={30} foregroundStyle="systemBlue" />
        </Button>
      </HStack>
    </HStack>
  )
}

function QRSheet({
  link,
  pairingCode,
  onClose,
}: {
  link: string
  pairingCode: string
  onClose: () => void
}) {
  return (
    <NavigationStack presentationDetents={["medium"]}>
      <VStack
        spacing={16}
        padding={{ horizontal: 24, vertical: 20 }}
        frame={{ maxWidth: Infinity, maxHeight: Infinity }}
        navigationTitle="二维码"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: <Button title="关闭" systemImage="xmark" action={onClose} />,
          topBarTrailing: <Button title="复制链接" systemImage="doc.on.doc" action={() => Pasteboard.setString(link)} />,
        }}>
        <VStack background={{ style: "white", shape: { type: "rect", cornerRadius: 20, style: "continuous" } }} padding={12}>
          <QRImage data={link} size={220} />
        </VStack>
        <VStack spacing={4}>
          <Text font={13} foregroundStyle="secondaryLabel">浏览器打开后输入配对码</Text>
          <Text font={28} fontWeight="bold" monospacedDigit>{pairingCode}</Text>
        </VStack>
        <Text font={13} foregroundStyle="secondaryLabel" lineLimit={1}>{link}</Text>
      </VStack>
    </NavigationStack>
  )
}
