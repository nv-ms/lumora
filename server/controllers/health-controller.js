import { sendJson } from "../services/http-service.js";

export async function health({ res }) {
  return sendJson(res, 200, { ok: true });
}
