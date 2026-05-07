// TLP PRO SIMPLIFICADO - FUNCIONA 100%
class SimpleTLPEngine {
    constructor() {
        this.entries = JSON.parse(localStorage.getItem('tlpEntries')) || [];
        this.recording = false;
        this.audioBlob = null;
    }

    async startRecord() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio: true});
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
            this.mediaRecorder.onstop = () => {
                this.audioBlob = new Blob(this.audioChunks, {type: 'audio/webm'});
                const url = URL.createObjectURL(this.audioBlob);
                document.getElementById('playback').src = url;
                document.getElementById('audioPreview').style.display = 'block';
            };
            
            this.mediaRecorder.start();
            this.recording = true;
            document.getElementById('recordBtn').textContent = '⏹️ Parar';
            document.getElementById('recordBtn').classList.add('recording');
            this.timer();
        } catch(e) {
            alert('❌ Micrófono: ' + e.message + '\nAjustes→Chrome→Micrófono→Permitir');
        }
    }

    stopRecord() {
        if (this.mediaRecorder && this.recording) {
            this.mediaRecorder.stop();
            this.recording = false;
            document.getElementById('recordBtn').textContent = '🎙️ Grabar';
            document.getElementById('recordBtn').classList.remove('recording');
        }
    }

    timer() {
        let sec = 0;
        this.interval = setInterval(() => {
            sec++;
            document.getElementById('timer').textContent = 
                Math.floor(sec/60).toString().padStart(2,'0') + ':' + 
                (sec%60).toString().padStart(2,'0');
        }, 1000);
    }

    saveEntry() {
        const entry = {
            date: new Date().toISOString(),
            emotions: document.getElementById('emotions').value,
            thoughts: document.getElementById('thoughts').value,
            intensity: document.getElementById('intensity').value,
            audio: this.audioBlob ? 'yes' : 'no'
        };
        this.entries.unshift(entry);
        localStorage.setItem('tlpEntries', JSON.stringify(this.entries));
        this.showSuggestion(entry);
        this.clearForm();
        this.showEntries();
        this.sendWhatsApp(entry);
    }

    sendWhatsApp(entry) {
        const msg = `📱 TLP PRO\n😰 ${entry.intensity}/10\n💭 ${entry.emotions}\n${entry.thoughts.substring(0,100)}`;
        window.open(`https://wa.me/+34643370361?text=${encodeURIComponent(msg)}`);
    }

    showSuggestion(entry) {
        const sug = entry.intensity > 7 ? '🛑 STOP' : 
                   entry.emotions.includes('ansiedad') ? '🌬️ Respirar' : '💖 Autocompasión';
        document.getElementById('suggestion').innerHTML = `<h3>${sug}</h3>`;
        document.getElementById('suggestionSection').style.display = 'block';
    }

    clearForm() {
        document.getElementById('emotions').value = '';
        document.getElementById('thoughts').value = '';
        document.getElementById('intensity').value = 5;
        document.getElementById('audioPreview').style.display = 'none';
        clearInterval(this.interval);
        document.getElementById('timer').textContent = '00:00';
        document.getElementById('recordBtn').textContent = '🎙️ Grabar';
        document.getElementById('recordBtn').classList.remove('recording');
    }

    showEntries() {
        document.getElementById('entries').innerHTML = 
            this.entries.slice(0,5).map(e => 
                `<div class="entry">
                    <strong>${new Date(e.date).toLocaleString()}</strong>
                    <div>😰 ${e.intensity}/10</div>
                    <div>${e.emotions}</div>
                </div>`
            ).join('');
    }
}

const tlp = new SimpleTLPEngine();

// EVENTOS
document.getElementById('recordBtn').onclick = () => {
    if (tlp.recording) tlp.stopRecord();
    else tlp.startRecord();
};

document.getElementById('saveBtn').onclick = () => tlp.saveEntry();

tlp.showEntries();
