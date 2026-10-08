// Web Worker de la page d'entraînement : fait tourner TrainingSession hors du fil principal,
// pour que la page reste fluide même à vitesse maximale. Communique uniquement par messages.
import { TrainingSession } from './TrainingSession.js';

const session = new TrainingSession(message => self.postMessage(message));

self.addEventListener('message', ({ data }) => {
    switch (data.type) {
        case 'start':  session.start(); break;
        case 'pause':  session.pause(); break;
        case 'speed':  session.setSpeed(data.speed); break;
        case 'reset':  session.reset(data.opponent, data.lesson); break;
        case 'export': session.exportModel(); break;
    }
});
