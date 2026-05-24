import { confirmEmailVerify } from "@/app/_actions/email-verify";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  // confirmEmailVerify always redirects, so this never renders past here.
  await confirmEmailVerify(token ?? "");
  return null;
}
