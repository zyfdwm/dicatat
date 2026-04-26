import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const VERCEL_URL = "https://upload-server-five.vercel.app/api/uploadthing";

async function proxy(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const targetUrl = `${VERCEL_URL}${url.search}`;

    const headers = new Headers(req.headers);
    headers.delete("host"); // Important: let fetch resolve the host
    
    // Some headers might cause issues when proxying
    headers.delete("connection");

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.arrayBuffer();
    }

    const response = await fetch(targetUrl, init);
    const responseHeaders = new Headers(response.headers);
    
    // Make sure we allow CORS for this proxy response if needed
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { message: "Internal Proxy Error" },
      { status: 500 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
