import { exportUserData } from "@/app/_actions/account";

export async function GET() {
  const data = await exportUserData();
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="eventide-export.json"',
    },
  });
}
