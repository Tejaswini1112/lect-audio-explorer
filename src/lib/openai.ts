import OpenAI from 'openai';

// Removed API key for security
const openai = new OpenAI({
  dangerouslyAllowBrowser: true,
  maxRetries: 3, // Add retries for better reliability
  timeout: 300000, // 5 minutes timeout
});

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TopicSegment {
  topic: string;
  start: number;
  end: number;
  description: string;
}

async function chunkAudioFile(file: File, chunkSize: number = 25 * 1024 * 1024): Promise<File[]> {
  const chunks: File[] = [];
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end, file.type);
    chunks.push(new File([chunk], `${file.name}.part${i + 1}`, { type: file.type }));
  }
  
  return chunks;
}

export async function transcribeAudio(audioFile: File): Promise<TranscriptionSegment[]> {
  try {
    console.log('Starting transcription for file:', audioFile.name, 'Size:', audioFile.size);
    
    // For files larger than 25MB, split into chunks
    const CHUNK_SIZE = 25 * 1024 * 1024; // 25MB chunks
    let allSegments: TranscriptionSegment[] = [];
    
    if (audioFile.size > CHUNK_SIZE) {
      console.log('File is large, splitting into chunks...');
      const chunks = await chunkAudioFile(audioFile, CHUNK_SIZE);
      console.log(`Split into ${chunks.length} chunks`);
      
      let timeOffset = 0;
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        try {
          const response = await openai.audio.transcriptions.create({
            file: chunks[i],
            model: 'whisper-1',
            response_format: 'verbose_json',
          });
          
          // Adjust timestamps for each chunk
          const chunkSegments = response.segments.map(segment => ({
            start: segment.start + timeOffset,
            end: segment.end + timeOffset,
            text: segment.text
          }));
          
          allSegments = [...allSegments, ...chunkSegments];
          timeOffset = allSegments[allSegments.length - 1].end;
          
          // Add a small delay between chunks to avoid rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (chunkError) {
          console.error(`Error processing chunk ${i + 1}:`, chunkError);
          throw new Error(`Failed to process chunk ${i + 1}: ${chunkError.message}`);
        }
      }
    } else {
      // Process smaller files normally
      const response = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
      });
      
      allSegments = response.segments.map(segment => ({
        start: segment.start,
        end: segment.end,
        text: segment.text
      }));
    }

    console.log('Transcription complete. Total segments:', allSegments.length);
    return allSegments;
  } catch (error) {
    console.error('Detailed transcription error:', {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

export async function detectTopics(transcription: TranscriptionSegment[]): Promise<TopicSegment[]> {
  try {
    console.log('Starting topic detection for transcript length:', transcription.length);
    const combinedText = transcription.map(seg => seg.text).join(' ');
    
    const prompt = `Analyze this lecture transcript and identify the main topics covered. 
    For each topic, provide:
    1. The topic name
    2. When it starts and ends (in seconds)
    3. A brief description of what was discussed
    
    Format the response as a JSON array of objects with these fields:
    - topic: string
    - start: number (seconds)
    - end: number (seconds)
    - description: string
    
    Transcript: ${combinedText}`;

    console.log('Sending request to GPT-4 for topic detection');
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes lecture transcripts to identify topics and their timestamps.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    });

    console.log('Topic detection response received');
    const result = JSON.parse(response.choices[0].message.content);
    return result.topics;
  } catch (error) {
    console.error('Detailed topic detection error:', {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    throw new Error(`Topic detection failed: ${error.message}`);
  }
} 