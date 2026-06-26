import { Request, Response } from 'express';

export interface RequestUser {
  id?: string;
  name?: string;
  role?: string;
}

export function getRequestUser(req: Request): RequestUser {
  return {
    id: req.header('x-user-id') || undefined,
    name: req.header('x-user-name') || undefined,
    role: String(req.header('x-user-role') ?? '').toLocaleLowerCase('cs') || undefined
  };
}

export function auditInfo(req: Request) {
  const user = getRequestUser(req);
  return {
    userId: user.id,
    userName: user.name
  };
}

export function hasAnyRole(req: Request, roles: string[]) {
  const user = getRequestUser(req);
  return roles.includes(user.role ?? '');
}

export function requireAnyRole(req: Request, res: Response, roles: string[], message = 'Nemáte oprávnění k této akci.') {
  if (!hasAnyRole(req, roles)) {
    res.status(403).json({ error: message });
    return false;
  }
  return true;
}

export function requireAdmin(req: Request, res: Response) {
  const user = getRequestUser(req);
  if (user.role !== 'admin' && user.name !== 'Demo Admin') {
    res.status(403).json({ error: 'Pouze administrátor může upravovat databázi.' });
    return false;
  }
  return true;
}
