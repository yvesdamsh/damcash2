import React from 'react';
import { Navigate } from 'react-router-dom';

export default function Index() {
    const lastPath = localStorage.getItem('damcash_last_path');
    // Eviter les redirections vers la racine ou login pour ne pas boucler
    const target = (lastPath && lastPath !== '/' && !lastPath.includes('login')) ? lastPath : '/Home';
    return <Navigate to={target} replace />;
}