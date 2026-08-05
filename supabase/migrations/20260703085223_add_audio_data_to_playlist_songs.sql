-- Add audio_data column to store base64-encoded audio for cross-session employee playback
ALTER TABLE playlist_songs
  ADD COLUMN IF NOT EXISTS audio_data text;
