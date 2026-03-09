import { router } from './core/Router.js';
import { MenuView } from './Views/MenuView.js';
import { OptionsView } from './Views/OptionsView.js';
import { GameView } from './Views/GameView.js';

router
    .register('menu',    () => new MenuView('#app'))
    .register('options', () => new OptionsView('#app'))
    .register('game',    () => new GameView('#app'))
    .start();
