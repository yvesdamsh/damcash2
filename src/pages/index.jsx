import { Navigate } from 'react-router-dom';

export default function Index() {
    // Always redirect to Home to ensure a clean state
    return <Navigate to="/Home" replace />;
}