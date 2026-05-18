import { Env } from '@/libs/Env';

export type LiveHealthResponse = {
  status: 'ok';
  service: 'nextjs';
  appEnv: string;
  timestamp: string;
  deploymentVersion?: string;
};

export function getLiveHealth(): LiveHealthResponse {
  return {
    status: 'ok',
    service: 'nextjs',
    appEnv: Env.APP_ENV,
    timestamp: new Date().toISOString(),
    deploymentVersion: Env.DEPLOYMENT_VERSION,
  };
}
