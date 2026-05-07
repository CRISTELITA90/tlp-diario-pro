class TLPPro {
    constructor() {
        this.recording = false;
        this.startTime = 0;
        this.timerId = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
    }

    async grabar() {
        try {
            // Pedir micrófono
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true,
                    noiseSuppression: true 
                } 
            });
            
            console.log('✅ Micrófono conectado');
            
            // Configurar grabador
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                document.getElementById('playbackAudio').src = audioUrl;
                document.getElementById('audioPreview').style.display = 'block';
                stream.getTracks().forEach(track => track.stop());
                console.log('✅ Audio guardado');
            };
            
            // INICIAR
            this.mediaRecorder.start(100); // Chunks cada 100ms
            this.startTime = Date.now();
            this.recording = true;
            
            // Botón + timer
            document.getElementById('recordBtn').textContent = '⏹️ PARAR';
            document.getElementById('recordBtn').classList.add('recording');
            this.startTimer();
            
        } catch (error) {
            console.error('❌ ERROR:', error);
            alert('❌ MICRÓFONO BLOQUEADO\n\n' + 
                '1. Ajustes → Chrome → Micrófono → Permitir\n' +
                '2. Recarga página\n' +
                '3. Dale "Permitir" al popup');
        }
    }

    parar() {
        if (this.mediaRecorder && this.recording) {
            this.mediaRecorder.stop();
            this.recording = false;
            document.getElementById('recordBtn').textContent = '🎙️ GRABAR';
            document.getElementById('recordBtn').classList.remove('recording');
            this.stopTimer();
        }
    }

    startTimer() {
        this.timerId = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const secs = (elapsed % 60).toString().padStart(2, '0');
            document.getElementById('timer').textContent = `${mins}:${secs}`;
        }, 100);
    }

    stopTimer() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    guardar() {
        const entry = {
            date: new Date().toLocaleString('es-ES'),
            emotions: document.getElementById('emotions').value || 'No especificado',
            thoughts: document.getElementById('thoughts').value || 'No especificado',
            intensity: document.getElementById('intensity').value,
            audio: document.getElementById('audioPreview').style.display !== 'none'
        };

        // Guardar local
        let entries = JSON.parse(localStorage.getItem('tlpEntries') || '[]');
        entries.unshift(entry);
        localStorage.setItem('tlpEntries', JSON.stringify(entries.slice(0, 50)));

        // WhatsApp
        const msg = `🧠 TLP PRO CRISTELITA90\n\n` +
            `📅 ${entry.date}\n` +
            `😰 Intensidad: ${entry.intensity}/10\n` +
            `💭 Emociones: ${entry.emotions}\n` +
            `💭 Pensamientos: ${entry.thoughts}\n` +
            `🎤 Audio: ${entry.audio ? '✅ SÍ' : '❌ No'}\n\n` +
            `#TLP #DiarioPro`;
        
        window.open(`https://wa.me/+34643370361?text=${encodeURIComponent(msg)}`, '_blank');
        
        // Mostrar
        document.getElementById('suggestion').innerHTML = 
            entry.intensity > 7 ? '🚨 STOP + Respira' :
            entry.emotions.includes('ansiedad') ? '🌬️ Respiración 4-7-8' : 
            '💖 Autocompasión';
        
        document.getElementById('suggestionSection').style.display = 'block';
        this.mostrarEntradas();
        this.limpiar();
    }

    limpiar() {
        document.getElementById('emotions').value = '';
        document.getElementById('thoughts').value = '';
        document.getElementById('intensity').value = 5;
        document.getElementById('timer').textContent = '00:00';
        document.getElementById('audioPreview').style.display = 'none';
        if (document.getElementById('playbackAudio').src) {
            URL.revokeObjectURL(document.getElementById('playbackAudio').src);
        }
    }

    mostrarEntradas() {
        const entries = JSON.parse(localStorage.getItem('tlpEntries') || '[]');
        document.getElementById('entries').innerHTML = 
            entries.slice(0,5).map(e => `
                <div class="entry">
                    <strong>${e.date}</strong><br>
                    😰 ${e.intensity}/10<br>
                    ${e.emotions}
                </div>
            `).join('');
    }
}

const tlp = new TLPPro();

// EVENTOS
document.getElementById('recordBtn').addEventListener('click', () => {
    if (tlp.recording) {
        tlp.parar();
    } else {
        tlp.grabar();
    }
});

document.getElementById('saveBtn').addEventListener('click', () => tlp.guardar());

document.getElementById('intensity').addEventListener('input', (e) => {
    document.getElementById('intValue').textContent = e.target.value;
});

// CARGAR
tlp.mostrarEntradas();
