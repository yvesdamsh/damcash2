import React from 'react';
import { Navigate } from 'react-router-dom';

export default function Index() {
    // Redirect to last visited page (excluding Profile) or default to Home
    const lastPath = localStorage.getItem('damcash_last_path');
    const target = (lastPath && !lastPath.toLowerCase().includes('profile')) ? lastPath : '/Home';
    return <Navigate to={target} replace />;
}