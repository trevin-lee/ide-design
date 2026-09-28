import { Box, Row, Slide, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";

export default function Concentric() {
  return (
    <Slide surface="paper" justify="center">
      <CornerMark />
      <Row gap="4xl" align="center">
        <Stack gap="l" width="2/5">
          <Text type="title">Corners that line up.</Text>
          <Text type="body" color="muted">
            Nested corners share a center when the inner radius is the outer radius minus the padding
            between them. Write radius="concentric" and the framework does the arithmetic, at any size.
          </Text>
        </Stack>
        <Box surface="ink" pad="l" radius="xl" grow>
          <Box surface="accent" pad="m" radius="concentric" ratio="16:9">
            <Box surface="paper" pad="l" radius="concentric" grow>
              <Text type="code">radius="concentric"</Text>
            </Box>
          </Box>
        </Box>
      </Row>
    </Slide>
  );
}
