// React Email rewrite of the generic transactional template.
// Renders to inline-styled HTML that survives Gmail, Outlook, Apple Mail, etc.
import { render } from "@react-email/components";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface Args {
  heading: string;
  body: string; // paragraphs separated by \n\n
  cta?: { label: string; url: string };
}

function GenericEmail({ heading, body, cta }: Args) {
  const paragraphs = body.split("\n\n");
  return (
    <Html>
      <Head />
      <Preview>{paragraphs[0]?.slice(0, 90)}</Preview>
      <Body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", backgroundColor: "#fafafa", margin: 0 }}>
        <Container style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px", backgroundColor: "white" }}>
          <Heading style={{ fontSize: 20, fontWeight: 600, margin: "0 0 16px", color: "#111" }}>{heading}</Heading>
          <Section>
            {paragraphs.map((p, i) => (
              <Text key={i} style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 14px", color: "#333" }}>
                {p}
              </Text>
            ))}
          </Section>
          {cta && (
            <Section style={{ paddingTop: 16 }}>
              <Button
                href={cta.url}
                style={{
                  background: "#111",
                  color: "white",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {cta.label}
              </Button>
            </Section>
          )}
          <Text style={{ fontSize: 12, color: "#888", margin: "24px 0 0" }}>
            Eventide — community calendar.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderGenericEmail(args: Args): Promise<{ subject: string; html: string; text: string }> {
  const html = await render(<GenericEmail {...args} />);
  const text = `${args.heading}\n\n${args.body}${args.cta ? `\n\n${args.cta.label}: ${args.cta.url}` : ""}`;
  return { subject: args.heading, html, text };
}
