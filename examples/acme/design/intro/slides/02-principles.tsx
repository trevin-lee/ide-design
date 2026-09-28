import { Slide, Stack, Row, Text, Em, Divider, List } from "ided";
import { CornerMark } from "@brand/components/corner-mark";
import { Footer } from "@brand/components/footer";

export default function Principles() {
  return (
    <Slide surface="paper" justify="between">
      <CornerMark />
      <Text type="label" color="muted">
        Principles
      </Text>
      <Row gap="4xl" align="start">
        <Stack gap="l" width="1/2">
          <Text type="title">
            One way to <Em color="accent">do everything.</Em>
          </Text>
        </Stack>
        <Divider color="line" weight="hairline" />
        <Stack gap="xl" grow>
          <List
            type="subhead"
            gap="l"
            marker="number"
            items={[
              "Values are tokens, never literals.",
              "Layout is Stack, Row, Grid and Place.",
              "Text is a type style, never a font size.",
              "Nested corners are concentric by construction.",
            ]}
          />
        </Stack>
      </Row>
      <Footer label="Acme" />
    </Slide>
  );
}
