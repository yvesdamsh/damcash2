import ActiveGames from './pages/ActiveGames';
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
import Notifications from './pages/Notifications';
import Preferences from './pages/Preferences';
import Profile from './pages/Profile';
import QAReport from './pages/QAReport';
import ReplayCenter from './pages/ReplayCenter';
import Shop from './pages/Shop';
import Spectate from './pages/Spectate';
import TeamDetail from './pages/TeamDetail';
import Teams from './pages/Teams';
import TournamentDetail from './pages/TournamentDetail';
import Tournaments from './pages/Tournaments';
import Wallet from './pages/Wallet';
import game from './pages/game';
import index from './pages/index';
import Training from './pages/Training';
import Academy from './pages/Academy';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ActiveGames": ActiveGames,
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
    "Notifications": Notifications,
    "Preferences": Preferences,
    "Profile": Profile,
    "QAReport": QAReport,
    "ReplayCenter": ReplayCenter,
    "Shop": Shop,
    "Spectate": Spectate,
    "TeamDetail": TeamDetail,
    "Teams": Teams,
    "TournamentDetail": TournamentDetail,
    "Tournaments": Tournaments,
    "Wallet": Wallet,
    "game": game,
    "index": index,
    "Training": Training,
    "Academy": Academy,
}

export const pagesConfig = {
    mainPage: "Profile",
    Pages: PAGES,
    Layout: __Layout,
};