import { useState, useCallback, useEffect } from 'react';
import { transcribeAudio, detectTopics, type TranscriptionSegment, type TopicSegment } from '@/lib/openai';
import { AudioProcessor } from '@/lib/audio';

interface LectureState {
  file: File | null;
  isProcessing: boolean;
  error: string | null;
  transcription: TranscriptionSegment[];
  topics: TopicSegment[];
  currentTopic: TopicSegment | null;
  audioProcessor: AudioProcessor | null;
}

export function useLecture() {
  const [state, setState] = useState<LectureState>({
    file: null,
    isProcessing: false,
    error: null,
    transcription: [],
    topics: [],
    currentTopic: null,
    audioProcessor: null
  });

  // Initialize audio processor
  useEffect(() => {
    const processor = new AudioProcessor();
    setState(prev => ({ ...prev, audioProcessor: processor }));

    return () => {
      processor.cleanup();
    };
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setState(prev => ({ ...prev, error: 'Please upload an audio file' }));
      return;
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null, file }));

    try {
      // Load audio file
      if (state.audioProcessor) {
        await state.audioProcessor.loadAudio(file);
      }

      // Transcribe audio
      const transcription = await transcribeAudio(file);
      setState(prev => ({ ...prev, transcription }));

      // Detect topics
      const topics = await detectTopics(transcription);
      setState(prev => ({ ...prev, topics }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'An error occurred while processing the lecture' 
      }));
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.audioProcessor]);

  const playTopic = useCallback(async (topic: TopicSegment) => {
    if (!state.audioProcessor) {
      setState(prev => ({ ...prev, error: 'Audio processor not initialized' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, currentTopic: topic }));
      await state.audioProcessor.playSegment(topic.start);
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Error playing topic segment' 
      }));
    }
  }, [state.audioProcessor]);

  const stopPlayback = useCallback(() => {
    state.audioProcessor?.stop();
    setState(prev => ({ ...prev, currentTopic: null }));
  }, [state.audioProcessor]);

  return {
    ...state,
    handleFileUpload,
    playTopic,
    stopPlayback
  };
} 