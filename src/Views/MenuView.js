import { Component } from '../core/Component.js';
import { router } from '../core/Router.js';

export class MenuView extends Component {

    render() {
        return `
            <div class="mainMenu">
                <div class="title h150px fatFont">Board Game Reborn</div>
                <div class="menuSelect">
                    <button class="btn borderPixel fatFont" id="btn-play">Lancer le combat</button>
                    <button class="btn borderPixel fatFont" id="btn-options">Paramètres</button>
                </div>
            </div>
        `;
    }

    onMount() {
        this.query('#btn-play').addEventListener('click', () => router.navigate('game'));
        this.query('#btn-options').addEventListener('click', () => router.navigate('options'));
    }
}
