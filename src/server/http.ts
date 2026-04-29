import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { CLIENT_DIR } from "./config";

const STATIC_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export function send(res: ServerResponse, status: number, body: string | Buffer, contentType: string): void {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf-8");
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": buffer.byteLength,
    "Cache-Control": "no-store",
  });
  res.end(buffer);
}

export function sendJson(res: ServerResponse, status: number, obj: unknown): void {
  send(res, status, JSON.stringify(obj), "application/json; charset=utf-8");
}

export function sendJsonCacheable(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  obj: unknown,
): void {
  if (status !== 200) return sendJson(res, status, obj);
  const body = JSON.stringify(obj);
  const etag = `W/"${createHash("sha1").update(body).digest("base64url")}"`;
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, { ETag: etag, "Cache-Control": "no-store" });
    res.end();
    return;
  }
  const buffer = Buffer.from(body, "utf-8");
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": buffer.byteLength,
    "Cache-Control": "no-store",
    ETag: etag,
  });
  res.end(buffer);
}

export async function sendStaticFile(res: ServerResponse, path: string): Promise<boolean> {
  const cleanPath = path.replace(/^\/+/, "");
  const filePath = resolve(CLIENT_DIR, cleanPath);
  if (!filePath.startsWith(CLIENT_DIR)) return false;
  try {
    const body = await readFile(filePath);
    send(res, 200, body, STATIC_TYPES[extname(filePath)] ?? "application/octet-stream");
    return true;
  } catch {
    return false;
  }
}
