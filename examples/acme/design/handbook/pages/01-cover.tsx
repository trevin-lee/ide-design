import { Page, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";

export default function Cover() {
  return (
    <Page surface="paper" justify="end">
      <CornerMark />
      <Stack gap="l">
        <Text type="title">Acme Handbook</Text>
        <Text type="subhead" color="muted">
          Replace with a one-line summary.
        </Text>
      </Stack>
    </Page>
  );
}
