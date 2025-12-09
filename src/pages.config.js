import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import GameHistory from './pages/GameHistory';
import Game from './pages/Game';
import Home from './pages/Home';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import Spectate from './pages/Spectate';
import Training from './pages/Training';
import Leagues from './pages/Leagues';
import LeagueDetail from './pages/LeagueDetail';
import Wallet from './pages/Wallet';
import Lobby from './pages/Lobby';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import CreatePuzzle from './pages/CreatePuzzle';
import index from './pages/index';
import Messages from './pages/Messages';
import ReplayCenter from './pages/ReplayCenter';
import Shop from './pages/Shop';
import Academy from './pages/Academy';
import AdminDashboard from './pages/AdminDashboard';
import Lesson from './pages/Lesson';
import Preferences from './pages/Preferences';
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
    "Leagues": Leagues,
    "LeagueDetail": LeagueDetail,
    "Wallet": Wallet,
    "Lobby": Lobby,
    "Teams": Teams,
    "TeamDetail": TeamDetail,
    "CreatePuzzle": CreatePuzzle,
    "index": index,
    "Messages": Messages,
    "ReplayCenter": ReplayCenter,
    "Shop": Shop,
    "Academy": Academy,
    "AdminDashboard": AdminDashboard,
    "Lesson": Lesson,
    "Preferences": Preferences,
}

export const pagesConfig = {
    mainPage: "Profile",
    Pages: PAGES,
    Layout: __Layout,
};