import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import GameHistory from './pages/GameHistory';
import Game from './pages/Game';
import Home from './pages/Home';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Profile": Profile,
    "Leaderboard": Leaderboard,
    "GameHistory": GameHistory,
    "Game": Game,
    "Home": Home,
}

export const pagesConfig = {
    mainPage: "Profile",
    Pages: PAGES,
    Layout: __Layout,
};