export type ActivityEvent = {
  id: string;
  actor_id: string | null;
  repository_id: string | null;
  event_type: string;
  metadata: Record<string, string>;
  created_at: string;
};
