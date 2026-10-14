import {getDatabase} from "@atlas/database";
import {agentConfig} from "@/lib/agent/config";
import {healthResponse} from "@/lib/health";

export const dynamic = "force-dynamic";

export function GET() {
  return healthResponse({database: getDatabase, aiConfigured: () => agentConfig().configured});
}
