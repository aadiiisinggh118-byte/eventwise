import { createApiHandler } from "../../../lib/handleApi";
import { validateIdeasRequest } from "../../../lib/validate";
import { runIdeas } from "../../../ai/ideas";

export const runtime = "nodejs";
// A Gemini call can take several seconds (and a retry doubles that), so don't rely on the host's default limit.
export const maxDuration = 60;

export const POST = createApiHandler({ name: "ideas", validate: validateIdeasRequest, run: runIdeas });
