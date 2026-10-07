import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { generateToken } from '../middleware/auth.js';

// Every tool calls the SC Lab REST API over loopback as the signed-in member, so the
// API's own RBAC gateway, ownership checks and validation apply exactly as they do in
// the web app. The connector deliberately exposes only self-service actions: nothing
// here approves, rejects, issues or deletes other people's records, even for admins.

const PORT = parseInt(process.env.PORT || '3001');
const API_BASE = process.env.MCP_INTERNAL_API_URL || `http://127.0.0.1:${PORT}`;
const MAX_TEXT = 60_000;

interface Caller { userId: string; email: string }

function callerFrom(authInfo?: AuthInfo): Caller {
  const extra = authInfo?.extra as { userId?: string; email?: string } | undefined;
  if (!extra?.userId || !extra.email) throw new Error('Not signed in to SC Lab');
  return { userId: extra.userId, email: extra.email };
}

class ApiError extends Error {}

async function api(caller: Caller, method: string, path: string, opts: { body?: unknown; query?: Record<string, unknown> } = {}) {
  const url = new URL(path, API_BASE);
  for (const [k, v] of Object.entries(opts.query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  // Short-lived session token minted in-process for this one call; it never leaves the server.
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${generateToken(caller.userId, caller.email)}`,
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* plain-text body */ }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && (data.error || data.message)) || `Request failed with HTTP ${res.status}`;
    throw new ApiError(`${msg}${data?.details ? ` (${data.details})` : ''}`);
  }
  return data;
}

function ok(data: unknown) {
  let text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT) + '\n... (truncated - narrow the request to see more)';
  return { content: [{ type: 'text' as const, text }] };
}

function fail(err: unknown) {
  const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text: `SC Lab refused this: ${msg}` }], isError: true };
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Drops undefined keys so the API only sees fields the model actually set. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const dateTime = z.string().describe('ISO 8601 date-time with timezone offset, e.g. 2026-10-08T14:00:00+05:30');
const id = z.string().uuid();

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

type Handler<A> = (args: A, caller: Caller) => Promise<unknown>;

export function registerTools(server: McpServer) {
  // Wraps a handler with caller resolution and uniform error reporting.
  function tool<S extends z.ZodRawShape>(
    name: string,
    config: { title: string; description: string; inputSchema: S; annotations: Record<string, boolean> },
    handler: Handler<z.objectOutputType<S, z.ZodTypeAny>>
  ) {
    server.registerTool(name, config as any, (async (args: any, extra: any) => {
      try {
        return ok(await handler(args, callerFrom(extra.authInfo)));
      } catch (err) {
        return fail(err);
      }
    }) as any);
  }

  // ------------------------------------------------------------------ Overview

  tool('whoami', {
    title: 'Who am I',
    description: 'Shows the signed-in SC Lab member: name, email, role, designation, project and permissions. Call this first if you need the member\'s own details.',
    inputSchema: {},
    annotations: READ,
  }, async (_a, c) => {
    const me = await api(c, 'GET', '/api/auth/me');
    const p = me.profile || {};
    return {
      id: c.userId, email: c.email, full_name: p.full_name, role: p.user_role, designation: p.designation || p.program_designation,
      department: p.department, project_name: p.project_name, project_code: p.project_code, permissions: me.permissions,
    };
  });

  tool('get_dashboard', {
    title: 'My dashboard',
    description: 'Summary counts for the member: open purchase and leave requests, work items, completion and delayed work, plus unread notifications and today\'s to-do progress.',
    inputSchema: {},
    annotations: READ,
  }, async (_a, c) => {
    const [stats, unread, todos] = await Promise.all([
      api(c, 'GET', '/api/dashboard/stats'),
      api(c, 'GET', '/api/notifications/unread-count'),
      api(c, 'GET', '/api/daily-todos/today/summary', { query: { date: today() } }),
    ]);
    return { ...stats, unread_notifications: unread.count, todos_today: todos };
  });

  // ------------------------------------------------------------------ Work

  tool('list_my_work', {
    title: 'List my work items',
    description: 'Lists work items assigned to the member or that the member supervises. Each item includes status (admin_status), priority, dates, issue_key and pending milestone change requests.',
    inputSchema: {
      role: z.enum(['assigned_to_me', 'supervised_by_me', 'all']).default('all').describe('Filter by the member\'s relationship to the work'),
      priority: z.enum(['low', 'medium', 'high', 'code_red']).optional(),
      include_completed: z.boolean().default(true),
    },
    annotations: READ,
  }, async (a, c) => {
    const rows: any[] = await api(c, 'GET', '/api/work');
    const mine = (r: any) => r.user_id === c.userId;
    const supervised = (r: any) => r.assigned_by_user_id === c.userId || (r.assigned_by || '').trim().toLowerCase() === c.email.toLowerCase();
    return rows
      .filter(r => a.role === 'assigned_to_me' ? mine(r) : a.role === 'supervised_by_me' ? supervised(r) : mine(r) || supervised(r))
      .filter(r => !a.priority || r.priority === a.priority)
      .filter(r => a.include_completed || !['completed', 'approved'].includes(r.admin_status))
      .map(r => ({
        id: r.id, issue_key: r.issue_key, work_title: r.work_title, project_name: r.project_name, assignee: r.user_name,
        assigned_by: r.assigned_by, priority: r.priority, issue_type: r.issue_type, admin_status: r.admin_status,
        start_date: r.start_date, end_date: r.end_date, pending_milestone_requests: r.pending_milestone_requests_count,
        blocked_by_code_red: r.blocked_by_code_red_count,
      }));
  });

  tool('get_work_item', {
    title: 'Get work item details',
    description: 'Full detail for one work item: the item itself, its milestones (with justification status), recent progress updates, problems with mitigations, comments and milestone change requests.',
    inputSchema: { work_id: id },
    annotations: READ,
  }, async (a, c) => {
    const base = `/api/work/${a.work_id}`;
    const [work, milestones, progress, problems, comments, changeRequests] = await Promise.all([
      api(c, 'GET', base),
      api(c, 'GET', `${base}/milestones`),
      api(c, 'GET', `${base}/progress`),
      api(c, 'GET', `${base}/problems`),
      api(c, 'GET', `${base}/comments`),
      api(c, 'GET', `${base}/milestone-change-requests`),
    ]);
    return { work, milestones, recent_progress: (progress as any[]).slice(0, 10), problems, comments, milestone_change_requests: changeRequests };
  });

  tool('create_work_item', {
    title: 'Create a work item',
    description: 'Creates a new work item for the member (or for another regular member when assign_to_user_id is given). Milestone dates must not be after end_date.',
    inputSchema: {
      work_title: z.string().min(1).max(300),
      project_name: z.string().min(1),
      assigned_by: z.string().min(1).describe('Supervisor email (preferred) or name who assigned this work. Required when creating work for yourself.'),
      description: z.string().optional(),
      start_date: date.optional(),
      end_date: date.optional(),
      priority: z.enum(['low', 'medium', 'high', 'code_red']).default('medium').describe('code_red alerts all admins - use only for genuine emergencies'),
      issue_type: z.string().default('task').describe('e.g. task, bug, research, experiment'),
      assign_to_user_id: id.optional(),
      milestones: z.array(z.object({
        title: z.string().min(1),
        target_date: date,
        expected_outcome: z.string().optional(),
      })).optional(),
    },
    annotations: WRITE,
  }, async (a, c) => api(c, 'POST', '/api/work', {
    body: compact({
      work_title: a.work_title, project_name: a.project_name, assigned_by: a.assigned_by, description: a.description,
      start_date: a.start_date, end_date: a.end_date, priority: a.priority, issue_type: a.issue_type,
      user_id: a.assign_to_user_id, milestones: a.milestones,
    }),
  }));

  tool('update_work_item', {
    title: 'Update a work item',
    description: 'Edits the work item\'s title, description, dates or priority. Milestone changes are NOT made here - use request_milestone_change.',
    inputSchema: {
      work_id: id,
      work_title: z.string().min(1).max(300).optional(),
      description: z.string().optional(),
      project_name: z.string().optional(),
      start_date: date.optional(),
      end_date: date.optional(),
      priority: z.enum(['low', 'medium', 'high', 'code_red']).optional(),
    },
    annotations: WRITE,
  }, async ({ work_id, ...fields }, c) => {
    const body = compact(fields);
    if (Object.keys(body).length === 0) throw new Error('Nothing to update');
    return api(c, 'PUT', `/api/work/${work_id}`, { body });
  });

  tool('log_progress', {
    title: 'Log progress on a work item',
    description: 'Adds a progress update (status, percentage complete, notes, next steps, blockers) to a work item.',
    inputSchema: {
      work_id: id,
      completion_percentage: z.number().min(0).max(100),
      status: z.enum(['on_track', 'in_progress', 'delayed', 'blocked', 'completed', 'not_started']).default('on_track'),
      progress_notes: z.string().min(1).describe('What was done'),
      next_steps: z.string().optional(),
      blockers: z.string().optional(),
      update_date: date.optional().describe('Defaults to today'),
    },
    annotations: WRITE,
  }, async ({ work_id, ...b }, c) => api(c, 'POST', `/api/work/${work_id}/progress`, { body: compact(b) }));

  tool('update_milestone', {
    title: 'Update a milestone\'s status',
    description: 'Marks a milestone in progress, completed or delayed. Completed and delayed both need a justification; a delay justification goes to the supervisor for review. Titles and dates cannot be changed here - use request_milestone_change.',
    inputSchema: {
      work_id: id,
      milestone_id: id,
      status: z.enum(['in_progress', 'completed', 'delayed', 'pending']),
      justification: z.string().optional().describe('Required for completed (what was delivered) and delayed (why it slipped)'),
      linked_work_id: id.optional().describe('Another work item that caused the delay, if any'),
    },
    annotations: WRITE,
  }, async (a, c) => api(c, 'PUT', `/api/work/${a.work_id}/milestones/${a.milestone_id}`, {
    body: compact({ status: a.status, justification: a.justification, justification_linked_work_id: a.linked_work_id }),
  }));

  tool('request_milestone_change', {
    title: 'Request a milestone change',
    description: 'Asks an admin to replace the work item\'s milestones with a new list (add, remove, rename or reschedule). The proposal replaces ALL milestones when approved, so include the ones to keep. Read current milestones with get_work_item first.',
    inputSchema: {
      work_id: id,
      reason: z.string().min(1),
      proposed_milestones: z.array(z.object({
        title: z.string().min(1),
        target_date: date,
        expected_outcome: z.string().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'delayed']).optional(),
      })).min(1),
    },
    annotations: WRITE,
  }, async ({ work_id, ...b }, c) => api(c, 'POST', `/api/work/${work_id}/milestone-change-requests`, { body: b }));

  tool('report_problem', {
    title: 'Report a problem on a work item',
    description: 'Records a problem or risk on a work item, optionally with a proposed mitigation and who should help.',
    inputSchema: {
      work_id: id,
      title: z.string().min(1).describe('Short name or category of the problem'),
      description: z.string().min(1),
      severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      proposed_mitigation: z.string().optional(),
      support_required_from: z.string().optional(),
      urgency_level: z.string().optional(),
    },
    annotations: WRITE,
  }, async ({ work_id, ...b }, c) => api(c, 'POST', `/api/work/${work_id}/problems`, { body: compact(b) }));

  tool('update_problem', {
    title: 'Update a problem',
    description: 'Changes a reported problem\'s status (e.g. resolve it), description or severity.',
    inputSchema: {
      work_id: id,
      problem_id: id,
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
      description: z.string().optional(),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      resolution_date: date.optional(),
    },
    annotations: WRITE,
  }, async (a, c) => {
    const body = compact({ status: a.status, description: a.description, impact_level: a.severity, resolution_date: a.resolution_date });
    if (Object.keys(body).length === 0) throw new Error('Nothing to update');
    return api(c, 'PUT', `/api/work/${a.work_id}/problems/${a.problem_id}`, { body });
  });

  tool('add_work_comment', {
    title: 'Comment on a work item',
    description: 'Posts a comment on a work item. The assignee, supervisor and admins are notified.',
    inputSchema: { work_id: id, comment: z.string().min(1).max(5000) },
    annotations: WRITE,
  }, async (a, c) => api(c, 'POST', `/api/work/${a.work_id}/comments`, { body: { comment: a.comment } }));

  // ------------------------------------------------------------------ Daily to-dos

  tool('get_todos', {
    title: 'Get my to-do list for a day',
    description: 'Returns the member\'s private daily to-do list for a date (defaults to today).',
    inputSchema: { date: date.optional() },
    annotations: READ,
  }, async (a, c) => api(c, 'GET', `/api/daily-todos/day/${a.date || today()}`));

  tool('add_todos', {
    title: 'Add to-dos',
    description: 'Adds one or more tasks to the member\'s to-do list for a date (defaults to today).',
    inputSchema: { titles: z.array(z.string().min(1).max(500)).min(1).max(30), date: date.optional() },
    annotations: WRITE,
  }, async (a, c) => {
    const added = [];
    for (const title of a.titles) added.push(await api(c, 'POST', `/api/daily-todos/day/${a.date || today()}/items`, { body: { title } }));
    return added;
  });

  tool('update_todo', {
    title: 'Update a to-do',
    description: 'Ticks off, un-ticks or renames a to-do item.',
    inputSchema: { todo_id: id, is_completed: z.boolean().optional(), title: z.string().min(1).max(500).optional() },
    annotations: WRITE,
  }, async ({ todo_id, ...b }, c) => api(c, 'PUT', `/api/daily-todos/items/${todo_id}`, { body: compact(b) }));

  tool('delete_todo', {
    title: 'Delete a to-do',
    description: 'Removes one item from the member\'s to-do list.',
    inputSchema: { todo_id: id },
    annotations: DESTRUCTIVE,
  }, async (a, c) => api(c, 'DELETE', `/api/daily-todos/items/${a.todo_id}`));

  tool('carry_forward_todos', {
    title: 'Carry forward unfinished to-dos',
    description: 'Copies unfinished tasks from the most recent earlier day into the given day (defaults to today), skipping duplicates.',
    inputSchema: { date: date.optional() },
    annotations: WRITE,
  }, async (a, c) => api(c, 'POST', `/api/daily-todos/day/${a.date || today()}/carry-forward`));

  // ------------------------------------------------------------------ Leave

  tool('list_my_leave_requests', {
    title: 'List my leave requests',
    description: 'Lists the member\'s own leave requests with their status (pending, approved, rejected).',
    inputSchema: { status: z.enum(['pending', 'approved', 'rejected']).optional() },
    annotations: READ,
  }, async (a, c) => api(c, 'GET', '/api/leave-requests', { query: { requested_by: c.userId, status: a.status, limit: 200 } }));

  tool('apply_for_leave', {
    title: 'Apply for leave',
    description: 'Submits a leave request for admin approval.',
    inputSchema: {
      leave_type: z.enum(['casual', 'medical', 'academic']),
      from_date: date,
      to_date: date,
      reason: z.string().min(1),
    },
    annotations: WRITE,
  }, async (a, c) => api(c, 'POST', '/api/leave-requests', { body: a }));

  tool('cancel_leave_request', {
    title: 'Cancel a pending leave request',
    description: 'Withdraws one of the member\'s leave requests that is still pending. Decided requests cannot be cancelled here.',
    inputSchema: { leave_request_id: id },
    annotations: DESTRUCTIVE,
  }, async (a, c) => {
    const lr = await api(c, 'GET', `/api/leave-requests/${a.leave_request_id}`);
    if (lr.requested_by !== c.userId) throw new Error('You can only cancel your own leave requests');
    if (lr.status !== 'pending') throw new Error(`This leave request is already ${lr.status} and can no longer be cancelled here`);
    return api(c, 'DELETE', `/api/leave-requests/${a.leave_request_id}`);
  });

  // ------------------------------------------------------------------ Purchases

  tool('list_my_purchase_requests', {
    title: 'List my purchase requests',
    description: 'Lists the member\'s own purchase requests and their procurement status.',
    inputSchema: {
      status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'ordered', 'in_transit', 'received', 'added_to_inventory']).optional(),
    },
    annotations: READ,
  }, async (a, c) => api(c, 'GET', '/api/purchase-requests', { query: { requested_by: c.userId, status: a.status, limit: 200 } }));

  tool('create_purchase_request', {
    title: 'Create a purchase request',
    description: 'Raises a purchase request. Leave submit=false to save it as a draft the member can review in the web app first.',
    inputSchema: {
      item_name: z.string().min(1),
      category: z.string().min(1).describe('e.g. Consumables, Chemicals, Equipment, Software'),
      quantity: z.number().int().positive().default(1),
      estimated_cost: z.number().nonnegative().optional().describe('Total estimated cost'),
      currency: z.string().default('INR'),
      purpose: z.string().min(1),
      specifications: z.string().optional(),
      vendor_name: z.string().optional(),
      link: z.string().url().optional().describe('Product page or quotation link'),
      project_code: z.string().optional(),
      urgency: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
      expected_delivery_date: date.optional(),
      submit: z.boolean().default(false).describe('true submits for approval now; false saves a draft'),
    },
    annotations: WRITE,
  }, async ({ submit, ...b }, c) => api(c, 'POST', '/api/purchase-requests', {
    body: compact({ ...b, status: submit ? 'submitted' : 'draft' }),
  }));

  tool('submit_purchase_request', {
    title: 'Submit a draft purchase request',
    description: 'Sends one of the member\'s draft purchase requests for approval.',
    inputSchema: { purchase_request_id: id },
    annotations: WRITE,
  }, async (a, c) => {
    const pr = await api(c, 'GET', `/api/purchase-requests/${a.purchase_request_id}`);
    if (pr.requested_by !== c.userId) throw new Error('You can only submit your own purchase requests');
    if (pr.status !== 'draft') throw new Error(`This request is already ${pr.status}`);
    return api(c, 'PUT', `/api/purchase-requests/${a.purchase_request_id}`, { body: { status: 'submitted' } });
  });

  tool('cancel_purchase_request', {
    title: 'Cancel an undecided purchase request',
    description: 'Deletes one of the member\'s purchase requests that is still a draft or awaiting approval. Approved or later requests cannot be cancelled here.',
    inputSchema: { purchase_request_id: id },
    annotations: DESTRUCTIVE,
  }, async (a, c) => {
    const pr = await api(c, 'GET', `/api/purchase-requests/${a.purchase_request_id}`);
    if (pr.requested_by !== c.userId) throw new Error('You can only cancel your own purchase requests');
    if (!['draft', 'submitted'].includes(pr.status)) throw new Error(`This request is already ${pr.status} and can no longer be cancelled here`);
    return api(c, 'DELETE', `/api/purchase-requests/${a.purchase_request_id}`);
  });

  // ------------------------------------------------------------------ Inventory

  tool('search_inventory', {
    title: 'Search the inventory catalog',
    description: 'Finds catalog items (equipment and consumables) by name, category, location or tag, with stock levels. Use the returned id to request an item or book equipment.',
    inputSchema: {
      text: z.string().optional().describe('Matches item name, category, location, asset tag or serial number (case-insensitive)'),
      classification: z.enum(['Equipment', 'Consumables']).optional(),
      status: z.enum(['available', 'assigned', 'in_use', 'maintenance', 'retired']).optional(),
      limit: z.number().int().min(1).max(100).default(25),
    },
    annotations: READ,
  }, async (a, c) => {
    const rows: any[] = await api(c, 'GET', '/api/inventory', { query: { classification: a.classification, status: a.status, limit: 1000 } });
    const t = a.text?.toLowerCase();
    return rows
      .filter(r => !t || [r.item_name, r.category, r.location, r.asset_tag, r.serial_number, r.facility_name]
        .some(v => typeof v === 'string' && v.toLowerCase().includes(t)))
      .slice(0, a.limit)
      .map(r => ({
        id: r.id, item_name: r.item_name, category: r.category, classification: r.classification, quantity: r.quantity,
        status: r.status, condition: r.condition, location: r.location, facility_name: r.facility_name, asset_tag: r.asset_tag,
      }));
  });

  tool('list_my_inventory_requests', {
    title: 'List my inventory requests',
    description: 'Lists the member\'s requests for inventory items with their status and due-back dates.',
    inputSchema: {
      status: z.enum(['pending', 'approved', 'rejected', 'issued', 'returned', 'overdue', 'cancelled']).optional(),
    },
    annotations: READ,
  }, async (a, c) => {
    const rows: any[] = await api(c, 'GET', '/api/inventory/requests', { query: { status: a.status, user_id: c.userId } });
    return rows.filter(r => r.requested_by === c.userId);
  });

  tool('request_inventory_item', {
    title: 'Request an inventory item',
    description: 'Asks the lab to issue a catalog item (find its id with search_inventory). Goes to a lab manager for approval.',
    inputSchema: {
      inventory_item_id: id,
      quantity: z.number().int().positive().default(1),
      purpose: z.string().min(1),
      expected_return_date: date.optional().describe('For returnable equipment'),
      remarks: z.string().optional(),
    },
    annotations: WRITE,
  }, async (a, c) => api(c, 'POST', '/api/inventory/requests', { body: compact(a) }));

  // ------------------------------------------------------------------ Bookings

  tool('list_facilities', {
    title: 'List facilities',
    description: 'Lists bookable lab facilities with location, status, capacity, maximum booking hours and upcoming bookings count.',
    inputSchema: {},
    annotations: READ,
  }, async (_a, c) => {
    const rows: any[] = await api(c, 'GET', '/api/facilities');
    return rows.map(r => ({
      id: r.id, name: r.name, location: r.location, status: r.status, capacity: r.capacity, max_booking_hours: r.max_booking_hours,
      responsible_person: r.responsible_person_name || r.assigned_user?.full_name, upcoming_bookings: r.upcoming_bookings_count,
    }));
  });

  tool('get_bookings', {
    title: 'Check bookings for a facility or equipment',
    description: 'Shows confirmed bookings for a facility or an equipment item, either on one date or all upcoming. Use before booking to find a free slot.',
    inputSchema: {
      resource: z.enum(['facility', 'equipment']),
      resource_id: id,
      date: date.optional().describe('Only bookings starting on this date; omit for all upcoming'),
    },
    annotations: READ,
  }, async (a, c) => {
    const base = a.resource === 'facility' ? '/api/facilities' : '/api/inventory';
    const rows: any[] = await api(c, 'GET', `${base}/${a.resource_id}/bookings`, { query: a.date ? { date: a.date } : { upcoming: 'true' } });
    return rows.map(r => ({
      id: r.id, title: r.title, start_time: r.start_time, end_time: r.end_time, status: r.status, booked_by: r.user_name,
      mine: r.user_id === c.userId,
    }));
  });

  tool('book_facility', {
    title: 'Book a facility',
    description: 'Reserves a facility for a time slot. Fails with the clashing booking if the slot is taken.',
    inputSchema: { facility_id: id, title: z.string().min(1), start_time: dateTime, end_time: dateTime, purpose: z.string().optional() },
    annotations: WRITE,
  }, async ({ facility_id, ...b }, c) => api(c, 'POST', `/api/facilities/${facility_id}/bookings`, { body: compact(b) }));

  tool('book_equipment', {
    title: 'Book equipment',
    description: 'Reserves an equipment item (id from search_inventory) for a time slot. Fails with the clashing booking if the slot is taken.',
    inputSchema: {
      inventory_item_id: id, title: z.string().min(1), start_time: dateTime, end_time: dateTime,
      purpose: z.string().optional(), notes: z.string().optional(),
    },
    annotations: WRITE,
  }, async ({ inventory_item_id, ...b }, c) => api(c, 'POST', `/api/inventory/${inventory_item_id}/bookings`, { body: compact(b) }));

  tool('cancel_booking', {
    title: 'Cancel one of my bookings',
    description: 'Cancels a facility or equipment booking the member made.',
    inputSchema: { resource: z.enum(['facility', 'equipment']), booking_id: id },
    annotations: DESTRUCTIVE,
  }, async (a, c) => {
    const base = a.resource === 'facility' ? '/api/facilities' : '/api/inventory';
    return api(c, 'PUT', `${base}/bookings/${a.booking_id}/cancel`);
  });

  // ------------------------------------------------------------------ Projects

  tool('list_projects', {
    title: 'List lab projects',
    description: 'Searches the lab project tracker by title, code, funding agency or PI.',
    inputSchema: { search: z.string().optional(), status: z.string().optional().describe('e.g. Active') },
    annotations: READ,
  }, async (a, c) => {
    const rows: any[] = await api(c, 'GET', '/api/projects', { query: { search: a.search, status: a.status } });
    return rows.map(r => ({
      id: r.id, project_code: r.project_code, project_title: r.project_title, status: r.status, rag_status: r.rag_status,
      funding_agency: r.funding_agency, faculty_lead_pi: r.faculty_lead_pi, days_to_close: r.days_to_close,
      latest_achievement: r.latest_achievement_text,
    }));
  });

  tool('add_project_achievement', {
    title: 'Post a project achievement',
    description: 'Adds a weekly achievement/update to a lab project (id from list_projects). Only members of that project\'s team can post.',
    inputSchema: { project_id: id, message: z.string().min(1).max(5000) },
    annotations: WRITE,
  }, async (a, c) => api(c, 'POST', `/api/projects/${a.project_id}/achievements`, { body: { message: a.message } }));

  // ------------------------------------------------------------------ Notifications

  tool('list_notifications', {
    title: 'List my notifications',
    description: 'Returns the member\'s recent notifications (approvals, comments, reminders), newest first.',
    inputSchema: { unread_only: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(20) },
    annotations: READ,
  }, async (a, c) => {
    const rows: any[] = await api(c, 'GET', '/api/notifications', { query: { limit: a.limit } });
    return rows
      .filter(r => !a.unread_only || !r.is_read)
      .map(r => ({ id: r.id, type: r.type, title: r.title, message: r.message, is_read: r.is_read, created_at: r.created_at }));
  });

  tool('mark_notifications_read', {
    title: 'Mark notifications as read',
    description: 'Marks the given notifications as read, or all of them when no ids are given.',
    inputSchema: { notification_ids: z.array(id).optional() },
    annotations: WRITE,
  }, async (a, c) => {
    if (!a.notification_ids?.length) return api(c, 'POST', '/api/notifications/mark-all-read');
    const readAt = new Date().toISOString();
    for (const nid of a.notification_ids) {
      await api(c, 'PUT', `/api/notifications/${nid}`, { body: { is_read: true, read_at: readAt } });
    }
    return { marked_read: a.notification_ids.length };
  });
}
