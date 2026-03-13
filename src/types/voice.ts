/* ─── Voice Studio Types ─── */

export type VoiceLanguage = 'auto' | 'ar' | 'en' | 'el' | 'tr' | 'es' | 'fr';

export type VoiceActionType =
  | 'create_event'
  | 'update_event_fields'
  | 'add_agenda_item'
  | 'update_agenda_item'
  | 'delete_agenda_item'
  | 'set_venue'
  | 'add_speaker'
  | 'update_speaker'
  | 'remove_speaker'
  | 'send_invitations'
  | 'publish_event'
  | 'request_manual_upload'
  | 'run_publish_readiness';

export interface VoiceActionEnvelope {
  id: string;
  type: VoiceActionType;
  target: { event_id?: string | null; draft_key?: string | null };
  payload: Record<string, unknown>;
  confidence: number; // 0..1
  source_text: string;
  language: string;
  requires_confirmation: boolean;
  requires_manual_step: boolean;
  manual_step: null | { field: 'client_logo' | 'event_banner' };
  created_at: string;
  source_chunk_id: string;
  action_group_id: string;
}

export interface TranscriptEntry {
  ts: string;
  text: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  chunk_id: string;
}

export interface EventSnapshot {
  event_id: string | null;
  draft_key: string | null;
  title: string | null;
  start_date: string | null; // YYYY-MM-DD
  venue_name: string | null;
  status: 'draft' | 'published';
  agenda_count: number;
  speaker_count: number;
  attendee_count: number;
  confirmed_count: number;
  readiness_percent: number;
}

export interface VoiceSession {
  id: string;
  user_id: string;
  event_id: string | null;
  draft_key: string | null;
  status: 'active' | 'paused' | 'archived';
  language_mode: VoiceLanguage;
  transcript: TranscriptEntry[];
  pending_actions: VoiceActionEnvelope[];
  confirmed_actions: VoiceActionEnvelope[];
  context: Record<string, unknown>;
  last_heard_at: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceParseResponse {
  pending_actions: VoiceActionEnvelope[];
  assistant_reply: string;
  missing_fields: string[];
}
