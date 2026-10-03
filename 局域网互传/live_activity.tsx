import {
  DateLabel,
  HStack,
  Image,
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIBuilder,
  LiveActivityUIExpandedBottom,
  LiveActivityUIExpandedLeading,
  LiveActivityUIExpandedTrailing,
  Spacer,
  Text,
  VStack,
} from "scripting"

export const TRANSFER_ACTIVITY_NAME = "LanTransferActivity"

export type TransferActivityState = {
  online: boolean
  networkType: "wifi" | "cellular" | "offline"
  clockBase: number
  address: string
  pairingCode: string
  deviceCount: number
  primaryName: string
  deviceSummary: string
  client1: string
  client2: string
  client3: string
  remainingCount: number
  sent: number
  received: number
}

// 与设备时间的秒数对齐；系统负责逐秒刷新，无需每秒更新 Activity。
// 内层提供真实排版宽度并右对齐，外层仅露出两位数字；不要使用 fixedSize。
function Seconds({ clockBase }: { clockBase: number }) {
  return (
    <HStack spacing={0} frame={{ width: 19, height: 21, alignment: "trailing" }} clipped>
      <DateLabel
        date={new Date(clockBase - 60_000)}
        style="timer"
        font={15}
        fontDesign="monospaced"
        monospacedDigit
        foregroundStyle="white"
        multilineTextAlignment="trailing"
        frame={{ width: 120, height: 21, alignment: "trailing" }}
      />
    </HStack>
  )
}

function connectedTitle(state: TransferActivityState): string {
  if (state.deviceCount === 0) return "等待连接"
  return `${state.deviceCount} 台已连接`
}

function StatusIcon({ online }: { online: boolean }) {
  return <Image systemName={online ? "link" : "wifi"} font={16}
    frame={{ width: 20, height: 20 }} foregroundStyle="systemBlue" />
}

function AccessLine(state: TransferActivityState) {
  return <HStack spacing={8} foregroundStyle="white">
    <Text font={11} monospacedDigit lineLimit={1} minScaleFactor={0.7}
      frame={{ maxWidth: Infinity, alignment: "leading" }}>{state.address}</Text>
    <HStack spacing={4}>
      <Text font={9} foregroundStyle="rgba(255,255,255,0.55)">配对码</Text>
      <Text font={16} fontWeight="semibold" monospacedDigit>{state.pairingCode}</Text>
    </HStack>
  </HStack>
}

function DeviceNames(state: TransferActivityState) {
  return <Text font={11} foregroundStyle="rgba(255,255,255,0.65)" lineLimit={1}>
    {state.deviceSummary}{state.remainingCount > 0 ? ` · 另有 ${state.remainingCount} 台` : ""}
  </Text>
}

function LockScreenContent(state: TransferActivityState) {
  return (
    <VStack alignment="leading" spacing={5} padding={12} activityBackgroundTint="rgba(12,16,24,0.96)" foregroundStyle="white">
      <HStack spacing={6}>
        <StatusIcon online={state.deviceCount > 0} />
        <Text font={13} fontWeight="semibold" lineLimit={1}>{connectedTitle(state)}</Text>
        <Spacer />
        {state.deviceSummary ? <DeviceNames {...state} /> : null}
      </HStack>
      <AccessLine {...state} />
    </VStack>
  )
}

const builder: LiveActivityUIBuilder<TransferActivityState> = state => (
  <LiveActivityUI
    content={<LockScreenContent {...state} />}
    compactLeading={<Seconds clockBase={state.clockBase} />}
    compactTrailing={<Text frame={{ width: 0, height: 0 }}>{""}</Text>}
    minimal={<Seconds clockBase={state.clockBase} />}>
    <LiveActivityUIExpandedLeading>
      <HStack spacing={5} foregroundStyle="white">
        <Image systemName={state.deviceCount > 0 ? "link" : "wifi"} font={13} foregroundStyle="systemBlue" />
        <Text font={13} fontWeight="semibold" lineLimit={1}>
          {connectedTitle(state)}
        </Text>
      </HStack>
    </LiveActivityUIExpandedLeading>
    <LiveActivityUIExpandedTrailing>
      {state.deviceSummary ? <DeviceNames {...state} /> : <Text>{""}</Text>}
    </LiveActivityUIExpandedTrailing>
    <LiveActivityUIExpandedBottom>
      <VStack alignment="leading" spacing={3} frame={{ maxWidth: Infinity, alignment: "leading" }} foregroundStyle="white">
        <AccessLine {...state} />
        <HStack spacing={8}>
          <Text font={10} foregroundStyle="rgba(255,255,255,0.50)">
            {state.networkType === "wifi" ? "Wi-Fi / 热点" : state.networkType === "cellular" ? "蜂窝网络" : "网络不可用"}
          </Text>
          <Spacer />
          <Text font={11} foregroundStyle="rgba(255,255,255,0.65)" monospacedDigit>
            发送 {state.sent} · 接收 {state.received}
          </Text>
        </HStack>
      </VStack>
    </LiveActivityUIExpandedBottom>
  </LiveActivityUI>
)

export const LanTransferActivity = LiveActivity.register(TRANSFER_ACTIVITY_NAME, builder)
