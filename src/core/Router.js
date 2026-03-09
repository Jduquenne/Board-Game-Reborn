class Router {
    #routes = new Map();
    #current = null;

    register(path, factory) {
        this.#routes.set(path, factory);
        return this;
    }

    navigate(path) {
        this.#current?.unmount();
        history.pushState(null, '', `#${path}`);
        const factory = this.#routes.get(path);
        if (factory) this.#current = factory().mount();
    }

    start() {
        window.addEventListener('popstate', () => this.#resolve());
        this.#resolve();
    }

    #resolve() {
        const path = location.hash.slice(1) || 'menu';
        const factory = this.#routes.get(path);
        if (factory) {
            this.#current?.unmount();
            this.#current = factory().mount();
        }
    }
}

export const router = new Router();
