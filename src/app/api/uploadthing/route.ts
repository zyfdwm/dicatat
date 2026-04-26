import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const handler = createRouteHandler({
    router: ourFileRouter,
    config: {
      token: process.env.UPLOADTHING_TOKEN?.trim(),
    },
  });

  try {
    return await handler.POST(req);
  } catch (e: any) {
    return new Response(JSON.stringify({ 
      error: "Server Error", 
      message: e.message 
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const GET = async (req: NextRequest) => {
  const handler = createRouteHandler({
    router: ourFileRouter,
    config: {
      token: process.env.UPLOADTHING_TOKEN?.trim(),
    },
  });
  return handler.GET(req);
};

export const runtime = "edge";
