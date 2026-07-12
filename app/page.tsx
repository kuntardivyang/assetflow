import { redirect } from "next/navigation";

// Entry point — middleware sends unauthenticated users to /login.
export default function Home() {
  redirect("/dashboard");
}
