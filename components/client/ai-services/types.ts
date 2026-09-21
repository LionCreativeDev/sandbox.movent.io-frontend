// AI Suggested IT Services — see App\Http\Controllers\Api\Client\
// DashboardController and App\Services\ClientAiServiceBatchService, which
// already personalizes this list (purchased modules + the client's own
// projects + what just triggered the latest batch) and regenerates it once
// 8 of the current 10 are 'taken' — both requirements this UI relies on
// rather than re-implements.
export type AiServiceStatus = 'available' | 'requested' | 'taken';

export interface AiService {
  // null for the pre-first-invoice bootstrap fallback catalog — that list
  // isn't backed by a persisted client_ai_service_batch_items row, so there's
  // no real id to send anywhere; `key` remains the stable identifier either way.
  id: number | null;
  key: string;
  name: string;
  category: string;
  summary: string;
  timeline: string;
  status: AiServiceStatus;
}
