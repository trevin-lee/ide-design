import { Divider, Row, Slide, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";

const decisions = [
  { code: 'gap="l"', meaning: "24 pixels, the same on every slide, page, post and screen." },
  { code: '<Text type="body">', meaning: "Size, weight, leading and tracking chosen once, as a unit." },
  { code: 'surface="ink"', meaning: "A background that brings its own legible text and logo colors." },
  { code: 'radius="concentric"', meaning: "An inner corner computed from the corner around it." },
];

export default function OneWay() {
  return (
    <Slide surface="paper" gap="4xl">
      <CornerMark />
      <Stack width="2/3">
        <Text type="title">There is one way to write each design decision.</Text>
      </Stack>
      <Stack gap="xl">
        {decisions.map((d) => (
          <Stack key={d.code} gap="xl">
            <Divider color="line" weight="hairline" />
            <Row gap="2xl" align="start">
              <Stack width="1/3">
                <Text type="code">{d.code}</Text>
              </Stack>
              <Stack grow>
                <Text type="body">{d.meaning}</Text>
              </Stack>
            </Row>
          </Stack>
        ))}
      </Stack>
    </Slide>
  );
}
