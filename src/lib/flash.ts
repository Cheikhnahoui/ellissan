import { redirect } from "next/navigation";
export const flashOk = (path: string, msg: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
export const flashErr = (path: string, msg: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`);
