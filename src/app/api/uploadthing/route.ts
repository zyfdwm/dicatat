import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  // UploadThing v7 secara otomatis akan mencari UPLOADTHING_TOKEN di process.env
});

export const runtime = "edge";
