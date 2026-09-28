import { Slide, Row, Stack, Text, Image } from "ided";
import { Card } from "@kit/components/card";
import hero from "@kit/assets/photos/hero.png";

export default function Kit() {
  return (
    <Slide surface="sand" gap="2xl">
      <Text type="heading">Shared from the kit.</Text>
      <Row gap="l" grow>
        <Image src={hero} alt="Gradient hero" width="2/3" radius="l" />
        <Stack gap="l" grow>
          <Card title="Components" body="Imported by package path." />
          <Card title="Assets" body="Typed, so a typo is a compile error." />
        </Stack>
      </Row>
    </Slide>
  );
}
