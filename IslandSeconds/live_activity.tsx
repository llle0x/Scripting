import {
  DateLabel, HStack, LiveActivity, LiveActivityUI,
  LiveActivityUIBuilder, LiveActivityUIExpandedLeading, Text,
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

const builder: LiveActivityUIBuilder<ClockState> = state => (
  <LiveActivityUI
    content={<Seconds {...state} />}
    compactLeading={<Seconds {...state} />}
    compactTrailing={<Text frame={{ width: 0, height: 0 }}>{""}</Text>}
    minimal={<Seconds {...state} />}
  >
    <LiveActivityUIExpandedLeading>
      <Seconds {...state} />
    </LiveActivityUIExpandedLeading>
  </LiveActivityUI>
)

export const SecondsActivity = LiveActivity.register(ACTIVITY_NAME, builder)
