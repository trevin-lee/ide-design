import { Slide, Stack, Text, Logo } from "ided";
import { Footer } from "@brand/components/footer";

export default function Title() {
  return (
    <Slide surface="ink" justify="between">
      <Logo variant="horizontal" size="m" />
      <Stack gap="xl" width="3/4">
        <Text type="display">Design as code.</Text>
        <Text type="subhead">
          Every value comes from the brand. Every layout is a function. Nothing is eyeballed.
        </Text>
      </Stack>
      <Footer label="Acme" />
    </Slide>
  );
}
