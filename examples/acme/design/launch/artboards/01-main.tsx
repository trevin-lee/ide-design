import { Artboard, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";

export default function Main() {
  return (
    <Artboard surface="paper" justify="end">
      <CornerMark />
      <Stack gap="l">
        <Text type="title">Launch Post</Text>
        <Text type="subhead" color="muted">
          Replace with a one-line summary.
        </Text>
      </Stack>
    </Artboard>
  );
}
