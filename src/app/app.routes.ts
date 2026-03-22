import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

import { LoginComponent }        from './components/auth/login/login';
import { RegisterComponent }     from './components/auth/register/register';
import { UnauthorizedComponent } from './components/shared/unauthorized/unauthorized';

import { HomeComponent }         from './components/user/home/home';
import { MovieDetailComponent }  from './components/user/movie-detail/movie-detail';
import { PlayerComponent }       from './components/user/player/player';
import { MyRentalsComponent }    from './components/user/my-rentals/my-rentals';
import { WishlistComponent }     from './components/user/wishlist/wishlist';
import { ProfileComponent }      from './components/user/profile/profile';
import { CartComponent }         from './components/user/cart/cart';

import { AdminDashboardComponent }   from './components/admin/dashboard/dashboard';
import { AdminUploadMovieComponent } from './components/admin/upload-movie/upload-movie';
import { ManageMoviesComponent }     from './components/admin/manage-movies/manage-movies';
import { ManageUsersComponent }      from './components/admin/manage-users/manage-users';
import { AdminPaymentsComponent }    from './components/admin/payments/payments';

import { CmDashboardComponent } from './components/content-manager/cm-dashboard/cm-dashboard';

export const routes: Routes = [
  { path: '',         redirectTo: 'login', pathMatch: 'full' },
  { path: 'login',    component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'unauthorized', component: UnauthorizedComponent },

  {
    path: 'home',
    component: HomeComponent,
    canActivate: [authGuard],
    data: { roles: ['Customer', 'Admin', 'ContentManager'] }
  },
  {
    path: 'movie/:id',
    component: MovieDetailComponent,
    canActivate: [authGuard],
    data: { roles: ['Customer', 'Admin', 'ContentManager'] }
  },
  {
    path: 'watch/:id',
    component: PlayerComponent,
    canActivate: [authGuard],
    data: { roles: ['Customer', 'Admin', 'ContentManager'] }
  },
  {
    path: 'my-rentals',
    component: MyRentalsComponent,
    canActivate: [authGuard],
    data: { roles: ['Customer'] }
  },
  {
    path: 'wishlist',
    component: WishlistComponent,
    canActivate: [authGuard],
    data: { roles: ['Customer'] }
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard],
    data: { roles: ['Customer'] }
  },
  {
    path: 'cart',                          // ← Single, no duplicate
    component: CartComponent,
    canActivate: [authGuard],
    data: { roles: ['Customer'] }
  },

  // Admin routes
  {
    path: 'admin/dashboard',
    component: AdminDashboardComponent,
    canActivate: [authGuard],
    data: { roles: ['Admin'] }
  },
  {
    path: 'admin/upload',
    component: AdminUploadMovieComponent,
    canActivate: [authGuard],
    data: { roles: ['Admin'] }
  },
  {
    path: 'admin/movies',
    component: ManageMoviesComponent,
    canActivate: [authGuard],
    data: { roles: ['Admin'] }
  },
  {
    path: 'admin/users',
    component: ManageUsersComponent,
    canActivate: [authGuard],
    data: { roles: ['Admin'] }
  },
  {
    path: 'admin/payments',
    component: AdminPaymentsComponent,
    canActivate: [authGuard],
    data: { roles: ['Admin'] }
  },

  // Content Manager
  {
    path: 'cm/dashboard',
    component: CmDashboardComponent,
    canActivate: [authGuard],
    data: { roles: ['ContentManager'] }
  },

  { path: '**', redirectTo: 'login' }
];