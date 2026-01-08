import Academy from './pages/Academy';
import AdminDashboard from './pages/AdminDashboard';
import CreatePuzzle from './pages/CreatePuzzle';
import Game from './pages/Game';
import GameHistory from './pages/GameHistory';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import LeagueDetail from './pages/LeagueDetail';
import Leagues from './pages/Leagues';
import Lesson from './pages/Lesson';
import Lobby from './pages/Lobby';
import Messages from './pages/Messages';
import Preferences from './pages/Preferences';
import Profile from './pages/Profile';
import ReplayCenter from './pages/ReplayCenter';
import Shop from './pages/Shop';
import Spectate from './pages/Spectate';
import TeamDetail from './pages/TeamDetail';
import Teams from './pages/Teams';
import TournamentDetail from './pages/TournamentDetail';
import Tournaments from './pages/Tournaments';
import Training from './pages/Training';
import Wallet from './pages/Wallet';
import index from './pages/index';
import Notifications from './pages/Notifications';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Academy": Academy,
    "AdminDashboard": AdminDashboard,
    "CreatePuzzle": CreatePuzzle,
    "Game": Game,
    "GameHistory": GameHistory,
    "Home": Home,
    "Leaderboard": Leaderboard,
    "LeagueDetail": LeagueDetail,
    "Leagues": Leagues,
    "Lesson": Lesson,
    "Lobby": Lobby,
    "Messages": Messages,
    "Preferences": Preferences,
    "Profile": Profile,
    "ReplayCenter": ReplayCenter,
    "Shop": Shop,
    "Spectate": Spectate,
    "TeamDetail": TeamDetail,
    "Teams": Teams,
    "TournamentDetail": TournamentDetail,
    "Tournaments": Tournaments,
    "Training": Training,
    "Wallet": Wallet,
    "index": index,
    "Notifications": Notifications,
}

export const pagesConfig = {
    mainPage: "Profile",
    Pages: PAGES,
    Layout: __Layout,
};