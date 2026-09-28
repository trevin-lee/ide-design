import { Slide, Grid, Box, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";
import { Footer } from "@brand/components/footer";

const stats = [
  { value: "0", label: "raw pixel values in this deck" },
  { value: "16", label: "primitives in the whole vocabulary" },
  { value: "1", label: "brand file every medium reads from" },
];

export default function Numbers() {
  return (
    <Slide surface="sand" justify="between">
      <CornerMark />
      <Text type="heading">Constraints you can count.</Text>
      <Grid columns={3} gap="l">
        {stats.map((s) => (
          <Box key={s.label} surface="paper" pad="2xl" radius="l">
            <Stack gap="m">
              <Text type="display">{s.value}</Text>
              <Text type="body" color="muted">
                {s.label}
              </Text>
            </Stack>
          </Box>
        ))}
      </Grid>
      <Footer label="Acme" />
    </Slide>
  );
}
