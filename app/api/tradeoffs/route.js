import { createApiHandler } from "../../../lib/handleApi";
import { validateTradeoffRequest } from "../../../lib/validate";
import { runTradeoffs } from "../../../ai/tradeoffs";

export const runtime = "nodejs";
// A Gemini call can take several seconds (and a retry doubles that), so don't rely on the host's default limit.
export const maxDuration = 60;

export const POST = createApiHandler({ name: "tradeoffs", validate: validateTradeoffRequest, run: runTradeoffs });
