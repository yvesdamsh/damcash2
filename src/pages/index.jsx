import React from 'react';
import { Navigate } from 'react-router-dom';

export default function Index() {
    // Force redirect to Home to fix the persistent Profile redirection issue
    return <Navigate to="/Home" replace />;
}