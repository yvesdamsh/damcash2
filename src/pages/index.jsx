import React from 'react';
import { Navigate } from 'react-router-dom';

export default function Index() {
    // Priority: 
    // 1. Default to /Home
    // 2. If we have a last_path that IS NOT /Profile, use it
    const lastPath = localStorage.getItem('damcash_last_path');
    const target = (lastPath && !lastPath.toLowerCase().includes('profile')) ? lastPath : '/Home';
    return <Navigate to={target} replace />;
}