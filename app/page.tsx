import { redirect } from "next/navigation";
import { ensureProfileSeed } from "@/lib/cloudflare-profile-seed";

export default async function Home() {
  await ensureProfileSeed();
  redirect("/game/index.html");
}
