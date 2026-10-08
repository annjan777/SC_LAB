import express, { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeString } from '../middleware/xssSanitizer.js';
import { oauthProvider, oauthLoginRouter, MCP_SCOPE } from './oauth.js';
import { registerTools } from './tools.js';
import { createGrant, issueToken, listGrants, revokeGrant, PAT_TTL_DAYS } from './store.js';

const INSTRUCTIONS = `You are connected to SC Lab, the lab's work-management ERP, as the signed-in lab member.
Use these tools to manage the member's own work: work items and milestones, progress updates, problems,
daily to-dos, leave and purchase requests, inventory requests, facility and equipment bookings, project
achievements and notifications. Read before you write (e.g. get_work_item before updating milestones),
confirm with the member before submitting requests or bookings on their behalf, and report the exact
error text if SC Lab refuses an action. Dates are YYYY-MM-DD; booking times are ISO 8601 with a timezone.
Work items: one piece of work = one work item. When the member lists several tasks or changes for it, add
them as milestones of that single item (each with a target date), not as separate work items or description text.`;

/** Public base URL the AI apps reach this server on, e.g. https://erp.sclab.in */
function publicBaseUrl(): URL {
  if (process.env.MCP_PUBLIC_URL) return new URL(process.env.MCP_PUBLIC_URL);
  // In production the web app and API share one https origin (APP_URL).
  if (process.env.APP_URL?.startsWith('https://')) return new URL(process.env.APP_URL);
  return new URL(`http://localhost:${process.env.PORT || '3001'}`);
}

function mcpServerFor(): McpServer {
  const server = new McpServer({ name: 'sc-lab', version: '1.0.0' }, { instructions: INSTRUCTIONS });
  registerTools(server);
  return server;
}

/**
 * Mounts the MCP connector: OAuth endpoints at the app root (/.well-known/*, /authorize,
 * /token, /register, /revoke, /oauth/login), the MCP endpoint at /mcp and the member's
 * connection management API at /api/mcp. Must be mounted before the SPA fallback and
 * the dev-mode redirect to Vite.
 */
export function mountMcp(app: Express) {
  const baseUrl = publicBaseUrl();
  const mcpUrl = new URL('/mcp', baseUrl);

  if (baseUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(baseUrl.hostname)) {
    console.warn(`[MCP] MCP_PUBLIC_URL (${baseUrl.href}) is not https - the AI connector is disabled. Set MCP_PUBLIC_URL to the public https address.`);
    return;
  }

  app.use(mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: baseUrl,
    resourceServerUrl: mcpUrl,
    scopesSupported: [MCP_SCOPE],
    resourceName: 'SC Lab',
  }));
  app.use(oauthLoginRouter());

  const bearer = requireBearerAuth({
    verifier: oauthProvider,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl),
  });

  const mcpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { jsonrpc: '2.0', error: { code: -32000, message: 'Too many requests, slow down.' }, id: null },
  });

  // Stateless Streamable HTTP: a fresh server + transport per request, so nothing is
  // held in memory between calls and any process can serve any request.
  app.post('/mcp', mcpLimiter, bearer, async (req: Request, res: Response) => {
    const server = mcpServerFor();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[MCP] request failed', err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  });
  const notAllowed = (_req: Request, res: Response) => {
    res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  };
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);

  // --- Connection management for the member (Profile page) ---
  const router = express.Router();

  router.get('/connections', authenticate, async (req: Request, res: Response) => {
    try {
      res.json({ server_url: mcpUrl.href, connections: await listGrants(req.user!.id) });
    } catch (err) {
      console.error(err); res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Personal access token for AI tools that cannot do the OAuth sign-in (shown once).
  router.post('/tokens', authenticate, async (req: Request, res: Response) => {
    try {
      if (req.user!.auth_purpose !== 'session') return res.status(403).json({ error: 'Not allowed' });
      if (typeof req.body?.name !== 'string') return res.status(400).json({ error: 'Give the token a name, e.g. "Cursor on my laptop"' });
      const name = sanitizeString(req.body.name).trim().slice(0, 80);
      if (!name) return res.status(400).json({ error: 'Give the token a name, e.g. "Cursor on my laptop"' });
      const grantId = await createGrant({ userId: req.user!.id, kind: 'pat', name, scopes: [MCP_SCOPE] });
      const token = await issueToken(grantId, 'pat', PAT_TTL_DAYS * 24 * 60 * 60);
      res.status(201).json({ id: grantId, name, token, server_url: mcpUrl.href, expires_in_days: PAT_TTL_DAYS });
    } catch (err) {
      console.error(err); res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.delete('/connections/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const done = await revokeGrant(req.params.id, req.user!.id);
      if (!done) return res.status(404).json({ error: 'Connection not found' });
      res.json({ message: 'Disconnected' });
    } catch (err: any) {
      if (err?.code === '22P02') return res.status(404).json({ error: 'Connection not found' });
      console.error(err); res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.use('/api/mcp', router);
  console.log(`[MCP] AI connector available at ${mcpUrl.href}`);
}
