import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({
    hasToken: !!process.env.UPLOADTHING_TOKEN,
    hasUrl: !!process.env.UPLOADTHING_URL,
    hasSecret: !!process.env.UPLOADTHING_SECRET,
    nodeEnv: process.env.NODE_ENV,
    // Kita cuma cek ADA atau ENGGAK, bukan isinya (biar aman)
  });
}
