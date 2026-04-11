import {
  Component, inject, signal, computed, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { UserResponse } from '../../../models/user.model';

type RoleFilter = 'all' | 'Admin' | 'Customer';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-users.html',
  styleUrl: './manage-users.css'
})
export class ManageUsersComponent implements OnInit {

  adminService   = inject(AdminService);
  auth           = inject(AuthService);
  private router = inject(Router);
  private toastr = inject(ToastrService);

  users        = signal<UserResponse[]>([]);
  isLoading    = signal<boolean>(true);
  searchQuery  = signal<string>('');
  roleFilter   = signal<RoleFilter>('all');
  deletingId   = signal<number | null>(null);
  selectedUser = signal<UserResponse | null>(null);

  readonly roleTabs: { key: RoleFilter; label: string }[] = [
    { key: 'all',      label: 'All'       },
    { key: 'Customer', label: 'Customers' },
    { key: 'Admin',    label: 'Admins'    }
  ];

  // pagination + sort
  page        = signal(0);
  sortCol     = signal<'name'|'date'|'role'>('name');
  sortDir     = signal<'asc'|'desc'>('asc');
  readonly PAGE_SIZE = 20;

  filtered = computed(() => {
    let list: UserResponse[] = this.users();
    const q: string = this.searchQuery().toLowerCase().trim();
    const r: RoleFilter = this.roleFilter();

    if (q) {
      list = list.filter((u: UserResponse) =>
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
      );
    }
    if (r !== 'all') {
      list = list.filter((u: UserResponse) => u.role === r);
    }
    // sort
    const col = this.sortCol();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    if (col === 'name') list = [...list].sort((a,b) => dir * (a.name??'').localeCompare(b.name??''));
    if (col === 'date') list = [...list].sort((a,b) => dir * (new Date(a.createdAt??0).getTime() - new Date(b.createdAt??0).getTime()));
    if (col === 'role') list = [...list].sort((a,b) => dir * (a.role??'').localeCompare(b.role??''));
    return list;
  });

  pagedUsers = computed(() => {
    const p = this.page();
    return this.filtered().slice(p * this.PAGE_SIZE, (p + 1) * this.PAGE_SIZE);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.PAGE_SIZE))
  );

  toggleSort(col: 'name'|'date'|'role'): void {
    if (this.sortCol() === col) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('asc');
    }
    this.page.set(0);
  }

  totalCustomers = computed(() =>
    this.users().filter(
      (u: UserResponse) => u.role === 'Customer'
    ).length
  );

  totalAdmins = computed(() =>
    this.users().filter(
      (u: UserResponse) => u.role === 'Admin'
    ).length
  );


  roleClass(role: string): string {
    if (role === 'Admin')    { return 'role-admin'; }
    if (role === 'Customer') { return 'role-customer'; }
    return '';
  }  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.adminService.getAllUsers().subscribe({
      next: (u: UserResponse[]) => {
        this.users.set(u ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastr.error('Failed to load users.', 'Error');
        this.isLoading.set(false);
      }
    });
  }

  setRole(key: RoleFilter): void {
    this.roleFilter.set(key);
    this.page.set(0);
  }

  viewUser(user: UserResponse): void {
    this.selectedUser.set(user);
  }

  closeUser(): void {
    this.selectedUser.set(null);
  }

  deleteUser(user: UserResponse): void {
    if (!confirm(
      'Delete user "' + user.name + '"? This cannot be undone.'
    )) {
      return;
    }

    this.deletingId.set(user.id);

    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.toastr.success(
          '"' + user.name + '" deleted.', 'Deleted'
        );
        this.deletingId.set(null);
        this.selectedUser.set(null);
        this.loadUsers();
      },
      error: (err: any) => {
        this.toastr.error(
          err?.error?.message ?? 'Delete failed.', 'Error'
        );
        this.deletingId.set(null);
      }
    });
  }

  formatDate(d: string): string {
    if (!d) { return '-'; }
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  initials(name: string): string {
    if (!name) { return '?'; }
    return name
      .split(' ')
      .map((n: string) => n[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}