import { Router } from 'express';
import {
  getLocalDepartments,
  getLocalEmployees,
  getLocalPermissions,
  getLocalRolePermissions,
  getLocalRoles,
  getLocalUserRoles
} from '../data/localAdminData';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    departments: getLocalDepartments(),
    employees: getLocalEmployees(),
    roles: getLocalRoles(),
    permissions: getLocalPermissions(),
    role_permissions: getLocalRolePermissions(),
    user_roles: getLocalUserRoles()
  });
});

router.get('/departments', (_req, res) => {
  res.json(getLocalDepartments());
});

router.get('/employees', (_req, res) => {
  res.json(getLocalEmployees());
});

router.get('/roles', (_req, res) => {
  res.json(getLocalRoles());
});

router.get('/permissions', (_req, res) => {
  res.json(getLocalPermissions());
});

router.get('/user-roles', (_req, res) => {
  res.json(getLocalUserRoles());
});

export default router;
