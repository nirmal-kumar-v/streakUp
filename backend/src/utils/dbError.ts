/**
 * Checks if an error is due to missing or invalid database connection
 */
export function isDatabaseConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err.message || '';
  const code = err.code || '';
  const name = err.name || '';

  return (
    name === 'PrismaClientInitializationError' ||
    name === 'PrismaClientRustPanicError' ||
    code === 'P1000' || // Authentication failed
    code === 'P1001' || // Can't reach database server
    code === 'P1002' || // Database timeout
    code === 'P1003' || // Database does not exist
    code === 'P1017' || // Server closed the connection
    msg.includes('Error validating datasource') ||
    msg.includes('the URL must start with the protocol') ||
    msg.includes("Can't reach database server") ||
    msg.includes('Connection refused') ||
    msg.includes('connect ECONNREFUSED')
  );
}

export const DB_CONNECTION_NOTICE =
  'PostgreSQL database is not connected. Please update DATABASE_URL in backend/.env with your PostgreSQL connection string, then run: npx prisma db push';
