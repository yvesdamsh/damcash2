import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import GameHistory from './pages/GameHistory';
import Game from './pages/Game';
import Home from './pages/Home';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import Spectate from './pages/Spectate';
import Training from './pages/Training';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Profile": Profile,
    "Leaderboard": Leaderboard,
    "GameHistory": GameHistory,
    "Game": Game,
    "Home": Home,
    "Tournaments": Tournaments,
    "TournamentDetail": TournamentDetail,
    "Spectate": Spectate,
    "Training": Training,
}

export const pagesConfig = {
    mainPage: "Profile",
    Pages: PAGES,
    Layout: __Layout,
};