export class AudioProcessor {
  private audioContext: AudioContext;
  private audioElement: HTMLAudioElement;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private isLoaded: boolean = false;
  private loadError: string | null = null;
  private objectUrl: string | null = null;

  constructor() {
    try {
      console.log('Initializing AudioProcessor');
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioElement = new Audio();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      
      // Add error listener
      this.audioElement.addEventListener('error', (e) => {
        console.error('Audio element error:', e);
        this.loadError = 'Audio element error occurred';
      });
    } catch (error: any) {
      console.error('Failed to initialize audio context:', error);
      // Create empty objects to prevent null reference errors
      this.audioContext = {} as AudioContext;
      this.audioElement = {} as HTMLAudioElement;
      this.gainNode = {} as GainNode;
      this.loadError = `Failed to initialize audio system: ${error.message || 'Unknown error'}`;
    }
  }

  async loadAudio(file: File): Promise<void> {
    if (!file) {
      const error = 'No file provided to loadAudio';
      console.error(error);
      this.loadError = error;
      throw new Error(error);
    }
    
    console.log(`Loading audio file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
    
    try {
      // Reset state
      this.isLoaded = false;
      this.loadError = null;
      
      // Clean up previous object URL if exists
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
      }
      
      // Create a promise to handle the audio element loading
      const audioLoadPromise = new Promise<void>((resolve, reject) => {
        const handleCanPlay = () => {
          this.audioElement.removeEventListener('canplaythrough', handleCanPlay);
          this.audioElement.removeEventListener('error', handleError);
          console.log('Audio element ready to play');
          resolve();
        };
        
        const handleError = (e: Event) => {
          this.audioElement.removeEventListener('canplaythrough', handleCanPlay);
          this.audioElement.removeEventListener('error', handleError);
          console.error('Audio element error during load:', e);
          reject(new Error('Failed to load audio file'));
        };
        
        this.audioElement.addEventListener('canplaythrough', handleCanPlay);
        this.audioElement.addEventListener('error', handleError);
      });
      
      // Create and set object URL
      this.objectUrl = URL.createObjectURL(file);
      this.audioElement.src = this.objectUrl;
      this.audioElement.load(); // Explicitly call load to start loading
      
      // Also decode the audio data for precise playback
      try {
        const arrayBuffer = await file.arrayBuffer();
        console.log('File converted to ArrayBuffer, decoding...');
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        console.log(`Audio decoded successfully. Duration: ${this.audioBuffer.duration}s`);
      } catch (decodeError: any) {
        console.error('Error decoding audio data:', decodeError);
        this.loadError = `Failed to decode audio: ${decodeError.message || 'Unknown error'}`;
        // We'll continue with the audio element even if decoding fails
      }
      
      // Wait for the audio element to be ready
      await audioLoadPromise;
      
      this.isLoaded = true;
      console.log('Audio loaded successfully');
    } catch (error: any) {
      console.error('Error loading audio:', error);
      this.isLoaded = false;
      this.loadError = `Error loading audio: ${error.message || 'Unknown error'}`;
      throw error;
    }
  }

  async playSegment(startTime: number, duration: number = 120): Promise<void> {
    console.log(`playSegment called with startTime: ${startTime}, duration: ${duration}`);
    
    if (!this.isLoaded) {
      const error = this.loadError || 'Audio not loaded properly';
      console.error(error);
      throw new Error(error);
    }

    // Validate start time
    if (typeof startTime !== 'number' || isNaN(startTime)) {
      console.error(`Invalid start time: ${startTime}`);
      throw new Error('Invalid start time');
    }
    
    try {
      // Stop any currently playing audio
      this.stop();
      
      // Ensure start time is within bounds
      if (startTime < 0) {
        console.warn('Negative start time adjusted to 0');
        startTime = 0;
      }
      
      let actualDuration = duration;
      
      if (this.audioBuffer && startTime > this.audioBuffer.duration) {
        console.warn(`Start time (${startTime}) exceeds audio duration (${this.audioBuffer.duration}), adjusting to beginning`);
        startTime = 0;
      }
      
      // Create a source node for precise playback if we have a buffer
      if (this.audioBuffer) {
        // Calculate duration to ensure we don't exceed the audio length
        const maxDuration = this.audioBuffer.duration - startTime;
        actualDuration = Math.min(duration, maxDuration);
        
        console.log(`Will play from ${startTime}s for ${actualDuration}s duration`);
        
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.connect(this.gainNode);
        this.sourceNode.start(0, startTime, actualDuration);
        console.log('Started playback via AudioBufferSourceNode');
      }
      
      // Also use the audio element as backup
      try {
        this.audioElement.currentTime = startTime;
        await this.audioElement.play();
        console.log('Audio playback started via audio element');
      } catch (elementError) {
        console.error('Error playing via audio element:', elementError);
        // If buffer playback is working, we can ignore this error
        if (!this.sourceNode) {
          throw elementError; // Re-throw only if we have no backup playback
        }
      }
    } catch (error: any) {
      console.error('Error playing audio segment:', error);
      throw new Error(`Failed to play audio: ${error.message || 'Unknown error'}`);
    }
  }
  
  stop(): void {
    try {
      // Stop source node if it exists
      if (this.sourceNode) {
        try {
          this.sourceNode.stop();
          this.sourceNode.disconnect();
          console.log('Stopped audio buffer source');
        } catch (e) {
          // Ignore errors from stopping (might already be stopped)
          console.warn('Error stopping source node:', e);
        }
        this.sourceNode = null;
      }
      
      // Pause the audio element
      try {
        this.audioElement.pause();
        console.log('Paused audio element');
      } catch (e) {
        console.warn('Error pausing audio element:', e);
      }
    } catch (error) {
      console.error('Error in stop method:', error);
      // Don't throw from stop method
    }
  }
  
  cleanup(): void {
    try {
      this.stop();
      
      // Revoke object URL if we have one
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;
        console.log('Revoked object URL');
      }
      
      // Clear the buffer
      this.audioBuffer = null;
      this.isLoaded = false;
      
      console.log('AudioProcessor cleaned up');
    } catch (error) {
      console.error('Error cleaning up AudioProcessor:', error);
      // Don't throw from cleanup
    }
  }
  
  getDuration(): number {
    return this.audioBuffer?.duration || 0;
  }
  
  isAudioLoaded(): boolean {
    return this.isLoaded;
  }
  
  getLoadError(): string | null {
    return this.loadError;
  }
}
