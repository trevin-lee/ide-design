import { Slide, Row, Box, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";
import { Footer } from "@brand/components/footer";

export default function Concentric() {
  return (
    <Slide surface="paper" justify="between">
      <CornerMark />
      <Row gap="4xl" align="center" grow>
        <Stack gap="l" width="1/2">
          <Text type="heading">Corners that line up.</Text>
          <Text type="body" color="muted">
            An inner radius is the outer radius minus the padding between them. Write radius="concentric" and the
            framework does the arithmetic, at any size.
          </Text>
        </Stack>
        <Box surface="ink" pad="l" radius="xl" grow>
          <Box surface="accent" pad="m" radius="concentric" ratio="16:9">
            <Box surface="paper" pad="l" radius="concentric" grow>
              <Text type="label">radius = concentric</Text>
            </Box>
          </Box>
        </Box>
      </Row>
      <Footer label="Acme" />
    </Slide>
  );
}
