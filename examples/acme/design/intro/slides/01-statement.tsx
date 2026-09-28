import { Logo, Slide, Stack, Text } from "ided";

export default function Statement() {
  return (
    <Slide surface="ink" justify="between">
      <Logo variant="horizontal" size="m" />
      <Stack gap="xl" width="3/4">
        <Text type="display">Design as code.</Text>
        <Text type="subhead">Every value here comes from one file. Change it, and everything follows.</Text>
      </Stack>
    </Slide>
  );
}
