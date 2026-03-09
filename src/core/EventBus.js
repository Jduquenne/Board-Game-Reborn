class EventBus {
    #listeners = new Map();

    on(event, callback) {
        if (!this.#listeners.has(event)) this.#listeners.set(event, []);
        this.#listeners.get(event).push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const fns = this.#listeners.get(event) ?? [];
        this.#listeners.set(event, fns.filter(fn => fn !== callback));
    }

    emit(event, payload) {
        (this.#listeners.get(event) ?? []).forEach(fn => fn(payload));
    }
}

export const eventBus = new EventBus();
