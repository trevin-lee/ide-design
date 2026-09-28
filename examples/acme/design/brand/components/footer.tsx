import { FrameNumber, Row, Text } from "ided";

/** Brand name and frame number along the bottom edge. */
export function Footer(props: { label: string }) {
  return (
    <Row justify="between" align="end">
      <Text type="label">{props.label}</Text>
      <Text type="label">
        <FrameNumber format="nn" />
      </Text>
    </Row>
  );
}
