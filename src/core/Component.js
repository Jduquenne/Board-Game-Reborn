import { eventBus } from './EventBus.js';

export class Component {
    #subscriptions = [];

    constructor(rootSelector) {
        this.root = typeof rootSelector === 'string'
            ? document.querySelector(rootSelector)
            : rootSelector;
    }

    // Retourne du HTML — à implémenter dans chaque composant
    render() { return ''; }

    // Hooks de cycle de vie — optionnels
    onMount() {}
    onUnmount() {}

    mount() {
        this.root.innerHTML = this.render();
        this.onMount();
        return this;
    }

    unmount() {
        this.#subscriptions.forEach(unsub => unsub());
        this.#subscriptions = [];
        this.root.innerHTML = '';
        this.onUnmount();
    }

    // Abonnement EventBus — auto-nettoyé au unmount
    listen(event, callback) {
        const unsub = eventBus.on(event, callback);
        this.#subscriptions.push(unsub);
        return this;
    }

    query(selector) {
        return this.root.querySelector(selector);
    }

    queryAll(selector) {
        return [...this.root.querySelectorAll(selector)];
    }
}
