import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";
import { NextRequest } from "next/server";

const handler = createRouteHandler({
  router: ourFileRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN?.trim(),
  },
});

export const POST = async (req: NextRequest) => {
  try {
    const res = await handler.POST(req);
    return res;
  } catch (e: any) {
    return new Response(JSON.stringify({ 
      error: "Server Error", 
      message: e.message,
      cause: e.cause 
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const GET = handler.GET;
export const runtime = "edge";
