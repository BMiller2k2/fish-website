import { Routes } from '@angular/router';
import { Catalog } from './catalog/catalog';
import { Login } from './login/login';
import { Admin } from './admin/admin';
import { adminGuard } from './admin/admin-guard';

export const routes: Routes = [
  { path: '', component: Catalog, title: 'Fish Finder' },
  { path: 'login', component: Login, title: 'Fish Finder — Admin sign in' },
  { path: 'admin', component: Admin, title: 'Fish Finder — Manage', canActivate: [adminGuard] },
  { path: '**', redirectTo: '' },
];
