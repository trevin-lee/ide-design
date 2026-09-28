import { Box, Em, Slide, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";

export default function TheCheck() {
  return (
    <Slide surface="paper" gap="3xl" justify="center">
      <CornerMark />
      <Stack width="2/3">
        <Text type="title">An off-brand value does not compile.</Text>
      </Stack>
      <Box surface="ink" pad={["2xl", "3xl"]} radius="l">
        <Stack gap="s">
          <Text type="code">$ ided check</Text>
          <Text type="code">design/intro/slides/02-one-way.tsx</Text>
          <Text type="code">
            {"  "}9:14 <Em color="accent">error</Em> {'<Stack> `gap` got "16px", which is not a space token.'}
          </Text>
          <Text type="code">{"       → Use one of: none, 2xs, xs, s, m, l, xl, 2xl, 3xl, 4xl, 5xl, 6xl."}</Text>
        </Stack>
      </Box>
    </Slide>
  );
}
