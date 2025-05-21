export interface AudioFile {
  name: string;
  size: number;
  type: string;
  url: string;
  file?: File; // Add the actual File object for API calls
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface Topic {
  id: string;
  title: string;
  start: number;
  end: number;
  description: string;
  segments: number[];
}

export interface Transcript {
  text: string;
  segments: TranscriptionSegment[];
}

export interface TranscriptionResponse {
  transcript: Transcript;
  topics: Topic[];
}

export interface APIErrorResponse {
  error: string;
}
