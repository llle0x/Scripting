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
  if (state.deviceCount === 1) return `${state.primaryName} 已连接`
  return `${state.deviceCount} 台设备已连接`
}

function StatusIcon({ online }: { online: boolean }) {
  return <Image systemName={online ? "link" : "wifi"} font={16}
    frame={{ width: 20, height: 20 }} foregroundStyle="systemBlue" />
}

function LockScreenContent(state: TransferActivityState) {
  const connected = state.deviceCount > 0
  return (
    <HStack spacing={9} padding={12} activityBackgroundTint="rgba(12,16,24,0.96)" foregroundStyle="white">
      <StatusIcon online={connected} />
      <VStack alignment="leading" spacing={4} frame={{ maxWidth: Infinity, alignment: "leading" }}>
        <Text font={13} fontWeight="semibold" lineLimit={1}>{connectedTitle(state)}</Text>
        <Text font={11} foregroundStyle="rgba(255,255,255,0.65)" lineLimit={1} minScaleFactor={0.8}>
          {state.address}
        </Text>
      </VStack>
      <VStack alignment="trailing" spacing={3} frame={{ width: 72, alignment: "trailing" }}>
        <Text font={10} foregroundStyle="rgba(255,255,255,0.55)">配对码</Text>
        <Text font={17} fontWeight="semibold" monospacedDigit>{state.pairingCode}</Text>
      </VStack>
    </HStack>
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
          {state.deviceCount > 0 ? `${state.deviceCount} 台已连接` : "等待连接"}
        </Text>
      </HStack>
    </LiveActivityUIExpandedLeading>
    <LiveActivityUIExpandedTrailing>
      <HStack spacing={5}>
        <Text font={10} foregroundStyle="rgba(255,255,255,0.50)">配对码</Text>
        <Text font={16} fontWeight="semibold" foregroundStyle="white" monospacedDigit>{state.pairingCode}</Text>
      </HStack>
    </LiveActivityUIExpandedTrailing>
    <LiveActivityUIExpandedBottom>
      <VStack alignment="leading" spacing={3} frame={{ maxWidth: Infinity, alignment: "leading" }} foregroundStyle="white">
        <Text font={12} monospacedDigit lineLimit={1} minScaleFactor={0.8}>{state.address}</Text>
        {state.deviceSummary ? <Text font={11} foregroundStyle="rgba(255,255,255,0.72)" lineLimit={1}>
          {state.deviceSummary}{state.remainingCount > 0 ? ` · 另有 ${state.remainingCount} 台` : ""}
        </Text> : null}
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
