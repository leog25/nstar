// Morse code mapping
const MORSE_CODE = {
    'A': '.-',    'B': '-...',  'C': '-.-.',  'D': '-..',
    'E': '.',     'F': '..-.',  'G': '--.',   'H': '....',
    'I': '..',    'J': '.---',  'K': '-.-',   'L': '.-..',
    'M': '--',    'N': '-.',    'O': '---',   'P': '.--.',
    'Q': '--.-',  'R': '.-.',   'S': '...',   'T': '-',
    'U': '..-',   'V': '...-',  'W': '.--',   'X': '-..-',
    'Y': '-.--',  'Z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
    '!': '-.-.--', '/': '-..-.',  '(': '-.--.',  ')': '-.--.-',
    '&': '.-...',  ':': '---...', ';': '-.-.-.', '=': '-...-',
    '+': '.-.-.',  '-': '-....-', '_': '..--.-', '"': '.-..-.',
    '$': '...-..-', '@': '.--.-.',
    ' ': '/'  // Space between words
};

class MorseController {
    constructor() {
        this.isPlaying = false;
        this.currentTimeout = null;
        this.sequence = [];
        this.currentIndex = 0;

        // Timing in milliseconds
        this.DOT_DURATION = 200;
        this.DASH_DURATION = this.DOT_DURATION * 3;
        this.SYMBOL_GAP = this.DOT_DURATION;
        this.LETTER_GAP = this.DOT_DURATION * 3;
        this.WORD_GAP = this.DOT_DURATION * 7;
    }

    textToMorse(text) {
        return text.toUpperCase().split('').map(char => {
            return MORSE_CODE[char] || '';
        }).join(' ');
    }

    parseSequence(text) {
        const morse = this.textToMorse(text);
        const sequence = [];

        for (let i = 0; i < morse.length; i++) {
            const char = morse[i];
            if (char === '.') {
                sequence.push({ type: 'on', duration: this.DOT_DURATION });
                if (i < morse.length - 1 && morse[i + 1] !== ' ') {
                    sequence.push({ type: 'off', duration: this.SYMBOL_GAP });
                }
            } else if (char === '-') {
                sequence.push({ type: 'on', duration: this.DASH_DURATION });
                if (i < morse.length - 1 && morse[i + 1] !== ' ') {
                    sequence.push({ type: 'off', duration: this.SYMBOL_GAP });
                }
            } else if (char === ' ') {
                // Check if next character is also a space (word gap) or slash
                if (morse[i + 1] === ' ' || morse[i + 1] === '/') {
                    sequence.push({ type: 'off', duration: this.WORD_GAP });
                    i++; // Skip the next space or slash
                } else {
                    sequence.push({ type: 'off', duration: this.LETTER_GAP });
                }
            } else if (char === '/') {
                sequence.push({ type: 'off', duration: this.WORD_GAP });
            }
        }

        return sequence;
    }

    play(text, onCallback, offCallback, completeCallback) {
        if (this.isPlaying) {
            this.stop();
        }

        this.sequence = this.parseSequence(text);
        this.currentIndex = 0;
        this.isPlaying = true;
        this.onCallback = onCallback;
        this.offCallback = offCallback;
        this.completeCallback = completeCallback;

        this.playNext();
    }

    playNext() {
        if (!this.isPlaying || this.currentIndex >= this.sequence.length) {
            this.stop();
            if (this.completeCallback) {
                this.completeCallback();
            }
            return;
        }

        const current = this.sequence[this.currentIndex];

        if (current.type === 'on' && this.onCallback) {
            this.onCallback();
        } else if (current.type === 'off' && this.offCallback) {
            this.offCallback();
        }

        this.currentTimeout = setTimeout(() => {
            this.currentIndex++;
            this.playNext();
        }, current.duration);
    }

    stop() {
        this.isPlaying = false;
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
        if (this.offCallback) {
            this.offCallback();
        }
    }
}