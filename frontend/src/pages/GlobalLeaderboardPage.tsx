import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Global Standings section has been removed in favor of the Friends Leaderboard
 * as the default leaderboard view.
 */
export const GlobalLeaderboardPage: React.FC = () => {
  return <Navigate to="/leaderboard/friends" replace />;
};
