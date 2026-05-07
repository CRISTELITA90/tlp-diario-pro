class AudioEngine {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
    }

    async init() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            this.stream = stream;
            console.log('✅ Micrófono OK');
            return true;
        } catch (err) {
            console.error('❌ Mic error:', err);
            alert('Micrófono bloqueado. Ajustes → Chrome → Micrófono → Permitir');
            return false;
        }
    }

    startRecording() {
        if (!this.stream) {
            alert('Micrófono no disponible');
            return;
        }
        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(this.stream);
        
        this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
        this.mediaRecorder.onstop = () => this.createPlayback();
        
        this.mediaRecorder.start(250);
        this.isRecording = true;
        this.startTimer();
        document.getElementById('recordBtn').classList.add('recording');
    }

    stopRecording() {
        if (this.mediaRecorder?.state === 'recording') {
            this.mediaRecorder.stop();
        }
        this.isRecording = false;
        this.stopTimer();
        document.getElementById('recordBtn').classList.remove('recording');
    }

    startTimer() {
        let seconds = 0;
        this.timer = setInterval(() => {
            seconds++;
            const min = Math.floor(seconds/60).toString().padStart(2,'0');
            const sec = (seconds%60).toString().padStart(2,'0');
            document.getElementById('recordingTimer').textContent = `${min}:${sec}`;
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.timer);
    }

    createPlayback() {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        document.getElementById('playbackAudio').src = url;
        document.getElementById('audioPreview').classList.remove('hidden');
    }

    clearAudio() {
        URL.revokeObjectURL(document.getElementById('playbackAudio').src);
        document.getElementById('audioPreview').classList.add('hidden');
        document.getElementById('voiceTranscript').value = '';
    }
}

const audioEngine = new AudioEngine();
