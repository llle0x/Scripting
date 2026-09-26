import {
  DateLabel, HStack, Image, LiveActivity, LiveActivityUI,
  LiveActivityUIBuilder, LiveActivityUIExpandedBottom, Text, VStack,
} from "scripting"

export const ACTIVITY_NAME = "IslandSecondsClock"
export type ClockState = { origin: number }

// Native timer text updates in the system host after the script exits.
// Keep its rightmost two digits, hiding the minutes/hours and colon.
// Give native timer text a real layout width, align its glyphs right, then crop.
// fixedSize is unsuitable here: native timer text can have a flexible ideal width.
function Seconds({ origin }: ClockState) {
  return (
    <HStack spacing={0} frame={{ width: 19, height: 21, alignment: "trailing" }} clipped>
      <DateLabel
        date={new Date(origin)}
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

function ClockDetails({ origin, compact = false }: ClockState & { compact?: boolean }) {
  // origin is one minute before the last synchronization minute.
  const synchronized = new Date(origin + 60_000)
  const midnight = new Date(synchronized)
  midnight.setHours(0, 0, 0, 0)
  const date = `${synchronized.getFullYear()}年${synchronized.getMonth() + 1}月${synchronized.getDate()}日`
  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][synchronized.getDay()]
  if (compact) {
    return (
      <HStack spacing={10} foregroundStyle="white">
        <Image systemName="clock.fill" font={13} foregroundStyle="systemBlue" />
        <DateLabel date={midnight} style="timer" font={22} fontWeight="semibold" monospacedDigit />
        <Text font={11} foregroundStyle="rgba(255,255,255,0.70)" lineLimit={1}>
          {`${synchronized.getMonth() + 1}/${synchronized.getDate()} ${weekday}`}
        </Text>
      </HStack>
    )
  }
  return (
    <VStack alignment="leading" spacing={8} foregroundStyle="white">
      <DateLabel date={midnight} style="timer" font={32} fontWeight="semibold" monospacedDigit
        frame={{ maxWidth: Infinity, alignment: "leading" }} />
      <HStack spacing={6}>
        <Image systemName="calendar" font={12} foregroundStyle="systemBlue" />
        <Text font={13} foregroundStyle="rgba(255,255,255,0.75)" lineLimit={1}>{date} · {weekday}</Text>
      </HStack>
      <Text font={10} foregroundStyle="rgba(255,255,255,0.45)">本地时间 · 跨日后请重新对时</Text>
    </VStack>
  )
}

function ClockTitle() {
  return <HStack spacing={6}>
    <Image systemName="clock.fill" font={14} foregroundStyle="systemBlue" />
    <Text font={13} fontWeight="semibold" foregroundStyle="white">灵动岛秒数</Text>
  </HStack>
}

const builder: LiveActivityUIBuilder<ClockState> = state => (
  <LiveActivityUI
    content={<HStack spacing={0} padding={10}>
      <ClockDetails {...state} compact />
    </HStack>}
    compactLeading={<Seconds {...state} />}
    compactTrailing={<Text frame={{ width: 0, height: 0 }}>{""}</Text>}
    minimal={<Seconds {...state} />}
  >
    <LiveActivityUIExpandedBottom>
      <ClockDetails {...state} compact />
    </LiveActivityUIExpandedBottom>
  </LiveActivityUI>
)

export const SecondsActivity = LiveActivity.register(ACTIVITY_NAME, builder)
