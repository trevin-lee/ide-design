import { Box, Stack, Text, type SurfaceToken } from "ided";

/** Describe when to use Card. Props take tokens, never raw values. */
export function Card(props: { title: string; body: string; surface?: SurfaceToken }) {
  return (
    <Box surface={props.surface ?? "paper"} pad="2xl" radius="l">
      <Stack gap="m">
        <Text type="subhead">{props.title}</Text>
        <Text type="body" color="muted">
          {props.body}
        </Text>
      </Stack>
    </Box>
  );
}
