import {
  DateLabel,
  HStack,
  Image,
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIBuilder,
  LiveActivityUIExpandedBottom,
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

function connectedSummary(state: TransferActivityState): string {
  return state.deviceCount === 0 ? state.address : state.deviceSummary
}

function StatusIcon({ online }: { online: boolean }) {
  return <Image systemName={online ? "link.circle.fill" : "wifi"} foregroundStyle="systemBlue" />
}

function ClockRow({ clockBase }: { clockBase: number }) {
  const date = new Date(clockBase)
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]
  return <HStack spacing={8} foregroundStyle="white">
    <Image systemName="clock.fill" font={12} foregroundStyle="systemBlue" />
    <DateLabel date={date} style="timer" font={20} fontWeight="semibold" monospacedDigit />
    <Text font={11} foregroundStyle="rgba(255,255,255,0.65)" lineLimit={1}>
      {`${date.getMonth() + 1}/${date.getDate()} ${weekday}`}
    </Text>
  </HStack>
}

function LockScreenContent(state: TransferActivityState) {
  const connected = state.deviceCount > 0
  return (
    <VStack alignment="leading" spacing={5} padding={10} activityBackgroundTint="rgba(12,16,24,0.96)" foregroundStyle="white">
      <ClockRow clockBase={state.clockBase} />
      <HStack spacing={8}>
      <StatusIcon online={connected} />
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: Infinity }}>
        <Text font={12} fontWeight="semibold" lineLimit={1}>{connectedTitle(state)}</Text>
        <Text font="caption" foregroundStyle="rgba(255,255,255,0.65)" lineLimit={1}>
          {connectedSummary(state)}
        </Text>
      </VStack>
      <VStack alignment="trailing" spacing={3}>
        <Text font="caption" foregroundStyle="rgba(255,255,255,0.65)">配对码</Text>
        <Text font={15} fontWeight="bold" monospacedDigit>{state.pairingCode}</Text>
      </VStack>
      </HStack>
    </VStack>
  )
}

const builder: LiveActivityUIBuilder<TransferActivityState> = state => (
  <LiveActivityUI
    content={<LockScreenContent {...state} />}
    compactLeading={<Seconds clockBase={state.clockBase} />}
    compactTrailing={<Text frame={{ width: 0, height: 0 }}>{""}</Text>}
    minimal={<Seconds clockBase={state.clockBase} />}>
    {/* Scripting requires an expanded-region child even when it has no visible content. */}
    <LiveActivityUIExpandedBottom>
      <Text frame={{ width: 0, height: 0 }}>{""}</Text>
    </LiveActivityUIExpandedBottom>
  </LiveActivityUI>
)

export const LanTransferActivity = LiveActivity.register(TRANSFER_ACTIVITY_NAME, builder)
