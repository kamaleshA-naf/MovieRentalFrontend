import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowseToastComponent } from './browse-toast';
import { BrowseToastService } from '../../../services/browse-toast.service';

describe('BrowseToastComponent', () => {
  let fixture: ComponentFixture<BrowseToastComponent>;
  let service: BrowseToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrowseToastComponent],
      providers: [BrowseToastService]
    }).compileComponents();
    fixture = TestBed.createComponent(BrowseToastComponent);
    service = TestBed.inject(BrowseToastService);
    fixture.detectChanges();
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());

  it('should render toast when service emits', () => {
    service.success('Test message');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.toast-success')).toBeTruthy();
    expect(el.textContent).toContain('Test message');
  });

  it('should remove toast on dismiss', () => {
    service.success('Dismiss me');
    fixture.detectChanges();
    const id = service.toasts()[0].id;
    service.dismiss(id);
    fixture.detectChanges();
    expect(service.toasts().length).toBe(0);
  });
});
