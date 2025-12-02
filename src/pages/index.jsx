import React from 'react';
import { Navigate } from 'react-router-dom';

export default function Index() {
    // Redirect root URL to Home page
    return <Navigate to="/Home" replace />;
}