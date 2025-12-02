import React from 'react';
import { Navigate } from 'react-router-dom';

export default function Index() {
    // Explicitly redirect to Home
    return <Navigate to="/Home" replace />;
}