import Home from './pages/Home';
import Game from './pages/Game';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Game": Game,
    "Profile": Profile,
    "Leaderboard": Leaderboard,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};